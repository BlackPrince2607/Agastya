"""OpenRouter chat completions via OpenAI-compatible API."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import sentry_sdk
from openai import AsyncOpenAI

from app.config import Settings
from app.middleware.request_context import get_request_id
from app.utils.ai_logging import AiTimer, log_ai_event

logger = logging.getLogger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# Retry only these HTTP statuses — not unknown/None (auth/config/SDK bugs).
_RETRYABLE_STATUS = frozenset({429, 500, 502, 503, 504})

# Reuse one client per (api_key, timeout) — avoids new connection pools per LLM call.
_client_cache: dict[tuple[str, float], AsyncOpenAI] = {}


def _openrouter_extra_headers(settings: Settings) -> dict[str, str]:
    """Headers recommended by https://openrouter.ai/docs/quickstart"""
    headers: dict[str, str] = {}
    if settings.openrouter_app_url:
        headers["HTTP-Referer"] = settings.openrouter_app_url
    if settings.openrouter_app_name:
        headers["X-OpenRouter-Title"] = settings.openrouter_app_name
        headers["X-Title"] = settings.openrouter_app_name
    request_id = get_request_id()
    if request_id:
        headers["X-Request-Id"] = request_id
    return headers


def openrouter_client(settings: Settings, *, timeout_seconds: float | None = None) -> AsyncOpenAI | None:
    if not settings.openrouter_api_key:
        return None
    timeout = timeout_seconds if timeout_seconds is not None else settings.openrouter_chat_timeout_seconds
    key = (settings.openrouter_api_key, float(timeout))
    cached = _client_cache.get(key)
    if cached is not None:
        return cached
    client = AsyncOpenAI(
        api_key=settings.openrouter_api_key,
        base_url=OPENROUTER_BASE_URL,
        timeout=timeout,
    )
    _client_cache[key] = client
    return client


def _capture_llm_exception(*, feature: str, model: str, exc: BaseException) -> None:
    with sentry_sdk.new_scope() as scope:
        scope.set_tag("feature", feature)
        scope.set_tag("model", model)
        request_id = get_request_id()
        if request_id:
            scope.set_tag("request_id", request_id)
        scope.capture_exception(exc)


async def llm_chat_completion(
    settings: Settings,
    *,
    model: str,
    messages: list[dict[str, Any]],
    timeout_seconds: float | None = None,
    allow_retry: bool = True,
    feature: str = "llm",
    **kwargs: Any,
):
    """Create a chat completion.

    Retries once on 429/5xx when ``allow_retry`` is True.
    Hard timeouts are never retried (avoids doubling client abort budgets).
    Never logs ``messages`` content. ``feature`` is telemetry-only (not sent to OpenRouter).
    """
    client = openrouter_client(settings, timeout_seconds=timeout_seconds)
    if client is None:
        log_ai_event(
            logger,
            "llm_fallback",
            feature=feature,
            level=logging.ERROR,
            reason="no_api_key",
            model=model,
        )
        return None

    extra_headers = _openrouter_extra_headers(settings)
    limit = timeout_seconds if timeout_seconds is not None else settings.openrouter_chat_timeout_seconds
    max_attempts = 2 if allow_retry else 1
    last_exc: Exception | None = None
    message_count = len(messages)

    for attempt in range(max_attempts):
        timer = AiTimer()
        try:
            completion = await asyncio.wait_for(
                client.chat.completions.create(
                    model=model,
                    messages=messages,
                    extra_headers=extra_headers or None,
                    **kwargs,
                ),
                timeout=limit + 5.0,
            )
            usage = getattr(completion, "usage", None)
            log_ai_event(
                logger,
                "llm_success",
                feature=feature,
                model=model,
                attempt=attempt + 1,
                latency_ms=timer.ms(),
                message_count=message_count,
                prompt_tokens=getattr(usage, "prompt_tokens", None),
                completion_tokens=getattr(usage, "completion_tokens", None),
            )
            return completion
        except TimeoutError as exc:
            last_exc = exc
            log_ai_event(
                logger,
                "llm_timeout",
                feature=feature,
                level=logging.WARNING,
                model=model,
                attempt=attempt + 1,
                latency_ms=timer.ms(),
                message_count=message_count,
                timeout_seconds=limit,
                reason="not_retrying",
            )
            _capture_llm_exception(feature=feature, model=model, exc=exc)
            break
        except Exception as exc:
            last_exc = exc
            status = getattr(exc, "status_code", None)
            retryable = status in _RETRYABLE_STATUS
            log_ai_event(
                logger,
                "llm_error",
                feature=feature,
                level=logging.WARNING,
                model=model,
                attempt=attempt + 1,
                latency_ms=timer.ms(),
                message_count=message_count,
                status_code=status,
                error_type=type(exc).__name__,
                retryable=retryable,
            )
            if attempt + 1 < max_attempts and retryable:
                await asyncio.sleep(1.2)
                continue
            _capture_llm_exception(feature=feature, model=model, exc=exc)
            break

    if last_exc:
        log_ai_event(
            logger,
            "llm_fallback",
            feature=feature,
            level=logging.ERROR,
            reason="exhausted_retries",
            model=model,
            error_type=type(last_exc).__name__,
        )
    return None

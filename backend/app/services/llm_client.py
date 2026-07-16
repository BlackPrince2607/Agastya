"""OpenRouter chat completions via OpenAI-compatible API."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import sentry_sdk
from openai import AsyncOpenAI

from app.config import Settings

logger = logging.getLogger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

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


async def llm_chat_completion(
    settings: Settings,
    *,
    model: str,
    messages: list[dict[str, Any]],
    timeout_seconds: float | None = None,
    **kwargs: Any,
):
    """Create a chat completion with one retry on transient OpenRouter errors."""
    client = openrouter_client(settings, timeout_seconds=timeout_seconds)
    if client is None:
        logger.error("llm_fallback_reason=no_api_key model=%s", model)
        return None

    extra_headers = _openrouter_extra_headers(settings)
    limit = timeout_seconds if timeout_seconds is not None else settings.openrouter_chat_timeout_seconds
    last_exc: Exception | None = None
    for attempt in range(2):
        try:
            return await asyncio.wait_for(
                client.chat.completions.create(
                    model=model,
                    messages=messages,
                    extra_headers=extra_headers or None,
                    **kwargs,
                ),
                timeout=limit + 5.0,
            )
        except TimeoutError as exc:
            last_exc = exc
            logger.warning("OpenRouter completion timed out (attempt %s, model=%s)", attempt + 1, model)
            if attempt == 0:
                await asyncio.sleep(0.6)
                continue
            sentry_sdk.capture_exception(exc)
            break
        except Exception as exc:
            last_exc = exc
            status = getattr(exc, "status_code", None)
            retryable = status in {429, 500, 502, 503, 504} or status is None
            logger.warning(
                "OpenRouter completion failed (attempt %s, model=%s, status=%s): %s",
                attempt + 1,
                model,
                status,
                exc,
            )
            if attempt == 0 and retryable:
                await asyncio.sleep(1.2)
                continue
            sentry_sdk.capture_exception(exc)
            break
    if last_exc:
        logger.error(
            "llm_fallback_reason=exhausted_retries model=%s error=%s",
            model,
            last_exc,
        )
    return None

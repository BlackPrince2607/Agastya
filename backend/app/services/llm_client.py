"""Groq chat completions via OpenAI-compatible API."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import sentry_sdk
from openai import AsyncOpenAI

from app.config import Settings

logger = logging.getLogger(__name__)

GROQ_BASE_URL = "https://api.groq.com/openai/v1"


def groq_client(settings: Settings, *, timeout_seconds: float | None = None) -> AsyncOpenAI | None:
    if not settings.groq_api_key:
        return None
    timeout = timeout_seconds if timeout_seconds is not None else settings.groq_chat_timeout_seconds
    return AsyncOpenAI(
        api_key=settings.groq_api_key,
        base_url=GROQ_BASE_URL,
        timeout=timeout,
    )


async def groq_chat_completion(
    settings: Settings,
    *,
    model: str,
    messages: list[dict[str, Any]],
    timeout_seconds: float | None = None,
    **kwargs: Any,
):
    """Create a chat completion with one retry on transient Groq errors."""
    client = groq_client(settings, timeout_seconds=timeout_seconds)
    if client is None:
        return None

    limit = timeout_seconds if timeout_seconds is not None else settings.groq_chat_timeout_seconds
    last_exc: Exception | None = None
    for attempt in range(2):
        try:
            return await asyncio.wait_for(
                client.chat.completions.create(
                    model=model,
                    messages=messages,
                    **kwargs,
                ),
                timeout=limit + 5.0,
            )
        except TimeoutError as exc:
            last_exc = exc
            logger.warning("Groq completion timed out (attempt %s, model=%s)", attempt + 1, model)
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
                "Groq completion failed (attempt %s, model=%s): %s",
                attempt + 1,
                model,
                exc,
            )
            if attempt == 0 and retryable:
                await asyncio.sleep(0.6 * (attempt + 1))
                continue
            sentry_sdk.capture_exception(exc)
            break
    if last_exc:
        logger.error("Groq completion exhausted retries: %s", last_exc)
    return None

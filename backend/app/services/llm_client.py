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


def groq_client(settings: Settings) -> AsyncOpenAI | None:
    if not settings.groq_api_key:
        return None
    return AsyncOpenAI(
        api_key=settings.groq_api_key,
        base_url=GROQ_BASE_URL,
    )


async def groq_chat_completion(
    settings: Settings,
    *,
    model: str,
    messages: list[dict[str, Any]],
    **kwargs: Any,
):
    """Create a chat completion with one retry on transient Groq errors."""
    client = groq_client(settings)
    if client is None:
        return None

    last_exc: Exception | None = None
    for attempt in range(2):
        try:
            return await client.chat.completions.create(
                model=model,
                messages=messages,
                **kwargs,
            )
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

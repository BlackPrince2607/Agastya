"""Lightweight OpenRouter liveness probe with short TTL cache."""

from __future__ import annotations

import logging
import time

from app.config import Settings
from app.services.llm_client import llm_chat_completion

logger = logging.getLogger(__name__)

_CACHE_TTL_SECONDS = 300.0
_cache: tuple[float, bool] | None = None


async def llm_is_live(settings: Settings) -> bool:
    """Return True when OpenRouter accepts the configured API key (cached ~5 min)."""
    global _cache
    if not settings.openrouter_api_key:
        return False

    now = time.monotonic()
    if _cache is not None and now - _cache[0] < _CACHE_TTL_SECONDS:
        return _cache[1]

    ok = False
    try:
        completion = await llm_chat_completion(
            settings,
            model=settings.openrouter_chat_model,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=4,
            temperature=0,
            timeout_seconds=15.0,
        )
        ok = completion is not None
    except Exception as exc:
        logger.warning("OpenRouter health probe failed: %s", exc)
        ok = False

    _cache = (now, ok)
    return ok

"""Sliding-window rate limiter — Redis when configured, in-process fallback."""

from __future__ import annotations

import json
import logging
import time
from collections import deque
from typing import Annotated

from fastapi import Depends, HTTPException, Request

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

_LIMITS: dict[str, tuple[int, int]] = {
    "/chat": (30, 3600),
    "/palm/analyze": (5, 3600),
    "/reports/generate": (10, 3600),
    "/predictions/generate": (20, 3600),
    "/tasks/daily": (20, 3600),
    "/sessions/register": (10, 60),
    "/sessions/bootstrap": (20, 60),
    "/sessions/profile": (20, 60),
}

_windows: dict[str, deque[float]] = {}
_redis_client = None


def _get_limit(path: str) -> tuple[int, int] | None:
    for suffix, limit in _LIMITS.items():
        if path.endswith(suffix):
            return limit
    return None


async def _read_session_id(request: Request) -> str | None:
    if request.method in {"GET", "HEAD"}:
        return request.query_params.get("sessionId")
    try:
        body = await request.body()
        if body:
            data = json.loads(body)
            return data.get("sessionId") or data.get("session_id")
    except Exception:
        pass
    return None


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded and request.headers.get("X-Real-IP"):
        return request.headers.get("X-Real-IP", "unknown")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _bucket_key(session_id: str | None, request: Request, path: str) -> str:
    if session_id and not path.endswith(("/sessions/bootstrap", "/sessions/profile")):
        return f"session:{session_id}:{path}"
    ip = _client_ip(request)
    return f"ip:{ip}:{path}"


def _get_redis(settings: Settings):
    global _redis_client
    if not settings.redis_url:
        return None
    if _redis_client is not None:
        return _redis_client
    try:
        import redis.asyncio as redis

        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
        return _redis_client
    except Exception as exc:
        logger.warning("Redis unavailable, falling back to in-process rate limits: %s", exc)
        return None


async def _check_redis(key: str, max_requests: int, window_seconds: int) -> int | None:
    """Return retry_after seconds if limited, else None."""
    settings = get_settings()
    r = _get_redis(settings)
    if r is None:
        return None
    try:
        now = time.time()
        pipe = r.pipeline()
        pipe.zremrangebyscore(key, 0, now - window_seconds)
        pipe.zadd(key, {str(now): now})
        pipe.zcard(key)
        pipe.expire(key, window_seconds + 1)
        results = await pipe.execute()
        count = results[2]
        if count > max_requests:
            oldest = await r.zrange(key, 0, 0, withscores=True)
            if oldest:
                retry = int(window_seconds - (now - oldest[0][1])) + 1
                return max(retry, 1)
            return window_seconds
        return None
    except Exception as exc:
        logger.warning("Redis rate limit error: %s", exc)
        return None


def _check_memory(key: str, max_requests: int, window_seconds: int) -> int | None:
    now = time.monotonic()
    window = _windows.setdefault(key, deque())
    cutoff = now - window_seconds
    while window and window[0] < cutoff:
        window.popleft()
    if len(window) >= max_requests:
        oldest = window[0]
        return int(window_seconds - (now - oldest)) + 1
    window.append(now)
    return None


async def check_rate_limit(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    path = request.url.path
    limit_config = _get_limit(path)
    if limit_config is None:
        return

    max_requests, window_seconds = limit_config
    session_id = await _read_session_id(request)
    key = _bucket_key(session_id, request, path)

    retry_after = await _check_redis(key, max_requests, window_seconds)
    if settings.redis_url and _get_redis(settings) is not None:
        if retry_after is not None:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit reached. Please wait {retry_after}s before retrying.",
                headers={"Retry-After": str(retry_after)},
            )
        return

    retry_after = _check_memory(key, max_requests, window_seconds)
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit reached. Please wait {retry_after}s before retrying.",
            headers={"Retry-After": str(retry_after)},
        )

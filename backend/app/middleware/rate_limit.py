"""Sliding-window rate limiter — Redis when configured, in-process fallback."""

from __future__ import annotations

import json
import logging
import re
import time
from collections import deque
from typing import Annotated

from fastapi import Depends, HTTPException, Request

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

_LIMITS: dict[str, tuple[int, int]] = {
    "/chat": (30, 3600),
    "/palm/analyze": (5, 3600),
    "/palm/landmarks": (30, 3600),
    "/reports/generate": (10, 3600),
    "/predictions/generate": (20, 3600),
    "/tasks/daily": (20, 3600),
    "/insights/daily": (15, 3600),
    "/insights/reflect": (30, 3600),
    "/insights/weekly": (10, 3600),
    "/insights/journey": (30, 3600),
    "/sessions/register": (10, 60),
    "/sessions/bootstrap": (20, 60),
    "/sessions/bootstrap/authenticated": (20, 60),
    "/sessions/profile": (20, 60),
    "/sessions/merge": (10, 60),
    "/auth/check-email": (10, 60),
    "/auth/delete-account": (5, 3600),
    "/billing/razorpay/create-payment-link": (5, 60),
    "/billing/razorpay/confirm-payment": (10, 60),
    "/billing/google-play/verify-purchase": (5, 60),
    "/billing/config": (30, 60),
    "/notifications/register-token": (20, 60),
    "/notifications/unregister-token": (20, 60),
    "/notifications/heartbeat": (60, 60),
    "/notifications/event": (20, 60),
    "/notifications/cron/dispatch": (5, 60),
}

_windows: dict[str, deque[float]] = {}
_redis_client = None

# sessionId is near the top of app request bodies; avoid json.loads on multi-MB palm payloads.
_SESSION_ID_RE = re.compile(rb'"sessionId"\s*:\s*"([^"]+)"')
_SESSION_ID_SNAKE_RE = re.compile(rb'"session_id"\s*:\s*"([^"]+)"')
_SESSION_SCAN_BYTES = 4096


def _get_limit(path: str) -> tuple[int, int] | None:
    for suffix, limit in _LIMITS.items():
        if path.endswith(suffix):
            return limit
    return None


async def _read_body_session_id(request: Request) -> str | None:
    try:
        body = await request.body()
        if not body:
            return None
        head = body[:_SESSION_SCAN_BYTES]
        m = _SESSION_ID_RE.search(head) or _SESSION_ID_SNAKE_RE.search(head)
        if m:
            return m.group(1).decode("utf-8", errors="ignore")
        if len(body) <= 65_536:
            data = json.loads(body)
            return data.get("sessionId") or data.get("session_id")
    except Exception:
        pass
    return None


async def _read_session_id(request: Request) -> str | None:
    """Resolve session id for rate-limit bucketing.

    Prefer body/query sessionId. Never trust a spoofable X-Session-Id alone:
    if the header differs from the body, fall back to IP bucketing (caller uses None).
    """
    if request.method in {"GET", "HEAD"}:
        return request.query_params.get("sessionId")

    body_session = await _read_body_session_id(request)
    header = (request.headers.get("X-Session-Id") or "").strip() or None
    if body_session:
        if header and header != body_session:
            # Spoof attempt: do not honor attacker-chosen header bucket.
            return None
        return body_session
    # No body sessionId (unusual) — ignore header to prevent unlimited fresh buckets.
    return None


def _client_ip(request: Request) -> str:
    # Prefer X-Real-IP set by a trusted reverse proxy. Do not trust X-Forwarded-For alone.
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip() or "unknown"
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


async def _check_redis(key: str, max_requests: int, window_seconds: int) -> tuple[bool, int | None]:
    """Return (redis_active, retry_after). redis_active is False when Redis is down."""
    settings = get_settings()
    r = _get_redis(settings)
    if r is None:
        return False, None
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
                return True, max(retry, 1)
            return True, window_seconds
        return True, None
    except Exception as exc:
        logger.warning("Redis rate limit error: %s", exc)
        return False, None


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

    redis_active = False
    retry_after: int | None = None
    if settings.redis_url:
        redis_active, retry_after = await _check_redis(key, max_requests, window_seconds)
        if retry_after is not None:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit reached. Please wait {retry_after}s before retrying.",
                headers={"Retry-After": str(retry_after)},
            )

    if not redis_active:
        retry_after = _check_memory(key, max_requests, window_seconds)
        if retry_after is not None:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit reached. Please wait {retry_after}s before retrying.",
                headers={"Retry-After": str(retry_after)},
            )

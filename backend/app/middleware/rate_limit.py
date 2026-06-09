"""Simple in-process sliding-window rate limiter for per-session AI endpoints.

Design notes:
- Keyed on `session_id` extracted from the request body (JSON POST).
- Falls back to IP address when session_id is absent (health / webhook routes).
- Uses a deque of timestamps per key; O(1) amortised eviction.
- State is in-process only — acceptable for single-instance deploys (Fly.io
  single machine or Railway single replica). For multi-replica you would replace
  the deque dict with a Redis ZADD/ZREMRANGEBYSCORE approach.
- On limit breach: 429 with Retry-After header.
"""

from __future__ import annotations

import json
import time
from collections import deque
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from app.config import Settings, get_settings

# ── Per-endpoint limits (requests per window_seconds) ───────────────────────

_LIMITS: dict[str, tuple[int, int]] = {
    # path_suffix: (max_requests, window_seconds)
    "/chat":                  (30,  3600),   # 30 msgs / hour
    "/palm/analyze":          (5,   3600),   # 5 scans / hour
    "/reports/generate":      (10,  3600),   # 10 reports / hour
    "/predictions/generate":  (20,  3600),   # 20 predictions / hour
    "/tasks/daily":           (20,  3600),   # 20 task refreshes / hour
    "/sessions/register":     (10,  60),     # 10 registrations / minute (burst guard)
}

# key → deque of float timestamps
_windows: dict[str, deque[float]] = {}


def _get_limit(path: str) -> tuple[int, int] | None:
    for suffix, limit in _LIMITS.items():
        if path.endswith(suffix):
            return limit
    return None


async def _read_session_id(request: Request) -> str | None:
    """Try to extract sessionId from the JSON body without consuming the stream."""
    try:
        body = await request.body()
        if body:
            data = json.loads(body)
            return data.get("sessionId") or data.get("session_id")
    except Exception:
        pass
    return None


def _bucket_key(session_id: str | None, request: Request) -> str:
    if session_id:
        return f"session:{session_id}"
    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    return f"ip:{ip}"


async def check_rate_limit(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    """FastAPI dependency — raise 429 if the caller exceeds their slot budget."""
    limit_config = _get_limit(request.url.path)
    if limit_config is None:
        return

    max_requests, window_seconds = limit_config

    session_id = await _read_session_id(request)
    key = _bucket_key(session_id, request)

    now = time.monotonic()
    window = _windows.setdefault(key, deque())

    # Evict expired timestamps
    cutoff = now - window_seconds
    while window and window[0] < cutoff:
        window.popleft()

    if len(window) >= max_requests:
        oldest = window[0]
        retry_after = int(window_seconds - (now - oldest)) + 1
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit reached. Please wait {retry_after}s before retrying.",
            headers={"Retry-After": str(retry_after)},
        )

    window.append(now)

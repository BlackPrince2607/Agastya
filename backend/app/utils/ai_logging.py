"""Structured AI pipeline logging — never logs prompts, images, or user content."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from app.middleware.request_context import get_request_id

# Keys that must never appear in structured AI logs (case-insensitive).
_SENSITIVE_KEYS = frozenset(
    {
        "content",
        "messages",
        "prompt",
        "system",
        "image",
        "image_base64",
        "imagebase64",
        "text",
        "reply",
        "body",
        "note",
        "palm",
        "palm_analysis",
        "palmanalysis",
        "raw",
        "raw_text",
        "rawtext",
        "authorization",
        "api_key",
        "apikey",
        "token",
        "password",
        "profile_summary",
        "profilesummary",
        "user_text",
        "usertext",
        "chat_tail",
        "chattail",
    }
)


def _safe_fields(fields: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in fields.items():
        if key.lower() in _SENSITIVE_KEYS:
            continue
        if value is None:
            continue
        if isinstance(value, (str, int, float, bool)):
            out[key] = value
        elif isinstance(value, Exception):
            out[key] = type(value).__name__
        else:
            out[key] = str(value)[:200]
    return out


def log_ai_event(
    logger: logging.Logger,
    event: str,
    *,
    feature: str,
    level: int = logging.INFO,
    **fields: Any,
) -> None:
    """Emit one JSON log line for AI pipeline observability."""
    payload: dict[str, Any] = {
        "msg": "ai_event",
        "event": event,
        "feature": feature,
    }
    request_id = get_request_id()
    if request_id:
        payload["request_id"] = request_id
    payload.update(_safe_fields(fields))
    logger.log(level, "%s", json.dumps(payload, default=str, separators=(",", ":")))


class AiTimer:
    """Simple wall-clock timer for LLM attempt latency."""

    __slots__ = ("_start",)

    def __init__(self) -> None:
        self._start = time.perf_counter()

    def ms(self) -> int:
        return int((time.perf_counter() - self._start) * 1000)

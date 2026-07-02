"""Session buckets — in-memory with optional Supabase persistence."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.schemas.palm import PalmAnalysis
from app.schemas.predictions import PredictionsResponse
from app.schemas.report import FullReport


@dataclass
class SessionBucket:
    palm: PalmAnalysis | None = None
    preview: FullReport | None = None
    full: FullReport | None = None
    chat_tail: list[dict[str, str]] = field(default_factory=list)
    # Cached predictions keyed by period ("month" | "3month" | "year").
    predictions: dict[str, PredictionsResponse] = field(default_factory=dict)
    meta: dict[str, Any] = field(default_factory=dict)
    # Server-authoritative premium flag — set by RevenueCat webhook, not the client.
    is_premium: bool = False


_BUCKETS: dict[str, SessionBucket] = {}


def has_bucket(session_id: str) -> bool:
    return session_id in _BUCKETS


def bucket(session_id: str) -> SessionBucket:
    return _BUCKETS.setdefault(session_id, SessionBucket())


def set_bucket(session_id: str, loaded: SessionBucket) -> SessionBucket:
    _BUCKETS[session_id] = loaded
    return loaded


def link_supabase_user(anonymous_session_id: str, supabase_user_id: str) -> bool:
    """Alias the anonymous session bucket to ``user:{supabase_user_id}`` for continuity after login."""
    b = _BUCKETS.get(anonymous_session_id)
    if b is None:
        return False
    _BUCKETS[f"user:{supabase_user_id}"] = b
    b.meta["supabaseUserId"] = supabase_user_id
    return True


def merge_bucket_data(target: SessionBucket, source: SessionBucket) -> None:
    """Copy missing reading data from ``source`` into ``target`` (e.g. after login on a new device)."""
    if source.palm and not target.palm:
        target.palm = source.palm
    if source.preview and not target.preview:
        target.preview = source.preview
    if source.full and not target.full:
        target.full = source.full
    if source.is_premium:
        target.is_premium = True
    if len(source.chat_tail) > len(target.chat_tail):
        target.chat_tail = list(source.chat_tail)
    for period, pred in source.predictions.items():
        if period not in target.predictions:
            target.predictions[period] = pred
    for key, value in source.meta.items():
        if key == "deviceInstallId":
            continue
        if key not in target.meta or target.meta[key] in (None, "", []):
            target.meta[key] = value

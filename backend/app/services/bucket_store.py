"""Session buckets — in-memory with optional Supabase persistence."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.schemas.palm import PalmAnalysis
from app.schemas.report import FullReport


@dataclass
class SessionBucket:
    palm: PalmAnalysis | None = None
    preview: FullReport | None = None
    full: FullReport | None = None
    chat_tail: list[dict[str, str]] = field(default_factory=list)
    meta: dict[str, Any] = field(default_factory=dict)


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

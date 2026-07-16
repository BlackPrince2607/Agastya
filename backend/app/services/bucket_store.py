"""Session buckets — in-memory with optional Supabase persistence."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.schemas.palm import PalmAnalysis
from app.schemas.predictions import PredictionsResponse
from app.schemas.report import FullReport


def empty_user_memory() -> dict[str, list[Any]]:
    return {"journey": [], "temporary": []}


def normalize_user_memory(raw: Any) -> dict[str, list[Any]]:
    """Coerce stored JSONB into {journey, temporary} lists."""
    if not isinstance(raw, dict):
        return empty_user_memory()
    journey = raw.get("journey")
    temporary = raw.get("temporary")
    return {
        "journey": list(journey) if isinstance(journey, list) else [],
        "temporary": list(temporary) if isinstance(temporary, list) else [],
    }


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
    # Layered memory: Life Journey + Temporary Context (Permanent Identity stays on palm/reports).
    user_memory: dict[str, list[Any]] = field(default_factory=empty_user_memory)
    # Today's chapter cache: guidance, focusTheme, optional reflection.
    daily_context: dict[str, Any] | None = None
    # Weekly Journey Summary cache keyed by ISO week.
    weekly_context: dict[str, Any] | None = None


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


def _prefer_daily_context(target: Any, source: Any) -> dict[str, Any] | None:
    """Prefer newer calendar day; on same day prefer complete chapter and keep reflection."""
    if not isinstance(source, dict):
        return dict(target) if isinstance(target, dict) else None
    if not isinstance(target, dict):
        return dict(source)

    from app.services.day_context import is_complete_daily_context

    src_d = str(source.get("date") or "")
    tgt_d = str(target.get("date") or "")
    if src_d and src_d > tgt_d:
        chosen = dict(source)
    elif tgt_d and tgt_d > src_d:
        chosen = dict(target)
    else:
        src_complete = bool(src_d and is_complete_daily_context(source, src_d))
        tgt_complete = bool(tgt_d and is_complete_daily_context(target, tgt_d))
        if src_complete and not tgt_complete:
            chosen = dict(source)
        elif tgt_complete and not src_complete:
            chosen = dict(target)
        elif str(source.get("generated_at") or "") >= str(target.get("generated_at") or ""):
            chosen = dict(source)
        else:
            chosen = dict(target)

    refl = chosen.get("reflection") or source.get("reflection") or target.get("reflection")
    if refl:
        chosen["reflection"] = refl
    from app.services.day_context import merge_recent_chapters

    recent = merge_recent_chapters(
        chosen.get("recentChapters"),
        source.get("recentChapters") if isinstance(source, dict) else None,
        target.get("recentChapters") if isinstance(target, dict) else None,
    )
    if recent:
        chosen["recentChapters"] = recent
    return chosen


def _prefer_weekly_context(target: Any, source: Any) -> dict[str, Any] | None:
    """Prefer newer ISO week key when merging sessions."""
    if not isinstance(source, dict):
        return dict(target) if isinstance(target, dict) else None
    if not isinstance(target, dict):
        return dict(source)
    src_w = str(source.get("weekKey") or source.get("week_key") or "")
    tgt_w = str(target.get("weekKey") or target.get("week_key") or "")
    if src_w and src_w >= tgt_w:
        return dict(source)
    return dict(target)


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
    src_mem = normalize_user_memory(source.user_memory)
    tgt_mem = normalize_user_memory(target.user_memory)
    if len(src_mem["journey"]) > len(tgt_mem["journey"]) or len(src_mem["temporary"]) > len(
        tgt_mem["temporary"]
    ):
        target.user_memory = {
            "journey": src_mem["journey"] if len(src_mem["journey"]) >= len(tgt_mem["journey"]) else tgt_mem["journey"],
            "temporary": src_mem["temporary"]
            if len(src_mem["temporary"]) >= len(tgt_mem["temporary"])
            else tgt_mem["temporary"],
        }
    if source.daily_context:
        target.daily_context = _prefer_daily_context(target.daily_context, source.daily_context)
    if source.weekly_context:
        target.weekly_context = _prefer_weekly_context(target.weekly_context, source.weekly_context)
    for key, value in source.meta.items():
        if key == "deviceInstallId":
            continue
        if key not in target.meta or target.meta[key] in (None, "", []):
            target.meta[key] = value

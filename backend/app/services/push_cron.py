"""Hourly cron campaigns for remote push re-engagement."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from app.config import Settings
from app.services import expo_push, push_token_repository

logger = logging.getLogger(__name__)


def _session_from_row(row: dict[str, Any]) -> dict[str, Any]:
    embedded = row.get("agastya_sessions")
    if isinstance(embedded, dict):
        return embedded
    if isinstance(embedded, list) and embedded:
        return embedded[0] if isinstance(embedded[0], dict) else {}
    return {}


def _has_topics(focus: Any) -> bool:
    return isinstance(focus, list) and len(focus) > 0


def _parse_ts(raw: Any) -> datetime | None:
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    if isinstance(raw, str) and raw.strip():
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


async def _ensure_session(row: dict[str, Any], settings: Settings) -> dict[str, Any]:
    sess = _session_from_row(row)
    if sess:
        return sess
    sid = str(row.get("session_id") or "")
    if not sid:
        return {}
    loaded = await push_token_repository.load_session_row(sid, settings)
    return loaded or {}


async def dispatch_all(settings: Settings) -> dict[str, int]:
    """Run all scheduled campaigns. Returns counts per event type."""
    if not settings.notifications_enabled:
        return {"disabled": 1}

    now = datetime.now(timezone.utc)
    counts: dict[str, int] = {}
    rows = await push_token_repository.list_enabled_tokens_with_session(settings, limit=800)

    for row in rows:
        session_id = str(row.get("session_id") or "")
        token = str(row.get("expo_push_token") or "")
        if not session_id or not token:
            continue
        tz = row.get("timezone_offset_minutes")
        tz_int = int(tz) if tz is not None else 0
        last_seen = _parse_ts(row.get("last_seen_at"))
        sess = await _ensure_session(row, settings)
        if not sess:
            continue

        local_hour = push_token_repository._local_hour(now, tz_int)
        local_wd = push_token_repository._local_weekday(now, tz_int)
        local_date = push_token_repository._local_date_iso(now, tz_int)
        week_key = push_token_repository._iso_week_key(now, tz_int)

        display_name = sess.get("display_name")
        focus = sess.get("focus_topics")
        palm = sess.get("palm_analysis")
        preview = sess.get("preview_report")
        user_id = sess.get("supabase_user_id") or row.get("supabase_user_id")
        is_premium = bool(sess.get("is_premium"))
        updated = _parse_ts(sess.get("updated_at")) or _parse_ts(sess.get("created_at"))

        async def _send(event: str, key: str) -> None:
            n = await expo_push.notify_session(
                session_id,
                event,
                settings=settings,
                event_key=key,
                supabase_user_id=str(user_id) if user_id else None,
            )
            if n:
                counts[event] = counts.get(event, 0) + n

        # --- onboarding_incomplete: profile+goals, no palm, 24h/48h ---
        if display_name and _has_topics(focus) and not palm and updated:
            age = now - updated
            if age >= timedelta(hours=48):
                await _send("onboarding_incomplete", "onboarding_48h")
            elif age >= timedelta(hours=24):
                await _send("onboarding_incomplete", "onboarding_24h")

        # --- preview_unsigned: has preview, no supabase user, 12h/24h ---
        if preview and not user_id and updated:
            age = now - updated
            if age >= timedelta(hours=24):
                await _send("preview_unsigned", "unsigned_24h")
            elif age >= timedelta(hours=12):
                await _send("preview_unsigned", "unsigned_12h")

        # --- streak_at_risk: Pro, inactive today, evening window ---
        # Streak is client-side; proxy with is_premium + has palm + no last_seen today.
        if is_premium and palm and last_seen:
            seen_local = push_token_repository._local_date_iso(last_seen, tz_int)
            if seen_local != local_date and 19 <= local_hour <= 21:
                await _send("streak_at_risk", f"streak_{local_date}")

        # --- weekly_guidance: Sat(5)/Sun(6), ~10:00 local ---
        if palm and user_id and local_wd in {5, 6} and local_hour == 10:
            await _send("weekly_guidance", f"weekly_{week_key}")

        # --- re-engage inactive (prefer ~10:00 local) ---
        if last_seen and local_hour == 10:
            idle = now - last_seen
            if idle >= timedelta(days=14):
                await _send("reengage_14d", f"reengage_14d_{local_date[:7]}")
            elif idle >= timedelta(days=7):
                await _send("reengage_7d", f"reengage_7d_{local_date[:7]}")
            elif idle >= timedelta(days=3):
                await _send("reengage_3d", f"reengage_3d_{local_date}")

    logger.info("push cron dispatch done counts=%s", counts)
    return counts

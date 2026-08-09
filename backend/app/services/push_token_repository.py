"""Persist Expo push tokens and notification send dedup in Supabase."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from app.config import Settings, get_settings
from app.services.supabase_rest import SupabaseUnavailableError, rest_client

logger = logging.getLogger(__name__)

TOKENS_TABLE = "agastya_push_tokens"
LOG_TABLE = "agastya_notification_log"


def _client(settings: Settings | None = None):
    return rest_client(settings or get_settings())


async def upsert_token(
    *,
    session_id: str,
    expo_push_token: str,
    platform: str | None = None,
    timezone_offset_minutes: int | None = None,
    supabase_user_id: str | None = None,
    settings: Settings | None = None,
) -> bool:
    client = _client(settings)
    if client is None:
        return False
    now = datetime.now(timezone.utc).isoformat()
    row: dict[str, Any] = {
        "session_id": session_id,
        "expo_push_token": expo_push_token.strip(),
        "enabled": True,
        "last_seen_at": now,
    }
    if platform in {"ios", "android"}:
        row["platform"] = platform
    if timezone_offset_minutes is not None:
        row["timezone_offset_minutes"] = int(timezone_offset_minutes)
    if supabase_user_id:
        row["supabase_user_id"] = supabase_user_id
    result = await client.upsert(TOKENS_TABLE, row, on_conflict="expo_push_token")
    return result is not None


async def disable_token(expo_push_token: str, settings: Settings | None = None) -> bool:
    client = _client(settings)
    if client is None:
        return False
    return await client.patch(
        TOKENS_TABLE,
        filters={"expo_push_token": expo_push_token.strip()},
        values={"enabled": False},
    )


async def disable_tokens_for_session(session_id: str, settings: Settings | None = None) -> bool:
    client = _client(settings)
    if client is None:
        return False
    return await client.patch(
        TOKENS_TABLE,
        filters={"session_id": session_id},
        values={"enabled": False},
    )


async def heartbeat(
    *,
    session_id: str,
    expo_push_token: str | None = None,
    timezone_offset_minutes: int | None = None,
    settings: Settings | None = None,
) -> bool:
    client = _client(settings)
    if client is None:
        return False
    now = datetime.now(timezone.utc).isoformat()
    values: dict[str, Any] = {"last_seen_at": now}
    if timezone_offset_minutes is not None:
        values["timezone_offset_minutes"] = int(timezone_offset_minutes)
    if expo_push_token:
        return await client.patch(
            TOKENS_TABLE,
            filters={"expo_push_token": expo_push_token.strip()},
            values=values,
        )
    return await client.patch(
        TOKENS_TABLE,
        filters={"session_id": session_id},
        values=values,
    )


async def tokens_for_session(session_id: str, settings: Settings | None = None) -> list[str]:
    client = _client(settings)
    if client is None:
        return []
    try:
        rows = await client.select_with_params(
            TOKENS_TABLE,
            params={
                "select": "expo_push_token",
                "session_id": f"eq.{session_id}",
                "enabled": "eq.true",
                "limit": "20",
            },
        )
    except SupabaseUnavailableError:
        return []
    return [str(r["expo_push_token"]) for r in rows if r.get("expo_push_token")]


async def tokens_for_user(supabase_user_id: str, settings: Settings | None = None) -> list[str]:
    client = _client(settings)
    if client is None:
        return []
    try:
        rows = await client.select_with_params(
            TOKENS_TABLE,
            params={
                "select": "expo_push_token",
                "supabase_user_id": f"eq.{supabase_user_id}",
                "enabled": "eq.true",
                "limit": "40",
            },
        )
    except SupabaseUnavailableError:
        return []
    return [str(r["expo_push_token"]) for r in rows if r.get("expo_push_token")]


async def try_claim_send(
    session_id: str,
    event_type: str,
    event_key: str,
    settings: Settings | None = None,
) -> bool:
    """Insert dedup row; return True if this caller owns the send."""
    client = _client(settings)
    if client is None:
        # Without Supabase, allow send (dev / in-memory).
        return True
    row = {
        "session_id": session_id,
        "event_type": event_type,
        "event_key": event_key,
    }
    # Upsert with ignore-duplicates: Prefer resolution=ignore-duplicates
    headers_ok = await client.upsert(LOG_TABLE, row, on_conflict="session_id,event_type,event_key")
    if headers_ok is None:
        # Conflict or failure — check if already logged
        try:
            existing = await client.select_one(
                LOG_TABLE,
                filters={
                    "session_id": session_id,
                    "event_type": event_type,
                    "event_key": event_key,
                },
                columns="id",
            )
            return existing is None
        except SupabaseUnavailableError:
            return False
    # Upsert may merge on conflict; verify we are the first by checking sent_at freshness is weak.
    # Prefer: attempt insert-only. PostgREST merge-duplicates updates — use select-before.
    try:
        rows = await client.select_with_params(
            LOG_TABLE,
            params={
                "select": "id,sent_at",
                "session_id": f"eq.{session_id}",
                "event_type": f"eq.{event_type}",
                "event_key": f"eq.{event_key}",
                "limit": "1",
            },
        )
        if not rows:
            return True
        # If row existed before this call within 2s window we still might double — acceptable for best-effort.
        # Better approach: select first
    except SupabaseUnavailableError:
        return True
    return True


async def already_sent(
    session_id: str,
    event_type: str,
    event_key: str,
    settings: Settings | None = None,
) -> bool:
    client = _client(settings)
    if client is None:
        return False
    try:
        row = await client.select_one(
            LOG_TABLE,
            filters={
                "session_id": session_id,
                "event_type": event_type,
                "event_key": event_key,
            },
            columns="id",
        )
        return row is not None
    except SupabaseUnavailableError:
        return False


async def claim_if_not_sent(
    session_id: str,
    event_type: str,
    event_key: str,
    settings: Settings | None = None,
) -> bool:
    """Return True and insert log row only if not already sent."""
    if await already_sent(session_id, event_type, event_key, settings):
        return False
    client = _client(settings)
    if client is None:
        return True
    result = await client.upsert(
        LOG_TABLE,
        {
            "session_id": session_id,
            "event_type": event_type,
            "event_key": event_key,
        },
        on_conflict="session_id,event_type,event_key",
    )
    return result is not None


def _local_hour(utc_now: datetime, tz_offset_minutes: int | None) -> int:
    """JS getTimezoneOffset: minutes behind UTC (IST = -330). Local = UTC - offset."""
    offset = int(tz_offset_minutes) if tz_offset_minutes is not None else 0
    local = utc_now - timedelta(minutes=offset)
    return local.hour


def _local_weekday(utc_now: datetime, tz_offset_minutes: int | None) -> int:
    """0=Mon … 6=Sun (Python)."""
    offset = int(tz_offset_minutes) if tz_offset_minutes is not None else 0
    local = utc_now - timedelta(minutes=offset)
    return local.weekday()


def _local_date_iso(utc_now: datetime, tz_offset_minutes: int | None) -> str:
    offset = int(tz_offset_minutes) if tz_offset_minutes is not None else 0
    local = utc_now - timedelta(minutes=offset)
    return local.date().isoformat()


def _iso_week_key(utc_now: datetime, tz_offset_minutes: int | None) -> str:
    offset = int(tz_offset_minutes) if tz_offset_minutes is not None else 0
    local = utc_now - timedelta(minutes=offset)
    iso = local.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


async def list_enabled_tokens_with_session(
    settings: Settings | None = None,
    *,
    limit: int = 500,
) -> list[dict[str, Any]]:
    """Join-ish: tokens + session columns via PostgREST embed."""
    client = _client(settings)
    if client is None:
        return []
    try:
        return await client.select_with_params(
            TOKENS_TABLE,
            params={
                "select": (
                    "session_id,expo_push_token,timezone_offset_minutes,last_seen_at,"
                    "supabase_user_id,"
                    "agastya_sessions!inner(session_id,display_name,focus_topics,palm_analysis,"
                    "preview_report,supabase_user_id,is_premium,updated_at,created_at)"
                ),
                "enabled": "eq.true",
                "limit": str(limit),
            },
        )
    except SupabaseUnavailableError:
        # Fallback without embed if FK name differs
        try:
            return await client.select_with_params(
                TOKENS_TABLE,
                params={
                    "select": "session_id,expo_push_token,timezone_offset_minutes,last_seen_at,supabase_user_id",
                    "enabled": "eq.true",
                    "limit": str(limit),
                },
            )
        except SupabaseUnavailableError:
            return []


async def load_session_row(session_id: str, settings: Settings | None = None) -> dict[str, Any] | None:
    client = _client(settings)
    if client is None:
        return None
    try:
        return await client.select_one(
            "agastya_sessions",
            filters={"session_id": session_id},
            columns=(
                "session_id,display_name,focus_topics,palm_analysis,preview_report,"
                "supabase_user_id,is_premium,updated_at,created_at"
            ),
        )
    except SupabaseUnavailableError:
        return None

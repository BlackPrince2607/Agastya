"""Persist session buckets to Supabase when configured."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.config import Settings, get_settings
from app.schemas.palm import PalmAnalysis
from app.schemas.predictions import PredictionsResponse
from app.schemas.report import FullReport
from app.services.bucket_store import SessionBucket, empty_user_memory, normalize_user_memory
from app.services.supabase_rest import SupabaseRest, SupabaseUnavailableError, rest_client

logger = logging.getLogger(__name__)

TABLE = "agastya_sessions"


def _parse_expires_at(raw: Any) -> datetime | None:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    if isinstance(raw, str) and raw.strip():
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


__all__ = [
    "SupabaseUnavailableError",
    "is_enabled",
    "bucket_to_row",
    "row_to_bucket",
    "refresh_premium_from_db",
    "load",
    "save",
    "link_user",
    "list_sessions_for_user",
    "delete_sessions_for_user",
    "set_premium_by_user",
    "set_premium_by_session",
]


def is_enabled(settings: Settings | None = None) -> bool:
    s = settings or get_settings()
    return bool(s.supabase_url and s.supabase_service_role_key)


def _client(settings: Settings | None = None) -> SupabaseRest | None:
    return rest_client(settings or get_settings())


def bucket_to_row(session_id: str, bucket: SessionBucket) -> dict[str, Any]:
    meta = bucket.meta
    topics = meta.get("focusTopics") or []
    return {
        "session_id": session_id,
        "device_install_id": meta.get("deviceInstallId"),
        "supabase_user_id": meta.get("supabaseUserId"),
        "display_name": meta.get("displayName"),
        "gender": meta.get("gender"),
        "focus_topics": topics if isinstance(topics, list) else [],
        "palm_storage_path": meta.get("palmStoragePath"),
        "palm_analysis": bucket.palm.model_dump() if bucket.palm else None,
        "preview_report": bucket.preview.model_dump(by_alias=True) if bucket.preview else None,
        "full_report": bucket.full.model_dump(by_alias=True) if bucket.full else None,
        "predictions": {
            period: payload.model_dump(by_alias=True) for period, payload in bucket.predictions.items()
        }
        if bucket.predictions
        else None,
        "chat_tail": bucket.chat_tail,
        "is_premium": bucket.is_premium,
        "premium_source": bucket.premium_source,
        "premium_expires_at": bucket.premium_expires_at.isoformat() if bucket.premium_expires_at else None,
        "user_memory": normalize_user_memory(bucket.user_memory),
        "daily_context": bucket.daily_context,
        "weekly_context": bucket.weekly_context,
    }


def row_to_bucket(row: dict[str, Any]) -> SessionBucket:
    meta: dict[str, Any] = {
        "deviceInstallId": row.get("device_install_id"),
        "displayName": row.get("display_name"),
        "gender": row.get("gender"),
        "focusTopics": row.get("focus_topics") or [],
        "supabaseUserId": str(row["supabase_user_id"]) if row.get("supabase_user_id") else None,
        "palmStoragePath": row.get("palm_storage_path"),
    }
    if row.get("created_at"):
        meta["blueprintCreatedAt"] = str(row["created_at"])
    palm_raw = row.get("palm_analysis")
    preview_raw = row.get("preview_report")
    full_raw = row.get("full_report")
    predictions_raw = row.get("predictions") or {}
    chat_tail = row.get("chat_tail") or []

    palm = PalmAnalysis.model_validate(palm_raw) if palm_raw else None
    preview = FullReport.model_validate(preview_raw) if preview_raw else None
    full = FullReport.model_validate(full_raw) if full_raw else None

    predictions: dict[str, PredictionsResponse] = {}
    if isinstance(predictions_raw, dict):
        for period, payload in predictions_raw.items():
            try:
                predictions[period] = PredictionsResponse.model_validate(payload)
            except Exception:
                continue

    memory_raw = row.get("user_memory")
    daily_raw = row.get("daily_context")
    weekly_raw = row.get("weekly_context")

    return SessionBucket(
        palm=palm,
        preview=preview,
        full=full,
        chat_tail=chat_tail if isinstance(chat_tail, list) else [],
        predictions=predictions,
        meta={k: v for k, v in meta.items() if v is not None},
        is_premium=bool(row.get("is_premium", False)),
        premium_source=str(row["premium_source"]) if row.get("premium_source") else None,
        premium_expires_at=_parse_expires_at(row.get("premium_expires_at")),
        user_memory=normalize_user_memory(memory_raw) if memory_raw is not None else empty_user_memory(),
        daily_context=daily_raw if isinstance(daily_raw, dict) else None,
        weekly_context=weekly_raw if isinstance(weekly_raw, dict) else None,
    )


async def refresh_premium_from_db(
    session_id: str,
    bucket: SessionBucket,
    settings: Settings | None = None,
) -> bool:
    """Reload is_premium from Supabase so multi-worker deploys stay consistent."""
    client = _client(settings)
    if client is None:
        return bucket.effectively_premium()
    row = await client.select_one(
        TABLE,
        filters={"session_id": session_id},
        columns="is_premium,premium_source,premium_expires_at",
    )
    if row is not None:
        bucket.is_premium = bool(row.get("is_premium", False))
        bucket.premium_source = str(row["premium_source"]) if row.get("premium_source") else None
        bucket.premium_expires_at = _parse_expires_at(row.get("premium_expires_at"))
        if bucket.is_premium and not bucket.effectively_premium():
            bucket.is_premium = False
    return bucket.effectively_premium()


async def load(session_id: str, settings: Settings | None = None) -> SessionBucket | None:
    client = _client(settings)
    if client is None:
        return None
    row = await client.select_one(TABLE, filters={"session_id": session_id})
    if not row:
        return None
    try:
        return row_to_bucket(row)
    except Exception as exc:
        logger.warning("session row parse failed for %s: %s", session_id, exc)
        return None


async def save(session_id: str, bucket: SessionBucket, settings: Settings | None = None) -> bool:
    client = _client(settings)
    if client is None:
        return False
    row = bucket_to_row(session_id, bucket)
    result = await client.upsert(TABLE, row, on_conflict="session_id")
    return result is not None


async def link_user(
    anonymous_session_id: str,
    supabase_user_id: str,
    settings: Settings | None = None,
) -> bool:
    client = _client(settings)
    if client is None:
        return False
    existing = await client.select_one(
        TABLE, filters={"session_id": anonymous_session_id}, columns="supabase_user_id"
    )
    if existing:
        linked_user = existing.get("supabase_user_id")
        if linked_user and str(linked_user) != supabase_user_id:
            return False
    return await client.patch(
        TABLE,
        filters={"session_id": anonymous_session_id},
        values={"supabase_user_id": supabase_user_id},
    )


async def list_sessions_for_user(
    supabase_user_id: str,
    settings: Settings | None = None,
) -> list[dict[str, Any]]:
    client = _client(settings)
    if client is None:
        return []
    return await client.select_many(
        TABLE,
        filters={"supabase_user_id": supabase_user_id},
        limit=40,
        order="updated_at.desc",
    )


async def delete_sessions_for_user(
    supabase_user_id: str,
    settings: Settings | None = None,
) -> bool:
    client = _client(settings)
    if client is None:
        return False
    return await client.delete_rows(TABLE, filters={"supabase_user_id": supabase_user_id})


def _premium_patch_values(
    is_premium: bool,
    *,
    premium_source: str | None = None,
    premium_expires_at: datetime | None = None,
    clear_expires: bool = False,
) -> dict[str, Any]:
    values: dict[str, Any] = {"is_premium": is_premium}
    if premium_source is not None:
        values["premium_source"] = premium_source
    if clear_expires or (not is_premium and premium_expires_at is None):
        values["premium_expires_at"] = None
    elif premium_expires_at is not None:
        values["premium_expires_at"] = premium_expires_at.isoformat()
    return values


def _apply_premium_to_bucket(
    bkt: SessionBucket,
    is_premium: bool,
    *,
    premium_source: str | None = None,
    premium_expires_at: datetime | None = None,
    clear_expires: bool = False,
) -> None:
    bkt.is_premium = is_premium
    if premium_source is not None:
        bkt.premium_source = premium_source
    if clear_expires or (not is_premium and premium_expires_at is None):
        bkt.premium_expires_at = None
    elif premium_expires_at is not None:
        bkt.premium_expires_at = premium_expires_at


async def set_premium_by_user(
    supabase_user_id: str,
    is_premium: bool,
    settings: Settings | None = None,
    *,
    premium_source: str | None = None,
    premium_expires_at: datetime | None = None,
    clear_expires: bool = False,
) -> bool:
    """Called by billing webhooks to update premium status server-side."""
    client = _client(settings)
    if client is None:
        return False
    values = _premium_patch_values(
        is_premium,
        premium_source=premium_source,
        premium_expires_at=premium_expires_at,
        clear_expires=clear_expires,
    )
    ok = await client.patch(
        TABLE,
        filters={"supabase_user_id": supabase_user_id},
        values=values,
    )
    from app.services.bucket_store import _BUCKETS

    alias_key = f"user:{supabase_user_id}"
    if alias_key in _BUCKETS:
        _apply_premium_to_bucket(
            _BUCKETS[alias_key],
            is_premium,
            premium_source=premium_source,
            premium_expires_at=premium_expires_at,
            clear_expires=clear_expires,
        )
    return ok


async def set_premium_by_session(
    session_id: str,
    is_premium: bool,
    settings: Settings | None = None,
    *,
    premium_source: str | None = None,
    premium_expires_at: datetime | None = None,
    clear_expires: bool = False,
) -> bool:
    """Called by billing webhooks when the app_user_id is a session_id."""
    client = _client(settings)
    if client is None:
        return False
    values = _premium_patch_values(
        is_premium,
        premium_source=premium_source,
        premium_expires_at=premium_expires_at,
        clear_expires=clear_expires,
    )
    ok = await client.patch(
        TABLE,
        filters={"session_id": session_id},
        values=values,
    )
    from app.services.bucket_store import _BUCKETS

    if session_id in _BUCKETS:
        _apply_premium_to_bucket(
            _BUCKETS[session_id],
            is_premium,
            premium_source=premium_source,
            premium_expires_at=premium_expires_at,
            clear_expires=clear_expires,
        )
    return ok
"""Persist session buckets to Supabase when configured."""

from __future__ import annotations

import logging
from typing import Any

from app.config import Settings, get_settings
from app.schemas.palm import PalmAnalysis
from app.schemas.predictions import PredictionsResponse
from app.schemas.report import FullReport
from app.services.bucket_store import SessionBucket
from app.services.supabase_rest import SupabaseRest, rest_client

logger = logging.getLogger(__name__)

TABLE = "agastya_sessions"


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

    return SessionBucket(
        palm=palm,
        preview=preview,
        full=full,
        chat_tail=chat_tail if isinstance(chat_tail, list) else [],
        predictions=predictions,
        meta={k: v for k, v in meta.items() if v is not None},
        is_premium=bool(row.get("is_premium", False)),
    )


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
    return await client.patch(
        TABLE,
        filters={"session_id": anonymous_session_id},
        values={"supabase_user_id": supabase_user_id},
    )


async def set_premium_by_user(
    supabase_user_id: str,
    is_premium: bool,
    settings: Settings | None = None,
) -> bool:
    """Called by RevenueCat webhook to update premium status server-side."""
    client = _client(settings)
    if client is None:
        return False
    ok = await client.patch(
        TABLE,
        filters={"supabase_user_id": supabase_user_id},
        values={"is_premium": is_premium},
    )
    # Also update the in-memory bucket if loaded.
    from app.services.bucket_store import _BUCKETS
    alias_key = f"user:{supabase_user_id}"
    if alias_key in _BUCKETS:
        _BUCKETS[alias_key].is_premium = is_premium
    return ok


async def set_premium_by_session(
    session_id: str,
    is_premium: bool,
    settings: Settings | None = None,
) -> bool:
    """Called by RevenueCat webhook when the app_user_id is a session_id."""
    client = _client(settings)
    if client is None:
        return False
    ok = await client.patch(
        TABLE,
        filters={"session_id": session_id},
        values={"is_premium": is_premium},
    )
    from app.services.bucket_store import _BUCKETS
    if session_id in _BUCKETS:
        _BUCKETS[session_id].is_premium = is_premium
    return ok

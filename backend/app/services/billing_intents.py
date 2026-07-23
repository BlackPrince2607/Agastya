"""Checkout intent persistence for Razorpay / hosted billing."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from app.config import Settings
from app.services.supabase_rest import rest_client

logger = logging.getLogger(__name__)

TABLE = "billing_checkout_intents"
PLAY_TABLE = "billing_play_reports"


async def create_checkout_intent(
    settings: Settings,
    *,
    session_id: str,
    device_install_id: str,
    supabase_user_id: str | None,
    provider: str,
    billing_period: str,
    amount: int,
    currency: str,
    success_url: str | None,
    cancel_url: str | None,
    external_transaction_token: str | None = None,
    administrative_area: str | None = None,
) -> dict[str, Any] | None:
    client = rest_client(settings)
    intent_id = str(uuid.uuid4())
    row = {
        "id": intent_id,
        "session_id": session_id,
        "device_install_id": device_install_id,
        "supabase_user_id": supabase_user_id,
        "provider": provider,
        "billing_period": billing_period,
        "amount": amount,
        "currency": currency,
        "external_transaction_token": external_transaction_token,
        "administrative_area": administrative_area,
        "status": "pending",
        "success_url": success_url,
        "cancel_url": cancel_url,
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
    }
    if client is None:
        return row
    result = await client.upsert(TABLE, row, on_conflict="id")
    return result or row


async def attach_payment_link(settings: Settings, intent_id: str, payment_link_id: str) -> bool:
    client = rest_client(settings)
    if client is None:
        return False
    return await client.patch(
        TABLE,
        filters={"id": intent_id},
        values={"razorpay_payment_link_id": payment_link_id},
    )


async def get_intent_by_id(settings: Settings, intent_id: str) -> dict[str, Any] | None:
    client = rest_client(settings)
    if client is None:
        return None
    return await client.select_one(TABLE, filters={"id": intent_id})


async def get_intent_by_payment_link(settings: Settings, payment_link_id: str) -> dict[str, Any] | None:
    client = rest_client(settings)
    if client is None:
        return None
    return await client.select_one(TABLE, filters={"razorpay_payment_link_id": payment_link_id})


async def mark_intent_paid(settings: Settings, intent_id: str) -> bool:
    client = rest_client(settings)
    if client is None:
        return False
    return await client.patch(
        TABLE,
        filters={"id": intent_id},
        values={"status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()},
    )


async def mark_intent_expired(settings: Settings, intent_id: str) -> bool:
    client = rest_client(settings)
    if client is None:
        return False
    return await client.patch(
        TABLE,
        filters={"id": intent_id},
        values={"status": "expired"},
    )


async def enqueue_play_report(
    settings: Settings,
    *,
    checkout_intent_id: str | None,
    external_transaction_token: str,
) -> None:
    client = rest_client(settings)
    if client is None or not external_transaction_token:
        return
    try:
        from app.services.supabase_rest import _http_client

        headers = {**client._headers, "Prefer": "return=minimal"}
        payload: dict[str, Any] = {"external_transaction_token": external_transaction_token}
        if checkout_intent_id:
            payload["checkout_intent_id"] = checkout_intent_id
        res = await _http_client().post(f"{client._base}/{PLAY_TABLE}", headers=headers, json=payload)
        if res.status_code not in (200, 201, 204):
            logger.warning("billing_play_reports insert failed: %s", res.status_code)
    except Exception as exc:
        logger.warning("enqueue_play_report failed: %s", exc)


async def mark_play_report_done(
    settings: Settings,
    *,
    external_transaction_token: str,
) -> bool:
    client = rest_client(settings)
    if client is None:
        return False
    return await client.patch(
        PLAY_TABLE,
        filters={"external_transaction_token": external_transaction_token},
        values={"reported_at": datetime.now(timezone.utc).isoformat(), "error": None},
    )


async def mark_play_report_error(
    settings: Settings,
    *,
    external_transaction_token: str,
    error: str,
) -> bool:
    """Record last error without setting reported_at (keeps row pending for cron)."""
    client = rest_client(settings)
    if client is None:
        return False
    return await client.patch(
        PLAY_TABLE,
        filters={"external_transaction_token": external_transaction_token},
        values={"error": error[:500]},
    )


async def list_pending_play_reports(settings: Settings, *, limit: int = 50) -> list[dict[str, Any]]:
    client = rest_client(settings)
    if client is None:
        return []
    # PostgREST: reported_at is null
    try:
        from app.services.supabase_rest import _http_client

        params = {
            "select": "*",
            "reported_at": "is.null",
            "order": "created_at.asc",
            "limit": str(limit),
        }
        res = await _http_client().get(
            f"{client._base}/{PLAY_TABLE}",
            headers=client._headers,
            params=params,
        )
        if res.status_code != 200:
            return []
        rows = res.json()
        return rows if isinstance(rows, list) else []
    except Exception as exc:
        logger.warning("list_pending_play_reports failed: %s", exc)
        return []

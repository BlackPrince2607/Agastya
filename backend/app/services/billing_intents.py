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


async def attach_subscription(settings: Settings, intent_id: str, subscription_id: str) -> bool:
    client = rest_client(settings)
    if client is None:
        return False
    return await client.patch(
        TABLE,
        filters={"id": intent_id},
        values={"razorpay_subscription_id": subscription_id},
    )


async def get_intent_by_subscription(
    settings: Settings, subscription_id: str
) -> dict[str, Any] | None:
    client = rest_client(settings)
    if client is None:
        return None
    return await client.select_one(TABLE, filters={"razorpay_subscription_id": subscription_id})


async def list_paid_subscription_intents(
    settings: Settings, *, supabase_user_id: str | None, session_id: str | None
) -> list[dict[str, Any]]:
    """Paid Razorpay subscription intents for the account and/or session, newest first."""
    client = rest_client(settings)
    if client is None:
        return []
    filters_list: list[dict[str, str]] = []
    if supabase_user_id:
        filters_list.append({"supabase_user_id": str(supabase_user_id), "status": "paid"})
    if session_id:
        filters_list.append({"session_id": session_id, "status": "paid"})
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for filters in filters_list:
        rows = await client.select_many(TABLE, filters=filters, limit=20, order="created_at.desc")
        for row in rows:
            sub_id = row.get("razorpay_subscription_id")
            if sub_id and sub_id not in seen:
                seen.add(sub_id)
                out.append(row)
    out.sort(key=lambda r: str(r.get("created_at") or ""), reverse=True)
    return out


async def get_latest_paid_subscription_intent(
    settings: Settings, *, supabase_user_id: str | None, session_id: str | None
) -> dict[str, Any] | None:
    """Most recent paid Razorpay subscription for the account (falls back to session)."""
    rows = await list_paid_subscription_intents(
        settings, supabase_user_id=supabase_user_id, session_id=session_id
    )
    return rows[0] if rows else None


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


async def get_latest_intent_for_session(
    settings: Settings, session_id: str, *, provider: str = "razorpay"
) -> dict[str, Any] | None:
    client = rest_client(settings)
    if client is None:
        return None
    rows = await client.select_many(
        TABLE,
        filters={"session_id": session_id, "provider": provider},
        limit=1,
        order="created_at.desc",
    )
    return rows[0] if rows else None


async def mark_intent_paid(
    settings: Settings,
    intent_id: str,
    *,
    razorpay_payment_id: str | None = None,
) -> bool:
    client = rest_client(settings)
    if client is None:
        return False
    values: dict[str, Any] = {
        "status": "paid",
        "paid_at": datetime.now(timezone.utc).isoformat(),
    }
    if razorpay_payment_id:
        values["razorpay_payment_id"] = str(razorpay_payment_id).strip()
    return await client.patch(
        TABLE,
        filters={"id": intent_id},
        values=values,
    )


async def attach_payment_id(settings: Settings, intent_id: str, payment_id: str) -> bool:
    """Persist Razorpay payment id for refund / dispute resolution."""
    if not payment_id or not str(payment_id).strip():
        return False
    client = rest_client(settings)
    if client is None:
        return False
    return await client.patch(
        TABLE,
        filters={"id": intent_id},
        values={"razorpay_payment_id": str(payment_id).strip()},
    )


async def get_intent_by_payment_id(settings: Settings, payment_id: str) -> dict[str, Any] | None:
    client = rest_client(settings)
    if client is None:
        return None
    return await client.select_one(
        TABLE, filters={"razorpay_payment_id": str(payment_id).strip()}
    )


async def resolve_intent_for_payment(
    settings: Settings,
    *,
    checkout_intent_id: str | None = None,
    payment_id: str | None = None,
    payment_link_id: str | None = None,
) -> dict[str, Any] | None:
    """Resolve checkout intent without relying solely on Razorpay notes."""
    if checkout_intent_id:
        intent = await get_intent_by_id(settings, str(checkout_intent_id))
        if intent:
            return intent
    if payment_id:
        intent = await get_intent_by_payment_id(settings, str(payment_id))
        if intent:
            return intent
    if payment_link_id:
        intent = await get_intent_by_payment_link(settings, str(payment_link_id))
        if intent:
            return intent
    return None


async def report_play_external_for_intent(
    settings: Settings,
    intent: dict[str, Any] | None,
    *,
    payment_id: str | None = None,
    amount_paise: int | None = None,
) -> None:
    """Enqueue + report Google Play ExternalTransactions for a paid Razorpay intent.

    Shared by webhook and confirm-payment so confirm-only unlocks still satisfy
    Play User Choice reporting requirements.
    """
    if not intent:
        return
    token = intent.get("external_transaction_token")
    if not token:
        return

    if await play_report_already_done(settings, str(token)):
        return

    from app.services import play_external_transactions

    intent_id = str(intent["id"]) if intent.get("id") else None
    await enqueue_play_report(
        settings,
        checkout_intent_id=intent_id,
        external_transaction_token=str(token),
    )
    paise = int(amount_paise if amount_paise is not None else (intent.get("amount") or 0))
    micros = max(paise, 0) * 10_000
    administrative_area = intent.get("administrative_area")
    report_id = intent_id or (str(payment_id).strip() if payment_id else None) or str(token)
    ok = await play_external_transactions.report_external_transaction(
        settings,
        external_transaction_id=report_id,
        external_transaction_token=str(token),
        amount_micros=micros or 1,
        currency=str(intent.get("currency") or "INR"),
        administrative_area=str(administrative_area) if administrative_area else None,
    )
    if ok:
        await mark_play_report_done(settings, external_transaction_token=str(token))


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
        existing = await client.select_one(
            PLAY_TABLE,
            filters={"external_transaction_token": external_transaction_token},
            columns="id,reported_at",
        )
        if existing:
            return
        from app.services.supabase_rest import _http_client

        headers = {**client._headers, "Prefer": "return=minimal"}
        payload: dict[str, Any] = {"external_transaction_token": external_transaction_token}
        if checkout_intent_id:
            payload["checkout_intent_id"] = checkout_intent_id
        res = await _http_client().post(f"{client._base}/{PLAY_TABLE}", headers=headers, json=payload)
        if res.status_code not in (200, 201, 204):
            # Concurrent insert race — ignore unique/duplicate style failures.
            body = (res.text or "").lower()
            if res.status_code == 409 or "duplicate" in body or "23505" in body:
                return
            logger.warning("billing_play_reports insert failed: %s", res.status_code)
    except Exception as exc:
        logger.warning("enqueue_play_report failed: %s", exc)


async def play_report_already_done(settings: Settings, external_transaction_token: str) -> bool:
    client = rest_client(settings)
    if client is None or not external_transaction_token:
        return False
    row = await client.select_one(
        PLAY_TABLE,
        filters={"external_transaction_token": external_transaction_token},
        columns="reported_at",
    )
    return bool(row and row.get("reported_at"))


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

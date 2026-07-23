"""Razorpay and Google Play RTDN webhook handlers — server-side premium status."""

from __future__ import annotations

import base64
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from app.config import Settings, get_settings
from app.services import billing_idempotency, billing_intents, session_repository
from app.services import play_external_transactions, play_purchase_verify, razorpay_client

logger = logging.getLogger(__name__)

router = APIRouter(tags=["webhooks"])

# Google Play RTDN notification types (subscriptions).
_RTDN_GRANT_TYPES = {1, 2, 4, 7}  # RECOVERED, RENEWED, PURCHASED, RESTARTED
_RTDN_REVOKE_TYPES = {12, 13}  # REVOKED, EXPIRED
_RTDN_GRACE_TYPES = {6}  # IN_GRACE_PERIOD


async def _apply_premium_to_ids(
    settings: Settings,
    session_id: str | None,
    supabase_user_id: str | None,
    is_premium: bool,
    source: str,
    *,
    premium_source: str | None = None,
    premium_expires_at: datetime | None = None,
    clear_expires: bool = False,
) -> None:
    kwargs = {
        "premium_source": premium_source,
        "premium_expires_at": premium_expires_at,
        "clear_expires": clear_expires,
    }
    if session_id:
        ok = await session_repository.set_premium_by_session(
            session_id, is_premium, settings, **kwargs
        )
        if ok:
            logger.info("%s → session_id=%s is_premium=%s", source, session_id, is_premium)
    if supabase_user_id and len(supabase_user_id) == 36 and supabase_user_id.count("-") == 4:
        ok_user = await session_repository.set_premium_by_user(
            supabase_user_id, is_premium, settings, **kwargs
        )
        if ok_user:
            logger.info(
                "%s → supabase_user_id=%s is_premium=%s",
                source,
                supabase_user_id,
                is_premium,
            )


@router.post("/webhooks/razorpay", status_code=200)
async def razorpay_webhook(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    x_razorpay_signature: Annotated[str | None, Header(alias="X-Razorpay-Signature")] = None,
) -> dict[str, str]:
    if not settings.razorpay_webhook_secret:
        if settings.debug:
            logger.warning("RAZORPAY_WEBHOOK_SECRET not set — skipping verification (DEBUG only)")
        else:
            raise HTTPException(status_code=503, detail="Razorpay webhooks not configured")

    body = await request.body()
    if settings.razorpay_webhook_secret:
        if not razorpay_client.verify_webhook_signature(
            body, x_razorpay_signature, settings.razorpay_webhook_secret
        ):
            if not settings.debug:
                raise HTTPException(status_code=401, detail="Invalid Razorpay signature")
            logger.warning("Razorpay signature mismatch (DEBUG allowing)")

    try:
        payload: dict[str, Any] = json.loads(body)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    event_type = str(payload.get("event") or "")
    pl = payload.get("payload") or {}

    payment_entity: dict[str, Any] = (pl.get("payment") or {}).get("entity") or {}
    link_entity: dict[str, Any] = (pl.get("payment_link") or {}).get("entity") or {}
    payment_id = str(payment_entity.get("id") or "").strip()
    payment_link_id = str(link_entity.get("id") or "").strip() or None

    event_id = payment_id or payment_link_id or str(payload.get("id") or "").strip()
    if not event_id:
        logger.warning("Razorpay webhook missing stable event id type=%s", event_type)
        if not settings.debug:
            return {"status": "ignored"}
        event_id = f"razorpay:{event_type}:debug"

    if not await billing_idempotency.claim_webhook_event("razorpay", event_id, settings):
        return {"status": "duplicate"}

    if event_type == "payment_link.expired":
        intent_id = None
        if isinstance(link_entity.get("notes"), dict):
            intent_id = link_entity["notes"].get("checkout_intent_id")
        if not intent_id and payment_link_id:
            intent = await billing_intents.get_intent_by_payment_link(settings, payment_link_id)
            if intent:
                intent_id = intent.get("id")
        if intent_id:
            await billing_intents.mark_intent_expired(settings, str(intent_id))
        return {"status": "ok"}

    if event_type in {"refund.processed", "payment.dispute.created", "payment.dispute.won"}:
        notes = payment_entity.get("notes") if isinstance(payment_entity.get("notes"), dict) else {}
        session_id = notes.get("session_id") if notes else None
        supabase_user_id = notes.get("supabase_user_id") if notes else None
        intent_id = notes.get("checkout_intent_id") if notes else None
        intent = None
        if intent_id:
            intent = await billing_intents.get_intent_by_id(settings, str(intent_id))
        if intent:
            session_id = session_id or intent.get("session_id")
            supabase_user_id = supabase_user_id or intent.get("supabase_user_id")
        if session_id or supabase_user_id:
            await _apply_premium_to_ids(
                settings,
                str(session_id) if session_id else None,
                str(supabase_user_id) if supabase_user_id else None,
                False,
                f"Razorpay {event_type}",
                clear_expires=True,
            )
            return {"status": "ok"}
        logger.warning("Razorpay %s missing session/user — ignored", event_type)
        return {"status": "ignored"}

    if event_type not in {"payment.captured", "payment_link.paid"}:
        logger.info("Razorpay webhook event %s — ignored", event_type)
        return {"status": "ignored"}

    notes: dict[str, Any] = {}
    amount_paise = 0

    if event_type == "payment_link.paid":
        notes = link_entity.get("notes") if isinstance(link_entity.get("notes"), dict) else {}
        amount_paise = int(link_entity.get("amount_paid") or link_entity.get("amount") or 0)
        if not payment_link_id:
            payment_link_id = str(link_entity.get("id") or "") or None
    else:
        notes = payment_entity.get("notes") if isinstance(payment_entity.get("notes"), dict) else {}
        amount_paise = int(payment_entity.get("amount") or 0)
        raw_link = payment_entity.get("payment_link_id") or notes.get("payment_link_id")
        if raw_link:
            payment_link_id = str(raw_link)

    intent = None
    intent_id = notes.get("checkout_intent_id") if notes else None
    if intent_id:
        intent = await billing_intents.get_intent_by_id(settings, str(intent_id))
    if not intent and payment_link_id:
        intent = await billing_intents.get_intent_by_payment_link(settings, str(payment_link_id))

    session_id = None
    supabase_user_id = None
    billing_period = "monthly"
    external_token = None
    administrative_area = None

    if intent:
        session_id = intent.get("session_id")
        supabase_user_id = intent.get("supabase_user_id")
        billing_period = intent.get("billing_period") or "monthly"
        external_token = intent.get("external_transaction_token")
        administrative_area = intent.get("administrative_area")
        amount_paise = int(intent.get("amount") or amount_paise)
        await billing_intents.mark_intent_paid(settings, str(intent["id"]))
    elif notes:
        session_id = notes.get("session_id")
        supabase_user_id = notes.get("supabase_user_id")
        billing_period = notes.get("billing_period") or notes.get("plan") or "monthly"
        external_token = notes.get("external_transaction_token")

    if not session_id and not supabase_user_id:
        logger.warning("Razorpay webhook missing session/user identifiers")
        return {"status": "ignored"}

    days = razorpay_client.premium_expiry_days(str(billing_period))
    expires = datetime.now(timezone.utc) + timedelta(days=days)

    await _apply_premium_to_ids(
        settings,
        str(session_id) if session_id else None,
        str(supabase_user_id) if supabase_user_id else None,
        True,
        f"Razorpay {event_type}",
        premium_source="razorpay",
        premium_expires_at=expires,
    )

    if external_token:
        report_id = str(intent["id"]) if intent else (payment_id or event_id)
        await billing_intents.enqueue_play_report(
            settings,
            checkout_intent_id=str(intent["id"]) if intent else None,
            external_transaction_token=str(external_token),
        )
        micros = int(amount_paise) * 10_000
        ok = await play_external_transactions.report_external_transaction(
            settings,
            external_transaction_id=report_id,
            external_transaction_token=str(external_token),
            amount_micros=micros,
            currency="INR",
            administrative_area=str(administrative_area) if administrative_area else None,
        )
        if ok:
            await billing_intents.mark_play_report_done(
                settings, external_transaction_token=str(external_token)
            )

    return {"status": "ok"}


def _verify_rtdn_token(token: str | None, settings: Settings) -> bool:
    expected = settings.google_play_rtdn_verification_token
    if not expected:
        if settings.debug:
            logger.warning("GOOGLE_PLAY_RTDN_VERIFICATION_TOKEN unset — skipping (DEBUG only)")
            return True
        return False
    if not token:
        return False
    return token.strip() == expected.strip()


@router.post("/webhooks/google-play", status_code=200)
async def google_play_rtdn_webhook(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, str]:
    """Real-Time Developer Notifications (Pub/Sub push) for Play subscription lifecycle.

    Required for Google Play Billing subscriptions: renewals, cancellations, revocations.
    """
    body = await request.body()
    try:
        envelope: dict[str, Any] = json.loads(body)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    token = request.query_params.get("token")
    if not _verify_rtdn_token(token, settings):
        raise HTTPException(status_code=401, detail="Invalid RTDN verification token")

    message = envelope.get("message") or {}
    message_id = str(message.get("messageId") or "")
    if message_id:
        if not await billing_idempotency.claim_webhook_event("google_play", message_id, settings):
            return {"status": "duplicate"}

    data_b64 = message.get("data")
    if not data_b64:
        return {"status": "ignored"}

    try:
        decoded = json.loads(base64.b64decode(data_b64))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid RTDN payload") from exc

    sub_note = decoded.get("subscriptionNotification") or {}
    notification_type = int(sub_note.get("notificationType") or 0)
    purchase_token = str(sub_note.get("purchaseToken") or "")

    if not purchase_token:
        test_note = decoded.get("testNotification")
        if test_note:
            logger.info("Google Play RTDN test notification received")
            return {"status": "ok"}
        return {"status": "ignored"}

    session_id = await play_purchase_verify.get_session_for_purchase_token(
        settings, purchase_token
    )
    if not session_id:
        logger.warning("RTDN purchase token not mapped to session")
        return {"status": "ignored"}

    if notification_type in _RTDN_GRANT_TYPES | _RTDN_GRACE_TYPES:
        product_id = str(sub_note.get("subscriptionId") or "premium_monthly")
        sub = await play_purchase_verify.verify_subscription_purchase(
            settings,
            purchase_token=purchase_token,
            product_id=product_id,
        )
        is_premium = sub is not None
        expires: datetime | None = None
        if sub:
            line_items = sub.get("lineItems") or []
            if line_items and line_items[0].get("expiryTime"):
                try:
                    expires = datetime.fromisoformat(
                        str(line_items[0]["expiryTime"]).replace("Z", "+00:00")
                    )
                except ValueError:
                    pass
        await _apply_premium_to_ids(
            settings,
            session_id,
            None,
            is_premium,
            f"Google Play RTDN type={notification_type}",
            premium_source="google_play" if is_premium else None,
            premium_expires_at=expires,
            clear_expires=not is_premium,
        )
        return {"status": "ok"}

    if notification_type in _RTDN_REVOKE_TYPES:
        await _apply_premium_to_ids(
            settings,
            session_id,
            None,
            False,
            f"Google Play RTDN type={notification_type}",
            clear_expires=True,
        )
        return {"status": "ok"}

    # CANCELED (3) — keep premium until expiry; verify current state.
    if notification_type == 3:
        product_id = str(sub_note.get("subscriptionId") or "premium_monthly")
        sub = await play_purchase_verify.verify_subscription_purchase(
            settings,
            purchase_token=purchase_token,
            product_id=product_id,
        )
        is_premium = sub is not None
        await _apply_premium_to_ids(
            settings,
            session_id,
            None,
            is_premium,
            "Google Play RTDN cancellation",
            premium_source="google_play" if is_premium else None,
            clear_expires=not is_premium,
        )
        return {"status": "ok"}

    logger.info("Google Play RTDN notification type=%s — ignored", notification_type)
    return {"status": "ignored"}

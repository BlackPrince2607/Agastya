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
from app.services import play_purchase_verify, razorpay_client

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
) -> bool:
    """Apply premium change. Returns True if at least one write succeeded (or nothing to write)."""
    kwargs = {
        "premium_source": premium_source,
        "premium_expires_at": premium_expires_at,
        "clear_expires": clear_expires,
    }
    wrote = False
    attempted = False
    if session_id:
        attempted = True
        ok = await session_repository.set_premium_by_session(
            session_id, is_premium, settings, **kwargs
        )
        if ok:
            wrote = True
            logger.info("%s → session_id=%s is_premium=%s", source, session_id, is_premium)
    if supabase_user_id and len(supabase_user_id) == 36 and supabase_user_id.count("-") == 4:
        attempted = True
        ok_user = await session_repository.set_premium_by_user(
            supabase_user_id, is_premium, settings, **kwargs
        )
        if ok_user:
            wrote = True
            logger.info(
                "%s → supabase_user_id=%s is_premium=%s",
                source,
                supabase_user_id,
                is_premium,
            )
    if not attempted:
        return False
    return wrote or not settings.supabase_enabled


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
    payment_id = str(payment_entity.get("id") or "").strip() or None
    payment_link_id = str(link_entity.get("id") or "").strip() or None

    if event_type == "payment_link.expired":
        return await _handle_payment_link_expired(
            settings, link_entity=link_entity, payment_link_id=payment_link_id
        )

    if event_type in {"refund.processed", "payment.dispute.created", "payment.dispute.won"}:
        return await _handle_razorpay_revoke(
            settings,
            event_type=event_type,
            payment_entity=payment_entity,
            link_entity=link_entity,
            payment_id=payment_id,
            payment_link_id=payment_link_id,
        )

    if event_type in {"payment.captured", "payment_link.paid"}:
        return await _handle_razorpay_paid(
            settings,
            event_type=event_type,
            payment_entity=payment_entity,
            link_entity=link_entity,
            payment_id=payment_id,
            payment_link_id=payment_link_id,
        )

    logger.info("Razorpay webhook event %s — ignored", event_type)
    return {"status": "ignored"}


async def _handle_payment_link_expired(
    settings: Settings,
    *,
    link_entity: dict[str, Any],
    payment_link_id: str | None,
) -> dict[str, str]:
    event_key = f"plink:{(payment_link_id or link_entity.get('id') or 'unknown')}:expired"
    claim, claimed = await billing_idempotency.begin_webhook_events(
        "razorpay", [event_key], settings
    )
    if claim == "duplicate":
        return {"status": "duplicate"}
    if claim == "unavailable":
        raise HTTPException(status_code=503, detail="Webhook idempotency unavailable")

    try:
        intent_id = None
        if isinstance(link_entity.get("notes"), dict):
            intent_id = link_entity["notes"].get("checkout_intent_id")
        intent = await billing_intents.resolve_intent_for_payment(
            settings,
            checkout_intent_id=str(intent_id) if intent_id else None,
            payment_link_id=payment_link_id,
        )
        if intent and intent.get("id"):
            await billing_intents.mark_intent_expired(settings, str(intent["id"]))
        await billing_idempotency.complete_webhook_events("razorpay", claimed, settings)
        return {"status": "ok"}
    except Exception:
        await billing_idempotency.fail_webhook_events("razorpay", claimed, settings)
        raise


async def _handle_razorpay_revoke(
    settings: Settings,
    *,
    event_type: str,
    payment_entity: dict[str, Any],
    link_entity: dict[str, Any],
    payment_id: str | None,
    payment_link_id: str | None,
) -> dict[str, str]:
    notes = payment_entity.get("notes") if isinstance(payment_entity.get("notes"), dict) else {}
    raw_link = (
        payment_link_id
        or payment_entity.get("payment_link_id")
        or (notes.get("payment_link_id") if notes else None)
        or link_entity.get("id")
    )
    plink = str(raw_link).strip() if raw_link else None

    event_key = f"{event_type}:{payment_id or plink or 'unknown'}"
    claim, claimed = await billing_idempotency.begin_webhook_events(
        "razorpay", [event_key], settings
    )
    if claim == "duplicate":
        return {"status": "duplicate"}
    if claim == "unavailable":
        raise HTTPException(status_code=503, detail="Webhook idempotency unavailable")

    try:
        intent_id = notes.get("checkout_intent_id") if notes else None
        intent = await billing_intents.resolve_intent_for_payment(
            settings,
            checkout_intent_id=str(intent_id) if intent_id else None,
            payment_id=payment_id,
            payment_link_id=plink,
        )

        session_id = (notes.get("session_id") if notes else None) or (
            intent.get("session_id") if intent else None
        )
        supabase_user_id = (notes.get("supabase_user_id") if notes else None) or (
            intent.get("supabase_user_id") if intent else None
        )

        if not session_id and not supabase_user_id:
            logger.warning(
                "Razorpay %s missing session/user after intent lookup payment_id=%s plink=%s",
                event_type,
                payment_id,
                plink,
            )
            # Nothing to revoke — complete so we do not retry forever.
            await billing_idempotency.complete_webhook_events("razorpay", claimed, settings)
            return {"status": "ignored"}

        ok = await _apply_premium_to_ids(
            settings,
            str(session_id) if session_id else None,
            str(supabase_user_id) if supabase_user_id else None,
            False,
            f"Razorpay {event_type}",
            clear_expires=True,
        )
        if not ok and settings.supabase_enabled and not settings.debug:
            await billing_idempotency.fail_webhook_events("razorpay", claimed, settings)
            raise HTTPException(status_code=500, detail="Failed to revoke premium")

        await billing_idempotency.complete_webhook_events("razorpay", claimed, settings)
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception:
        await billing_idempotency.fail_webhook_events("razorpay", claimed, settings)
        raise


async def _handle_razorpay_paid(
    settings: Settings,
    *,
    event_type: str,
    payment_entity: dict[str, Any],
    link_entity: dict[str, Any],
    payment_id: str | None,
    payment_link_id: str | None,
) -> dict[str, str]:
    notes: dict[str, Any] = {}
    amount_paise = 0

    if event_type == "payment_link.paid":
        notes = link_entity.get("notes") if isinstance(link_entity.get("notes"), dict) else {}
        amount_paise = int(link_entity.get("amount_paid") or link_entity.get("amount") or 0)
        if not payment_link_id:
            payment_link_id = str(link_entity.get("id") or "") or None
        # payment_link.paid payloads often include the payment entity as well.
        if not payment_id:
            payment_id = str(payment_entity.get("id") or "").strip() or None
    else:
        notes = payment_entity.get("notes") if isinstance(payment_entity.get("notes"), dict) else {}
        amount_paise = int(payment_entity.get("amount") or 0)
        raw_link = payment_entity.get("payment_link_id") or (notes.get("payment_link_id") if notes else None)
        if raw_link:
            payment_link_id = str(raw_link)

    keys = billing_idempotency.razorpay_paid_idempotency_keys(payment_id, payment_link_id)
    if not keys:
        # Fall back to Razorpay event id so we still process once.
        fallback = str(payment_entity.get("id") or link_entity.get("id") or "").strip()
        if not fallback:
            logger.warning("Razorpay %s missing stable payment/link id", event_type)
            if not settings.debug:
                raise HTTPException(status_code=400, detail="Missing payment identifiers")
            keys = [f"razorpay:{event_type}:debug"]
        else:
            keys = [fallback]

    claim, claimed = await billing_idempotency.begin_webhook_events("razorpay", keys, settings)
    if claim == "duplicate":
        return {"status": "duplicate"}
    if claim == "unavailable":
        raise HTTPException(status_code=503, detail="Webhook idempotency unavailable")

    try:
        intent_id = notes.get("checkout_intent_id") if notes else None
        intent = await billing_intents.resolve_intent_for_payment(
            settings,
            checkout_intent_id=str(intent_id) if intent_id else None,
            payment_id=payment_id,
            payment_link_id=payment_link_id,
        )

        session_id = None
        supabase_user_id = None
        billing_period = "monthly"

        if intent:
            session_id = intent.get("session_id")
            supabase_user_id = intent.get("supabase_user_id")
            billing_period = intent.get("billing_period") or "monthly"
            amount_paise = int(intent.get("amount") or amount_paise)
            await billing_intents.mark_intent_paid(
                settings,
                str(intent["id"]),
                razorpay_payment_id=payment_id,
            )
        elif notes:
            session_id = notes.get("session_id")
            supabase_user_id = notes.get("supabase_user_id")
            billing_period = notes.get("billing_period") or notes.get("plan") or "monthly"

        if not session_id and not supabase_user_id:
            logger.warning(
                "Razorpay webhook missing session/user identifiers event=%s payment_id=%s plink=%s",
                event_type,
                payment_id,
                payment_link_id,
            )
            await billing_idempotency.fail_webhook_events("razorpay", claimed, settings)
            raise HTTPException(status_code=500, detail="Missing session identifiers")

        days = razorpay_client.premium_expiry_days(str(billing_period))
        expires = datetime.now(timezone.utc) + timedelta(days=days)

        ok = await _apply_premium_to_ids(
            settings,
            str(session_id) if session_id else None,
            str(supabase_user_id) if supabase_user_id else None,
            True,
            f"Razorpay {event_type}",
            premium_source="razorpay",
            premium_expires_at=expires,
        )
        if not ok and settings.supabase_enabled and not settings.debug:
            await billing_idempotency.fail_webhook_events("razorpay", claimed, settings)
            raise HTTPException(status_code=500, detail="Failed to grant premium")

        # Play reporting is best-effort here; failures stay in billing_play_reports for cron.
        await billing_intents.report_play_external_for_intent(
            settings,
            intent,
            payment_id=payment_id,
            amount_paise=amount_paise,
        )

        await billing_idempotency.complete_webhook_events("razorpay", claimed, settings)
        # Seal sibling key shapes even if only one was present on this payload.
        for key in billing_idempotency.razorpay_paid_idempotency_keys(payment_id, payment_link_id):
            if key not in claimed:
                await billing_idempotency.ensure_processed_webhook_event(
                    "razorpay", key, settings
                )
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception:
        await billing_idempotency.fail_webhook_events("razorpay", claimed, settings)
        raise


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
    claimed: list[str] = []
    if message_id:
        claim, claimed = await billing_idempotency.begin_webhook_events(
            "google_play", [message_id], settings
        )
        if claim == "duplicate":
            return {"status": "duplicate"}
        if claim == "unavailable":
            raise HTTPException(status_code=503, detail="Webhook idempotency unavailable")

    try:
        data_b64 = message.get("data")
        if not data_b64:
            if claimed:
                await billing_idempotency.complete_webhook_events(
                    "google_play", claimed, settings
                )
            return {"status": "ignored"}

        try:
            decoded = json.loads(base64.b64decode(data_b64))
        except Exception as exc:
            if claimed:
                await billing_idempotency.fail_webhook_events("google_play", claimed, settings)
            raise HTTPException(status_code=400, detail="Invalid RTDN payload") from exc

        sub_note = decoded.get("subscriptionNotification") or {}
        notification_type = int(sub_note.get("notificationType") or 0)
        purchase_token = str(sub_note.get("purchaseToken") or "")

        if not purchase_token:
            test_note = decoded.get("testNotification")
            if test_note:
                logger.info("Google Play RTDN test notification received")
                if claimed:
                    await billing_idempotency.complete_webhook_events(
                        "google_play", claimed, settings
                    )
                return {"status": "ok"}
            if claimed:
                await billing_idempotency.complete_webhook_events(
                    "google_play", claimed, settings
                )
            return {"status": "ignored"}

        session_id = await play_purchase_verify.get_session_for_purchase_token(
            settings, purchase_token
        )
        if not session_id:
            logger.warning("RTDN purchase token not mapped to session")
            if claimed:
                await billing_idempotency.complete_webhook_events(
                    "google_play", claimed, settings
                )
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
            if claimed:
                await billing_idempotency.complete_webhook_events(
                    "google_play", claimed, settings
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
            if claimed:
                await billing_idempotency.complete_webhook_events(
                    "google_play", claimed, settings
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
            if claimed:
                await billing_idempotency.complete_webhook_events(
                    "google_play", claimed, settings
                )
            return {"status": "ok"}

        logger.info("Google Play RTDN notification type=%s — ignored", notification_type)
        if claimed:
            await billing_idempotency.complete_webhook_events(
                "google_play", claimed, settings
            )
        return {"status": "ignored"}
    except HTTPException:
        raise
    except Exception:
        if claimed:
            await billing_idempotency.fail_webhook_events("google_play", claimed, settings)
        raise

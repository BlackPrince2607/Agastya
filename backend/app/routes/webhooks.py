"""RevenueCat and Stripe webhook handlers — server-side premium status."""

from __future__ import annotations

import hmac
import json
import logging
from typing import Annotated, Any

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request

from app.config import Settings, get_settings
from app.services import session_repository

logger = logging.getLogger(__name__)

router = APIRouter(tags=["webhooks"])

_PREMIUM_GRANT_EVENTS = {
    "INITIAL_PURCHASE",
    "RENEWAL",
    "PRODUCT_CHANGE",
    "TRANSFER",
    "UNCANCELLATION",
    "NON_SUBSCRIPTION_PURCHASE",
}

_PREMIUM_REVOKE_EVENTS = {
    "EXPIRATION",
    "BILLING_ISSUE",
}


def _verify_webhook_signature(
    authorization: str | None,
    settings: Settings,
) -> bool:
    secret = settings.revenuecat_webhook_secret
    if not secret:
        if settings.debug:
            logger.warning(
                "REVENUECAT_WEBHOOK_SECRET not set — skipping webhook verification (DEBUG only)"
            )
            return True
        return False

    if not authorization:
        return False

    return hmac.compare_digest(authorization.strip(), secret.strip())


def _resolve_premium_status(event: dict[str, Any], event_type: str) -> bool | None:
    """Return premium bool, or None if event should be ignored."""
    if event_type in _PREMIUM_GRANT_EVENTS:
        return True
    if event_type in _PREMIUM_REVOKE_EVENTS:
        return False
    if event_type == "CANCELLATION":
        expiration_ms = event.get("expiration_at_ms")
        if expiration_ms is not None:
            import time

            return int(expiration_ms) > int(time.time() * 1000)
        return False
    return None


@router.post("/webhooks/revenuecat", status_code=200)
async def revenuecat_webhook(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, str]:
    body = await request.body()

    if not _verify_webhook_signature(authorization, settings):
        raise HTTPException(status_code=401, detail="Invalid webhook authorization")

    try:
        payload: dict[str, Any] = json.loads(body)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    event = payload.get("event", {})
    event_type: str = event.get("type", "")
    app_user_id: str = event.get("app_user_id", "")
    aliases: list[str] = event.get("aliases", [])

    if not app_user_id:
        logger.warning("RevenueCat webhook missing app_user_id for event %s", event_type)
        return {"status": "ignored"}

    is_premium = _resolve_premium_status(event, event_type)
    if is_premium is None:
        logger.info("RevenueCat webhook event %s — no premium action needed", event_type)
        return {"status": "ignored"}

    all_ids = {app_user_id, *aliases}

    for uid in all_ids:
        if len(uid) == 36 and uid.count("-") == 4:
            ok = await session_repository.set_premium_by_user(uid, is_premium, settings)
            if ok:
                logger.info(
                    "RevenueCat %s → supabase_user_id=%s is_premium=%s",
                    event_type,
                    uid,
                    is_premium,
                )
        ok2 = await session_repository.set_premium_by_session(uid, is_premium, settings)
        if ok2:
            logger.info(
                "RevenueCat %s → session_id=%s is_premium=%s",
                event_type,
                uid,
                is_premium,
            )

    return {"status": "ok"}


async def _apply_premium_to_ids(
    settings: Settings,
    session_id: str | None,
    supabase_user_id: str | None,
    is_premium: bool,
    source: str,
) -> None:
    if session_id:
        ok = await session_repository.set_premium_by_session(session_id, is_premium, settings)
        if ok:
            logger.info("%s → session_id=%s is_premium=%s", source, session_id, is_premium)
    if supabase_user_id and len(supabase_user_id) == 36 and supabase_user_id.count("-") == 4:
        ok_user = await session_repository.set_premium_by_user(supabase_user_id, is_premium, settings)
        if ok_user:
            logger.info(
                "%s → supabase_user_id=%s is_premium=%s",
                source,
                supabase_user_id,
                is_premium,
            )


@router.post("/webhooks/stripe", status_code=200)
async def stripe_webhook(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    stripe_signature: Annotated[str | None, Header(alias="Stripe-Signature")] = None,
) -> dict[str, str]:
    if not settings.stripe_webhook_secret:
        if settings.debug:
            logger.warning("STRIPE_WEBHOOK_SECRET not set — skipping verification (DEBUG only)")
        else:
            raise HTTPException(status_code=503, detail="Stripe webhooks not configured")

    body = await request.body()
    try:
        if settings.stripe_webhook_secret and stripe_signature:
            event = stripe.Webhook.construct_event(
                body, stripe_signature, settings.stripe_webhook_secret
            )
        elif settings.debug:
            event = json.loads(body)
        else:
            raise HTTPException(status_code=401, detail="Missing Stripe-Signature")
    except stripe.SignatureVerificationError as exc:
        raise HTTPException(status_code=401, detail="Invalid Stripe signature") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    event_type: str = event.get("type", "")
    data_object: dict[str, Any] = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        metadata = data_object.get("metadata") or {}
        session_id = metadata.get("session_id") or data_object.get("client_reference_id")
        supabase_user_id = metadata.get("supabase_user_id")
        await _apply_premium_to_ids(settings, session_id, supabase_user_id, True, "Stripe checkout")
        return {"status": "ok"}

    if event_type in {"customer.subscription.deleted", "customer.subscription.updated"}:
        status = data_object.get("status")
        is_premium = status in {"active", "trialing"}
        metadata = data_object.get("metadata") or {}
        session_id = metadata.get("session_id")
        supabase_user_id = metadata.get("supabase_user_id")
        if event_type == "customer.subscription.deleted":
            is_premium = False
        await _apply_premium_to_ids(settings, session_id, supabase_user_id, is_premium, f"Stripe {event_type}")
        return {"status": "ok"}

    logger.info("Stripe webhook event %s — no premium action needed", event_type)
    return {"status": "ignored"}

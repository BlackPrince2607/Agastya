"""RevenueCat webhook handler — updates server-side premium status on subscription events."""

from __future__ import annotations

import hmac
import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from app.config import Settings, get_settings
from app.services import session_repository

logger = logging.getLogger(__name__)

router = APIRouter(tags=["webhooks"])

# RevenueCat events that grant premium access
_PREMIUM_GRANT_EVENTS = {
    "INITIAL_PURCHASE",
    "RENEWAL",
    "PRODUCT_CHANGE",
    "TRANSFER",
    "UNCANCELLATION",
    "NON_SUBSCRIPTION_PURCHASE",
}

# RevenueCat events that revoke premium access
_PREMIUM_REVOKE_EVENTS = {
    "EXPIRATION",
    "CANCELLATION",
    "BILLING_ISSUE",
    "SUBSCRIBER_ALIAS",
}


def _verify_webhook_signature(
    body: bytes,
    authorization: str | None,
    settings: Settings,
) -> bool:
    """Verify the RevenueCat webhook Authorization header.

    RevenueCat sends the shared secret in the Authorization header as a plain
    string (not Bearer — just the raw secret value). When REVENUECAT_WEBHOOK_SECRET
    is not configured, we skip verification and log a warning.
    """
    secret = settings.revenuecat_webhook_secret
    if not secret:
        logger.warning(
            "REVENUECAT_WEBHOOK_SECRET not set — skipping webhook signature verification. "
            "Set it in production to prevent spoofed events."
        )
        return True

    if not authorization:
        return False

    # RevenueCat sends the secret as the raw Authorization value
    return hmac.compare_digest(authorization.strip(), secret.strip())


@router.post("/webhooks/revenuecat", status_code=200)
async def revenuecat_webhook(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, str]:
    body = await request.body()

    if not _verify_webhook_signature(body, authorization, settings):
        raise HTTPException(status_code=401, detail="Invalid webhook authorization")

    try:
        import json
        payload: dict[str, Any] = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = payload.get("event", {})
    event_type: str = event.get("type", "")
    app_user_id: str = event.get("app_user_id", "")
    aliases: list[str] = event.get("aliases", [])

    if not app_user_id:
        logger.warning("RevenueCat webhook missing app_user_id for event %s", event_type)
        return {"status": "ignored", "reason": "no app_user_id"}

    grant = event_type in _PREMIUM_GRANT_EVENTS
    revoke = event_type in _PREMIUM_REVOKE_EVENTS

    if not grant and not revoke:
        logger.info("RevenueCat webhook event %s — no premium action needed", event_type)
        return {"status": "ignored", "reason": "non-premium event"}

    is_premium = grant

    # app_user_id can be either a Supabase UUID (when logged in) or an anonymous session_id.
    # We try both lookup strategies, plus all known aliases.
    all_ids = {app_user_id, *aliases}

    updated = False
    for uid in all_ids:
        # Try as supabase_user_id first (UUID format heuristic)
        if len(uid) == 36 and uid.count("-") == 4:
            ok = await session_repository.set_premium_by_user(uid, is_premium, settings)
            if ok:
                updated = True
                logger.info(
                    "RevenueCat %s → supabase_user_id=%s is_premium=%s", event_type, uid, is_premium
                )
        # Also try as session_id
        ok2 = await session_repository.set_premium_by_session(uid, is_premium, settings)
        if ok2:
            updated = True
            logger.info(
                "RevenueCat %s → session_id=%s is_premium=%s", event_type, uid, is_premium
            )

    if not updated:
        logger.info(
            "RevenueCat %s for app_user_id=%s — no matching session in DB (user may not have synced yet)",
            event_type,
            app_user_id,
        )

    return {"status": "ok", "event": event_type, "is_premium": str(is_premium)}

"""Verify Google Play purchases server-side via Android Publisher API.

Required for the Play User Choice billing path: when the user selects Google Play
in Google's dialog, the client sends the purchase token here for server-side
verification before granting premium. Replaces RevenueCat as grant authority.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

PLAY_PURCHASES_TABLE = "billing_play_purchases"

# Subscription states that grant premium access.
_ACTIVE_SUBSCRIPTION_STATES = {
    "SUBSCRIPTION_STATE_ACTIVE",
    "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
}


def _publisher_credentials(settings: Settings):
    if not settings.google_play_service_account_json:
        return None
    try:
        from google.auth.transport.requests import Request as GoogleAuthRequest
        from google.oauth2 import service_account
    except ImportError:
        logger.warning("google-auth not installed — cannot verify Play purchases")
        return None

    info = json.loads(settings.google_play_service_account_json)
    credentials = service_account.Credentials.from_service_account_info(
        info,
        scopes=["https://www.googleapis.com/auth/androidpublisher"],
    )
    credentials.refresh(GoogleAuthRequest())
    return credentials


async def verify_product_purchase(
    settings: Settings,
    *,
    purchase_token: str,
    product_id: str,
) -> dict[str, Any] | None:
    """Return one-time product purchase resource if valid and purchased."""
    credentials = _publisher_credentials(settings)
    if credentials is None:
        return None

    package_name = settings.play_package_name
    url = (
        f"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"
        f"{package_name}/purchases/products/{product_id}/tokens/{purchase_token}"
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.get(
                url,
                headers={"Authorization": f"Bearer {credentials.token}"},
            )
        if res.status_code != 200:
            logger.warning(
                "Play product verify failed status=%s body=%s",
                res.status_code,
                res.text[:300],
            )
            return None
        data = res.json()
        if not isinstance(data, dict):
            return None

        # 0 = Purchased, 1 = Canceled, 2 = Pending
        purchase_state = data.get("purchaseState")
        if purchase_state is not None and int(purchase_state) != 0:
            logger.info("Play product not purchased: state=%s", purchase_state)
            return None

        return data
    except Exception as exc:
        logger.warning("Play product verify error: %s", exc)
        return None


async def verify_subscription_purchase(
    settings: Settings,
    *,
    purchase_token: str,
    product_id: str,
) -> dict[str, Any] | None:
    """Legacy subscription verify — prefer verify_product_purchase for lifetime unlock."""
    credentials = _publisher_credentials(settings)
    if credentials is None:
        return None

    package_name = settings.play_package_name
    url = (
        f"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"
        f"{package_name}/purchases/subscriptionsv2/tokens/{purchase_token}"
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.get(
                url,
                headers={"Authorization": f"Bearer {credentials.token}"},
            )
        if res.status_code != 200:
            logger.warning(
                "Play subscription verify failed status=%s body=%s",
                res.status_code,
                res.text[:300],
            )
            return None
        data = res.json()
        if not isinstance(data, dict):
            return None

        line_items = data.get("lineItems") or []
        if line_items:
            matched = any(
                str(item.get("productId") or "") == product_id for item in line_items
            )
            if not matched:
                logger.warning(
                    "Play purchase product mismatch expected=%s items=%s",
                    product_id,
                    [item.get("productId") for item in line_items],
                )
                return None

        state = str(data.get("subscriptionState") or "")
        if state not in _ACTIVE_SUBSCRIPTION_STATES:
            logger.info("Play subscription not active: state=%s", state)
            return None

        return data
    except Exception as exc:
        logger.warning("Play subscription verify error: %s", exc)
        return None


async def record_play_purchase(
    settings: Settings,
    *,
    purchase_token: str,
    session_id: str,
    product_id: str,
    order_id: str | None = None,
) -> bool:
    """Insert purchase token for idempotency (prevents replay double-grant)."""
    from app.services.supabase_rest import rest_client

    client = rest_client(settings)
    if client is None:
        return True

    row = {
        "purchase_token": purchase_token,
        "session_id": session_id,
        "product_id": product_id,
        "order_id": order_id,
        "premium_granted_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        from app.services.supabase_rest import _http_client

        headers = {**client._headers, "Prefer": "return=minimal"}
        res = await _http_client().post(
            f"{client._base}/{PLAY_PURCHASES_TABLE}",
            headers=headers,
            json=row,
        )
        if res.status_code in (200, 201, 204):
            return True
        if res.status_code == 409:
            return False
        logger.warning("billing_play_purchases insert failed: %s", res.status_code)
        return False
    except Exception as exc:
        logger.warning("record_play_purchase failed: %s", exc)
        return False


async def get_session_for_purchase_token(
    settings: Settings,
    purchase_token: str,
) -> str | None:
    """Lookup session_id for RTDN events keyed by purchase token."""
    from app.services.supabase_rest import rest_client

    client = rest_client(settings)
    if client is None:
        return None
    row = await client.select_one(
        PLAY_PURCHASES_TABLE,
        filters={"purchase_token": purchase_token},
    )
    if row:
        return str(row.get("session_id") or "") or None
    return None

"""Razorpay Payment Links client."""

from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Any

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

_BASE = "https://api.razorpay.com/v1"


def verify_webhook_signature(body: bytes, signature: str | None, secret: str) -> bool:
    if not signature or not secret:
        return False
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature.strip())


def verify_payment_link_callback_signature(
    *,
    key_secret: str,
    payment_link_id: str,
    payment_link_reference_id: str,
    payment_link_status: str,
    payment_id: str,
    signature: str | None,
) -> bool:
    """Validate Payment Link redirect signature (callback_url query params)."""
    if not signature or not key_secret:
        return False
    payload = (
        f"{payment_link_id}|{payment_link_reference_id}|{payment_link_status}|{payment_id}"
    )
    digest = hmac.new(key_secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature.strip())


async def create_payment_link(
    settings: Settings,
    *,
    amount_paise: int,
    currency: str,
    description: str,
    customer_notes: dict[str, str],
    callback_url: str | None = None,
    expire_by: int | None = None,
) -> dict[str, Any]:
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise RuntimeError("Razorpay is not configured")

    payload: dict[str, Any] = {
        "amount": amount_paise,
        "currency": currency,
        "accept_partial": False,
        "description": description,
        "notes": customer_notes,
        "reminder_enable": False,
    }
    # Razorpay only accepts http(s) callback URLs — omit custom schemes.
    if callback_url:
        payload["callback_url"] = callback_url
        payload["callback_method"] = "get"
    if expire_by:
        payload["expire_by"] = expire_by

    auth = (settings.razorpay_key_id, settings.razorpay_key_secret)
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(f"{_BASE}/payment_links", json=payload, auth=auth)
        if res.status_code not in (200, 201):
            logger.warning("Razorpay payment_link failed: %s %s", res.status_code, res.text[:500])
            res.raise_for_status()
        data = res.json()
        if not isinstance(data, dict):
            raise RuntimeError("Invalid Razorpay response")
        return data


async def fetch_payment_link(settings: Settings, payment_link_id: str) -> dict[str, Any]:
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise RuntimeError("Razorpay is not configured")
    auth = (settings.razorpay_key_id, settings.razorpay_key_secret)
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(f"{_BASE}/payment_links/{payment_link_id}", auth=auth)
        if res.status_code != 200:
            logger.warning(
                "Razorpay fetch payment_link failed: %s %s", res.status_code, res.text[:500]
            )
            res.raise_for_status()
        data = res.json()
        if not isinstance(data, dict):
            raise RuntimeError("Invalid Razorpay response")
        return data


def amount_for_premium(settings: Settings) -> int:
    """Lifetime one-time unlock amount in paise."""
    amount = settings.razorpay_premium_amount_paise
    if not amount:
        raise RuntimeError("Razorpay premium amount not configured")
    return int(amount)


def amount_for_period(settings: Settings, period: str) -> int:
    """Backward-compatible alias — all periods map to lifetime price."""
    _ = period
    return amount_for_premium(settings)


def premium_expiry_days(period: str) -> int | None:
    """Lifetime unlock has no expiry. Legacy callers may still pass a period."""
    _ = period
    return None

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


async def create_payment_link(
    settings: Settings,
    *,
    amount_paise: int,
    currency: str,
    description: str,
    customer_notes: dict[str, str],
    callback_url: str,
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
        "callback_url": callback_url,
        "callback_method": "get",
        "reminder_enable": False,
    }
    if expire_by:
        payload["expire_by"] = expire_by

    auth = (settings.razorpay_key_id, settings.razorpay_key_secret)
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(f"{_BASE}/payment_links", json=payload, auth=auth)
        if res.status_code not in (200, 201):
            logger.warning("Razorpay payment_link failed: %s %s", res.status_code, res.text[:300])
            res.raise_for_status()
        data = res.json()
        if not isinstance(data, dict):
            raise RuntimeError("Invalid Razorpay response")
        return data


def amount_for_period(settings: Settings, period: str) -> int:
    if period == "annual":
        amount = settings.razorpay_amount_annual_paise
    else:
        amount = settings.razorpay_amount_monthly_paise
    if not amount:
        raise RuntimeError("Razorpay amounts not configured")
    return int(amount)


def premium_expiry_days(period: str) -> int:
    return 365 if period == "annual" else 30

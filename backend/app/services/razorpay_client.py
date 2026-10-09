"""Razorpay Payment Links + Subscriptions client."""

from __future__ import annotations

import hashlib
import hmac
import logging
import time
from datetime import datetime, timedelta, timezone
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


def amount_for_period(settings: Settings, period: str) -> int:
    """Return amount in paise for monthly or annual plan."""
    if period == "annual":
        amount = settings.razorpay_amount_annual_paise
    else:
        amount = settings.razorpay_amount_monthly_paise
    if not amount:
        # Fall back to premium one-shot amount if period amounts unset.
        amount = settings.razorpay_premium_amount_paise
    if not amount:
        raise RuntimeError("Razorpay amounts not configured")
    return int(amount)


def amount_for_premium(settings: Settings) -> int:
    """Prefer annual, then monthly, then explicit premium amount."""
    return amount_for_period(settings, "annual")


def premium_expiry_days(period: str) -> int:
    if period == "weekly":
        return 7
    return 365 if period == "annual" else 30


# --- Subscriptions -----------------------------------------------------------

# Razorpay requires a finite number of billing cycles; ~10 years of renewals.
SUBSCRIPTION_TOTAL_COUNT = {"weekly": 520, "monthly": 120, "annual": 10}

# Renewal charges land at current_end; keep access for a day so a slightly late
# charge/webhook does not lock out a paying subscriber.
SUBSCRIPTION_GRACE = timedelta(days=1)

# With cancel_at_cycle_end Razorpay keeps the subscription "active" until the cycle ends,
# so these statuses mean access should stop.
SUBSCRIPTION_ENDED_STATUSES = frozenset({"cancelled", "completed", "expired", "halted", "paused"})

_PLAN_CACHE_TTL_SECONDS = 3600
_plan_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def _auth(settings: Settings) -> tuple[str, str]:
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise RuntimeError("Razorpay is not configured")
    return (settings.razorpay_key_id, settings.razorpay_key_secret)


async def _request(
    settings: Settings, method: str, path: str, *, json_body: dict[str, Any] | None = None
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.request(method, f"{_BASE}{path}", json=json_body, auth=_auth(settings))
        if res.status_code not in (200, 201):
            logger.warning("Razorpay %s %s failed: %s %s", method, path, res.status_code, res.text[:500])
            res.raise_for_status()
        data = res.json()
        if not isinstance(data, dict):
            raise RuntimeError("Invalid Razorpay response")
        return data


async def fetch_plan(settings: Settings, plan_id: str) -> dict[str, Any]:
    cached = _plan_cache.get(plan_id)
    if cached and time.monotonic() - cached[0] < _PLAN_CACHE_TTL_SECONDS:
        return cached[1]
    plan = await _request(settings, "GET", f"/plans/{plan_id}")
    _plan_cache[plan_id] = (time.monotonic(), plan)
    return plan


async def plan_amount_paise(settings: Settings, plan_id: str) -> int:
    plan = await fetch_plan(settings, plan_id)
    item = plan.get("item") or {}
    amount = int(item.get("amount") or 0)
    if amount <= 0:
        raise RuntimeError(f"Razorpay plan {plan_id} has no amount")
    return amount


async def create_subscription(
    settings: Settings,
    *,
    plan_id: str,
    total_count: int,
    notes: dict[str, str],
) -> dict[str, Any]:
    return await _request(
        settings,
        "POST",
        "/subscriptions",
        json_body={
            "plan_id": plan_id,
            "total_count": total_count,
            "quantity": 1,
            "customer_notify": 1,
            "notes": notes,
        },
    )


async def fetch_subscription(settings: Settings, subscription_id: str) -> dict[str, Any]:
    return await _request(settings, "GET", f"/subscriptions/{subscription_id}")


async def cancel_subscription(
    settings: Settings, subscription_id: str, *, at_cycle_end: bool = True
) -> dict[str, Any]:
    return await _request(
        settings,
        "POST",
        f"/subscriptions/{subscription_id}/cancel",
        json_body={"cancel_at_cycle_end": 1 if at_cycle_end else 0},
    )


def verify_subscription_signature(
    *, key_secret: str, payment_id: str, subscription_id: str, signature: str | None
) -> bool:
    """Validate Checkout callback signature for a subscription authorisation."""
    if not signature or not key_secret or not payment_id or not subscription_id:
        return False
    payload = f"{payment_id}|{subscription_id}"
    digest = hmac.new(key_secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature.strip())


def subscription_is_paid(sub: dict[str, Any]) -> bool:
    status = str(sub.get("status") or "")
    if status == "active":
        return True
    return status == "authenticated" and int(sub.get("paid_count") or 0) > 0


def subscription_access_until(sub: dict[str, Any]) -> datetime | None:
    """End of the current paid cycle plus grace, or None when Razorpay has no cycle yet."""
    current_end = sub.get("current_end")
    if not current_end:
        return None
    try:
        end = datetime.fromtimestamp(int(current_end), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None
    return end + SUBSCRIPTION_GRACE

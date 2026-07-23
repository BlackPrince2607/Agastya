"""Billing configuration — Android India, Razorpay + Google Play User Choice."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import Request

from app.config import Settings

BillingPlatform = Literal["android", "ios", "web"]
ProviderId = Literal["google_play", "razorpay"]

_TRUSTED_COUNTRY_HEADERS = (
    "cf-ipcountry",
    "x-vercel-ip-country",
    "cloudfront-viewer-country",
)


def detect_country(request: Request, settings: Settings) -> str | None:
    """Trusted edge country; optional staging override."""
    forced = (settings.billing_force_country or "").strip().upper()
    if forced:
        return forced
    for header in _TRUSTED_COUNTRY_HEADERS:
        raw = request.headers.get(header)
        if raw and len(raw.strip()) == 2 and raw.strip().upper() != "XX":
            return raw.strip().upper()
    return None


def build_billing_config(
    *,
    platform: BillingPlatform,
    country: str | None,
    settings: Settings,
) -> dict[str, Any]:
    country_code = (country or "").upper() or None
    providers: list[dict[str, Any]] = []

    # Android India: Google Play (User Choice) + Razorpay alternative billing.
    if platform == "android":
        providers.append(
            {
                "id": "google_play",
                "enabled": True,
                "label": "Google Play",
                "requiresPlayUserChoice": False,
            }
        )
        razorpay_ok = (
            settings.billing_razorpay_enabled
            and settings.billing_razorpay_android_enabled
            and settings.razorpay_configured
            and country_code in settings.billing_razorpay_countries_set
        )
        if razorpay_ok:
            providers.append(
                {
                    "id": "razorpay",
                    "enabled": True,
                    "label": "UPI / Cards",
                    "requiresPlayUserChoice": True,
                }
            )

    currency = "INR" if country_code == "IN" else "USD"
    plans: dict[str, Any] = {}
    if settings.razorpay_configured and currency == "INR":
        plans = {
            "monthly": {
                "amount": settings.razorpay_amount_monthly_paise,
                "currency": "INR",
            },
            "annual": {
                "amount": settings.razorpay_amount_annual_paise,
                "currency": "INR",
            },
        }

    return {
        "country": country_code,
        "currency": currency if plans else "INR",
        "providers": providers,
        "plans": plans,
    }

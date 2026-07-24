"""Razorpay Payment Links and Google Play purchase verification."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal
from urllib.parse import parse_qsl, quote, urlencode, urlparse, urlunparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from app.config import Settings, get_settings
from app.middleware.rate_limit import check_rate_limit
from app.schemas.billing import (
    BillingConfigResponse,
    GooglePlayVerifyBody,
    GooglePlayVerifyResponse,
    RazorpayPaymentLinkBody,
    RazorpayPaymentLinkResponse,
)
from app.services import billing_intents, play_purchase_verify, session_repository
from app.services.billing_config import build_billing_config, detect_country
from app.services.bucket_store import bucket, has_bucket, set_bucket
from app.services import razorpay_client
from app.utils.validators import assert_device_binding, validate_session_id

logger = logging.getLogger(__name__)

router = APIRouter(tags=["billing"], dependencies=[Depends(check_rate_limit)])


async def _hydrate(session_id: str, settings: Settings) -> None:
    validate_session_id(session_id)
    if has_bucket(session_id):
        return
    try:
        loaded = await session_repository.load(session_id, settings)
    except session_repository.SupabaseUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail="Session storage temporarily unavailable. Please try again.",
        ) from exc
    if loaded:
        set_bucket(session_id, loaded)
    else:
        bucket(session_id)


def _assert_return_url(url: str, settings: Settings) -> None:
    """Exact origin / exact bare-URL allowlist. Fail closed when DEBUG=false and allowlist empty."""
    allowed = settings.checkout_allowed_return_origins_list
    if not allowed:
        if settings.debug:
            logger.warning(
                "CHECKOUT_ALLOWED_RETURN_ORIGINS unset — allowing return URL (DEBUG only)"
            )
            return
        raise HTTPException(
            status_code=503,
            detail="Checkout return origins not configured",
        )

    bare = url.split("?", 1)[0].rstrip("/")
    if bare in allowed:
        return

    # Custom app schemes (agastya://, exp://): urlparse treats the first path
    # segment as netloc, so always allow prefix entries ending with ://.
    for entry in allowed:
        if entry.endswith("://") and url.startswith(entry):
            return

    parsed = urlparse(url)
    if parsed.scheme and parsed.netloc:
        origin = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
        if origin in allowed:
            return

    raise HTTPException(status_code=400, detail="Return URL not allowed")


def _public_api_origin(request: Request, settings: Settings) -> str:
    if settings.public_api_base_url:
        return settings.public_api_base_url.rstrip("/")
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if host:
        return f"{proto}://{host.split(',')[0].strip()}".rstrip("/")
    return str(request.base_url).rstrip("/")


def _razorpay_callback_url(success_url: str, request: Request, settings: Settings) -> str:
    """Razorpay rejects custom schemes (exp://, agastya://). Bridge via HTTPS redirect."""
    parsed = urlparse(success_url)
    if parsed.scheme in ("http", "https"):
        return success_url
    origin = _public_api_origin(request, settings)
    target = quote(success_url, safe="")
    return f"{origin}{settings.api_v1_prefix}/billing/razorpay/return?target={target}"


@router.get("/billing/config", response_model=BillingConfigResponse, response_model_by_alias=True)
async def billing_config(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    platform: Annotated[Literal["android", "ios", "web"], Query()] = "android",
) -> BillingConfigResponse:
    country = detect_country(request, settings)
    raw = build_billing_config(platform=platform, country=country, settings=settings)
    return BillingConfigResponse.model_validate(raw)


@router.get("/billing/razorpay/return")
async def razorpay_return_bridge(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    target: Annotated[str, Query(min_length=1, max_length=2048)],
) -> RedirectResponse:
    """HTTPS callback Razorpay can hit; redirects into the app deep link."""
    _assert_return_url(target, settings)
    extra = [(k, v) for k, v in request.query_params.multi_items() if k != "target"]
    if extra:
        parsed = urlparse(target)
        existing = dict(parse_qsl(parsed.query, keep_blank_values=True))
        for k, v in extra:
            existing[k] = v
        target = urlunparse(parsed._replace(query=urlencode(existing)))
    return RedirectResponse(url=target, status_code=302)


@router.post(
    "/billing/razorpay/create-payment-link",
    response_model=RazorpayPaymentLinkResponse,
    response_model_by_alias=True,
)
async def create_razorpay_payment_link(
    body: RazorpayPaymentLinkBody,
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> RazorpayPaymentLinkResponse:
    if not settings.billing_razorpay_enabled or not settings.razorpay_configured:
        raise HTTPException(status_code=503, detail="Razorpay is not configured")

    if body.platform == "android" and not settings.billing_razorpay_android_enabled:
        raise HTTPException(status_code=503, detail="Android Razorpay is not enabled")
    # Production Android requires Play User Choice token + administrative area.
    # DEBUG + BILLING_RAZORPAY_TEST_BYPASS skips this so Razorpay can be E2E tested without Play.
    if body.platform == "android" and not settings.razorpay_test_bypass_active:
        if not body.external_transaction_token:
            raise HTTPException(
                status_code=400,
                detail="externalTransactionToken required for Android Razorpay",
            )
        if not body.administrative_area:
            raise HTTPException(
                status_code=400,
                detail="administrativeArea required for Android Razorpay",
            )

    _assert_return_url(body.success_url, settings)
    _assert_return_url(body.cancel_url, settings)

    await _hydrate(body.session_id, settings)
    bkt = bucket(body.session_id)
    assert_device_binding(
        session_id=body.session_id,
        device_install_id=body.device_install_id,
        stored_device_id=bkt.meta.get("deviceInstallId"),
        allow_rebind=False,
    )
    if not bkt.meta.get("deviceInstallId"):
        bkt.meta["deviceInstallId"] = body.device_install_id

    supabase_user_id = bkt.meta.get("supabaseUserId")
    amount = razorpay_client.amount_for_period(settings, body.billing_period)

    intent = await billing_intents.create_checkout_intent(
        settings,
        session_id=body.session_id,
        device_install_id=body.device_install_id,
        supabase_user_id=str(supabase_user_id) if supabase_user_id else None,
        provider="razorpay",
        billing_period=body.billing_period,
        amount=amount,
        currency="INR",
        success_url=body.success_url,
        cancel_url=body.cancel_url,
        external_transaction_token=body.external_transaction_token,
        administrative_area=body.administrative_area,
    )
    if not intent or not intent.get("id"):
        raise HTTPException(status_code=502, detail="Could not create checkout intent")

    intent_id = str(intent["id"])
    notes: dict[str, str] = {
        "session_id": body.session_id,
        "device_install_id": body.device_install_id,
        "billing_period": body.billing_period,
        "plan": body.billing_period,
        "checkout_intent_id": intent_id,
    }
    if supabase_user_id:
        notes["supabase_user_id"] = str(supabase_user_id)
    if body.external_transaction_token:
        notes["external_transaction_token"] = body.external_transaction_token

    callback_url = _razorpay_callback_url(body.success_url, request, settings)
    try:
        link = await razorpay_client.create_payment_link(
            settings,
            amount_paise=amount,
            currency="INR",
            description=f"Agastya Premium ({body.billing_period})",
            customer_notes=notes,
            callback_url=callback_url,
        )
    except Exception as exc:
        logger.warning("Razorpay payment link failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not create Razorpay payment link") from exc

    payment_link_id = str(link.get("id") or "")
    checkout_url = str(link.get("short_url") or link.get("url") or "")
    if not payment_link_id or not checkout_url:
        raise HTTPException(status_code=502, detail="Razorpay payment link missing")

    await billing_intents.attach_payment_link(settings, intent_id, payment_link_id)
    return RazorpayPaymentLinkResponse(checkout_url=checkout_url, checkout_intent_id=intent_id)


@router.post(
    "/billing/google-play/verify-purchase",
    response_model=GooglePlayVerifyResponse,
    response_model_by_alias=True,
)
async def verify_google_play_purchase(
    body: GooglePlayVerifyBody,
    settings: Annotated[Settings, Depends(get_settings)],
) -> GooglePlayVerifyResponse:
    """Verify Play subscription purchase and grant premium (Play User Choice path)."""
    await _hydrate(body.session_id, settings)
    bkt = bucket(body.session_id)
    assert_device_binding(
        session_id=body.session_id,
        device_install_id=body.device_install_id,
        stored_device_id=bkt.meta.get("deviceInstallId"),
        allow_rebind=False,
    )

    recorded = await play_purchase_verify.record_play_purchase(
        settings,
        purchase_token=body.purchase_token,
        session_id=body.session_id,
        product_id=body.product_id,
    )
    if not recorded:
        # Token already used — idempotent success if premium already granted.
        if bkt.effectively_premium():
            return GooglePlayVerifyResponse(is_premium=True, source="google_play")
        raise HTTPException(status_code=409, detail="Purchase token already processed")

    sub = await play_purchase_verify.verify_subscription_purchase(
        settings,
        purchase_token=body.purchase_token,
        product_id=body.product_id,
    )
    if sub is None:
        raise HTTPException(status_code=402, detail="Purchase verification failed")

    supabase_user_id = bkt.meta.get("supabaseUserId")
    expires: datetime | None = None
    line_items = sub.get("lineItems") or []
    if line_items:
        expiry_raw = line_items[0].get("expiryTime")
        if expiry_raw:
            try:
                expires = datetime.fromisoformat(str(expiry_raw).replace("Z", "+00:00"))
            except ValueError:
                pass
    if expires is None:
        period = "annual" if "annual" in body.product_id else "monthly"
        days = 365 if period == "annual" else 30
        expires = datetime.now(timezone.utc) + timedelta(days=days)

    ok = await session_repository.set_premium_by_session(
        body.session_id,
        True,
        settings,
        premium_source="google_play",
        premium_expires_at=expires,
    )
    if supabase_user_id:
        await session_repository.set_premium_by_user(
            str(supabase_user_id),
            True,
            settings,
            premium_source="google_play",
            premium_expires_at=expires,
        )

    if not ok:
        raise HTTPException(status_code=502, detail="Could not grant premium")

    bkt.is_premium = True
    bkt.premium_source = "google_play"
    bkt.premium_expires_at = expires

    return GooglePlayVerifyResponse(is_premium=True, source="google_play")

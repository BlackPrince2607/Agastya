"""Razorpay Subscriptions / Payment Links and Google Play purchase verification."""

from __future__ import annotations

import html
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, Literal
from urllib.parse import parse_qsl, quote, urlencode, urlparse, urlunparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from app.config import Settings, get_settings
from app.middleware.rate_limit import check_rate_limit
from app.schemas.billing import (
    BillingConfigResponse,
    GooglePlayVerifyBody,
    GooglePlayVerifyResponse,
    RazorpayCancelSubscriptionBody,
    RazorpayCancelSubscriptionResponse,
    RazorpayConfirmPaymentBody,
    RazorpayConfirmPaymentResponse,
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
    subscription_amounts: dict[str, int] = {}
    if settings.razorpay_configured:
        for period, plan_id in settings.razorpay_subscription_plans.items():
            try:
                subscription_amounts[period] = await razorpay_client.plan_amount_paise(
                    settings, plan_id
                )
            except Exception as exc:
                logger.warning("Razorpay plan %s lookup failed: %s", plan_id, exc)
    raw = build_billing_config(
        platform=platform,
        country=country,
        settings=settings,
        subscription_amounts=subscription_amounts or None,
    )
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
    # With User Choice: require Play externalTransactionToken + administrative area.
    # BILLING_RAZORPAY_TEST_BYPASS skips this for Razorpay-direct (no choice sheet).
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
    if not supabase_user_id:
        raise HTTPException(
            status_code=401,
            detail="Sign in required before starting checkout",
        )
    billing_period = "annual" if body.billing_period == "lifetime" else body.billing_period
    plan_id = settings.razorpay_plan_for_period(billing_period)
    try:
        if plan_id:
            amount = await razorpay_client.plan_amount_paise(settings, plan_id)
        else:
            amount = razorpay_client.amount_for_period(settings, billing_period)
    except Exception as exc:
        logger.warning("Razorpay amount lookup failed period=%s: %s", billing_period, exc)
        raise HTTPException(status_code=502, detail="Could not load Razorpay plan") from exc

    intent = await billing_intents.create_checkout_intent(
        settings,
        session_id=body.session_id,
        device_install_id=body.device_install_id,
        supabase_user_id=str(supabase_user_id) if supabase_user_id else None,
        provider="razorpay",
        billing_period=billing_period,
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
        "billing_period": billing_period,
        "plan": billing_period,
        "checkout_intent_id": intent_id,
    }
    if supabase_user_id:
        notes["supabase_user_id"] = str(supabase_user_id)
    if body.external_transaction_token:
        notes["external_transaction_token"] = body.external_transaction_token

    if plan_id:
        try:
            sub = await razorpay_client.create_subscription(
                settings,
                plan_id=plan_id,
                total_count=razorpay_client.SUBSCRIPTION_TOTAL_COUNT.get(billing_period, 120),
                notes=notes,
            )
        except Exception as exc:
            logger.warning("Razorpay subscription create failed: %s", exc)
            raise HTTPException(status_code=502, detail="Could not create Razorpay subscription") from exc
        subscription_id = str(sub.get("id") or "")
        if not subscription_id:
            raise HTTPException(status_code=502, detail="Razorpay subscription missing")
        if not await billing_intents.attach_subscription(settings, intent_id, subscription_id):
            raise HTTPException(status_code=502, detail="Could not save Razorpay subscription")
        origin = _public_api_origin(request, settings)
        checkout_url = f"{origin}{settings.api_v1_prefix}/billing/razorpay/subscribe/{intent_id}"
        return RazorpayPaymentLinkResponse(checkout_url=checkout_url, checkout_intent_id=intent_id)

    callback_url = _razorpay_callback_url(body.success_url, request, settings)
    try:
        link = await razorpay_client.create_payment_link(
            settings,
            amount_paise=amount,
            currency="INR",
            description=f"Agastya Premium ({billing_period})",
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


async def _grant_razorpay_premium_from_intent(
    settings: Settings,
    intent: dict,
    *,
    bkt,
    payment_id: str | None = None,
    expires: datetime | None = None,
) -> RazorpayConfirmPaymentResponse:
    session_id = str(intent.get("session_id") or "")
    supabase_user_id = intent.get("supabase_user_id")
    billing_period = str(intent.get("billing_period") or "monthly")
    if billing_period == "lifetime":
        billing_period = "annual"
    if expires is None:
        days = razorpay_client.premium_expiry_days(billing_period)
        expires = datetime.now(timezone.utc) + timedelta(days=days)
        if intent.get("razorpay_subscription_id"):
            expires += razorpay_client.SUBSCRIPTION_GRACE

    await billing_intents.mark_intent_paid(
        settings,
        str(intent["id"]),
        razorpay_payment_id=payment_id,
    )

    ok = await session_repository.set_premium_by_session(
        session_id,
        True,
        settings,
        premium_source="razorpay",
        premium_expires_at=expires,
    )
    if supabase_user_id:
        await session_repository.set_premium_by_user(
            str(supabase_user_id),
            True,
            settings,
            premium_source="razorpay",
            premium_expires_at=expires,
        )

    if not ok and not settings.supabase_enabled:
        # Local/dev without Supabase — still unlock in-memory session bucket.
        bkt.is_premium = True
        bkt.premium_source = "razorpay"
        bkt.premium_expires_at = expires
        ok = True

    if not ok:
        raise HTTPException(status_code=502, detail="Could not grant premium")

    bkt.is_premium = True
    bkt.premium_source = "razorpay"
    bkt.premium_expires_at = expires

    # Same Play ExternalTransactions path as the Razorpay webhook — confirm-only
    # unlocks must still enqueue/report when a User Choice token is present.
    await billing_intents.report_play_external_for_intent(
        settings,
        intent,
        payment_id=payment_id,
        amount_paise=int(intent.get("amount") or 0) or None,
    )

    try:
        from app.services import expo_push

        await expo_push.notify_session(
            session_id,
            "premium_unlocked",
            settings=settings,
            event_key=f"premium_rz:{intent.get('id') or session_id}",
            supabase_user_id=str(supabase_user_id) if supabase_user_id else None,
        )
    except Exception:
        logger.exception("premium_unlocked push failed session=%s", session_id)

    return RazorpayConfirmPaymentResponse(is_premium=True, status="paid", source="razorpay")


@router.post(
    "/billing/razorpay/confirm-payment",
    response_model=RazorpayConfirmPaymentResponse,
    response_model_by_alias=True,
)
async def confirm_razorpay_payment(
    body: RazorpayConfirmPaymentBody,
    settings: Annotated[Settings, Depends(get_settings)],
) -> RazorpayConfirmPaymentResponse:
    """Actively verify Payment Link status with Razorpay (does not rely on webhooks alone)."""
    if not settings.billing_razorpay_enabled or not settings.razorpay_configured:
        raise HTTPException(status_code=503, detail="Razorpay is not configured")

    await _hydrate(body.session_id, settings)
    bkt = bucket(body.session_id)
    assert_device_binding(
        session_id=body.session_id,
        device_install_id=body.device_install_id,
        stored_device_id=bkt.meta.get("deviceInstallId"),
        allow_rebind=False,
    )

    if bkt.effectively_premium():
        return RazorpayConfirmPaymentResponse(is_premium=True, status="paid", source="razorpay")

    intent = None
    if body.checkout_intent_id:
        intent = await billing_intents.get_intent_by_id(settings, body.checkout_intent_id)
    if not intent and body.payment_link_id:
        intent = await billing_intents.get_intent_by_payment_link(settings, body.payment_link_id)
    if not intent:
        intent = await billing_intents.get_latest_intent_for_session(settings, body.session_id)

    if not intent or str(intent.get("session_id") or "") != body.session_id:
        raise HTTPException(status_code=404, detail="Checkout intent not found")

    intent_device = intent.get("device_install_id")
    if intent_device and str(intent_device) != body.device_install_id:
        raise HTTPException(status_code=403, detail="Device mismatch for checkout intent")

    # Prefer the signed-in user on the live session when confirming.
    session_user = bkt.meta.get("supabaseUserId")
    intent_user = intent.get("supabase_user_id")
    if session_user and intent_user and str(session_user) != str(intent_user):
        raise HTTPException(status_code=403, detail="Checkout belongs to a different account")
    if session_user and not intent_user:
        intent = {**intent, "supabase_user_id": str(session_user)}

    payment_id = str(body.payment_id).strip() if body.payment_id else None

    subscription_id = intent.get("razorpay_subscription_id")
    if subscription_id:
        try:
            sub = await razorpay_client.fetch_subscription(settings, str(subscription_id))
        except Exception as exc:
            logger.warning("Razorpay subscription fetch failed: %s", exc)
            raise HTTPException(status_code=502, detail="Could not verify Razorpay subscription") from exc
        if not razorpay_client.subscription_is_paid(sub) and intent.get("status") != "paid":
            return RazorpayConfirmPaymentResponse(
                is_premium=False, status=str(sub.get("status") or "unknown")
            )
        if str(sub.get("status")) in razorpay_client.SUBSCRIPTION_ENDED_STATUSES:
            return RazorpayConfirmPaymentResponse(is_premium=False, status=str(sub["status"]))
        return await _grant_razorpay_premium_from_intent(
            settings,
            intent,
            bkt=bkt,
            payment_id=payment_id or intent.get("razorpay_payment_id"),
            expires=razorpay_client.subscription_access_until(sub),
        )

    if intent.get("status") == "paid":
        if payment_id and not intent.get("razorpay_payment_id"):
            await billing_intents.attach_payment_id(settings, str(intent["id"]), payment_id)
        return await _grant_razorpay_premium_from_intent(
            settings, intent, bkt=bkt, payment_id=payment_id or intent.get("razorpay_payment_id")
        )

    payment_link_id = body.payment_link_id or intent.get("razorpay_payment_link_id")
    if not payment_link_id:
        raise HTTPException(status_code=404, detail="Payment link not found for checkout")

    if (
        body.razorpay_signature
        and body.payment_id
        and body.payment_link_reference_id is not None
        and body.payment_link_status
        and settings.razorpay_key_secret
    ):
        valid = razorpay_client.verify_payment_link_callback_signature(
            key_secret=settings.razorpay_key_secret,
            payment_link_id=str(payment_link_id),
            payment_link_reference_id=str(body.payment_link_reference_id),
            payment_link_status=str(body.payment_link_status),
            payment_id=str(body.payment_id),
            signature=body.razorpay_signature,
        )
        if not valid and not settings.debug:
            raise HTTPException(status_code=401, detail="Invalid Razorpay payment signature")
        if not valid:
            logger.warning("Razorpay callback signature mismatch (DEBUG allowing)")

    try:
        link = await razorpay_client.fetch_payment_link(settings, str(payment_link_id))
    except Exception as exc:
        logger.warning("Razorpay confirm fetch failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not verify Razorpay payment") from exc

    if not payment_id:
        # Prefer explicit callback payment id; else first payment on the link entity.
        payments = link.get("payments")
        if isinstance(payments, list) and payments:
            first = payments[0]
            if isinstance(first, dict) and first.get("payment_id"):
                payment_id = str(first["payment_id"]).strip() or None
            elif isinstance(first, str):
                payment_id = first.strip() or None

    status = str(link.get("status") or "unknown")
    if status != "paid":
        # Callback may say paid before link entity is fully updated — trust signed paid status.
        if (
            body.payment_link_status == "paid"
            and body.payment_id
            and body.razorpay_signature
            and settings.razorpay_key_secret
            and razorpay_client.verify_payment_link_callback_signature(
                key_secret=settings.razorpay_key_secret,
                payment_link_id=str(payment_link_id),
                payment_link_reference_id=str(body.payment_link_reference_id or ""),
                payment_link_status="paid",
                payment_id=str(body.payment_id),
                signature=body.razorpay_signature,
            )
        ):
            status = "paid"
        else:
            return RazorpayConfirmPaymentResponse(is_premium=False, status=status)

    return await _grant_razorpay_premium_from_intent(
        settings, intent, bkt=bkt, payment_id=payment_id
    )


def _with_query(url: str, params: dict[str, str]) -> str:
    """Append query params; works for custom schemes (agastya://…) too."""
    if not params:
        return url
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}{urlencode(params)}"


def _redirect_page(target: str, *, title: str, message: str) -> HTMLResponse:
    """HTML redirect into the app; a button covers browsers that block scheme auto-redirects."""
    target_attr = html.escape(target, quote=True)
    target_js = json.dumps(target).replace("</", "<\\/")
    page = f"""<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title>
<style>body{{font-family:system-ui,sans-serif;background:#0d0b1a;color:#f3eefc;display:flex;
min-height:100vh;align-items:center;justify-content:center;margin:0;text-align:center}}
a{{display:inline-block;margin-top:20px;padding:14px 28px;border-radius:12px;background:#c9a24d;
color:#1a1424;text-decoration:none;font-weight:600}}</style></head>
<body><div><h2>{html.escape(title)}</h2><p>{html.escape(message)}</p>
<a href="{target_attr}">Return to Agastya</a></div>
<script>window.location.replace({target_js});</script></body></html>"""
    return HTMLResponse(page, headers={"Cache-Control": "no-store"})


async def _load_subscription_intent(settings: Settings, intent_id: str) -> dict[str, Any]:
    try:
        validate_session_id(intent_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Checkout not found") from exc
    intent = await billing_intents.get_intent_by_id(settings, intent_id)
    if not intent or not intent.get("razorpay_subscription_id"):
        raise HTTPException(status_code=404, detail="Checkout not found")
    return intent


@router.get("/billing/razorpay/subscribe/{intent_id}", response_class=HTMLResponse)
async def razorpay_subscription_checkout_page(
    intent_id: str,
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> HTMLResponse:
    """Hosted Razorpay Checkout for a subscription (opened in the browser by the app)."""
    if not settings.razorpay_configured:
        raise HTTPException(status_code=503, detail="Razorpay is not configured")
    intent = await _load_subscription_intent(settings, intent_id)
    success_url = _with_query(
        str(intent.get("success_url") or ""), {"checkoutIntentId": intent_id}
    )
    cancel_url = str(intent.get("cancel_url") or success_url)
    if intent.get("status") == "paid":
        return _redirect_page(success_url, title="Premium is active", message="Returning to Agastya…")

    origin = _public_api_origin(request, settings)
    callback_url = (
        f"{origin}{settings.api_v1_prefix}/billing/razorpay/subscription-callback"
        f"?{urlencode({'intent': intent_id})}"
    )
    period = str(intent.get("billing_period") or "monthly")
    label = "Yearly" if period == "annual" else period.capitalize()
    options = {
        "key": settings.razorpay_key_id,
        "subscription_id": str(intent["razorpay_subscription_id"]),
        "name": "Agastya",
        "description": f"Agastya Premium — {label} (auto-renews)",
        "callback_url": callback_url,
        "redirect": True,
        "theme": {"color": "#c9a24d"},
    }
    options_js = json.dumps(options).replace("</", "<\\/")
    cancel_js = json.dumps(cancel_url).replace("</", "<\\/")
    amount = int(intent.get("amount") or 0)
    price = f"₹{amount // 100}" if amount else ""
    page = f"""<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agastya Premium</title>
<style>body{{font-family:system-ui,sans-serif;background:#0d0b1a;color:#f3eefc;display:flex;
min-height:100vh;align-items:center;justify-content:center;margin:0;text-align:center;padding:24px}}
button{{margin-top:20px;padding:14px 28px;border:0;border-radius:12px;background:#c9a24d;
color:#1a1424;font-weight:600;font-size:16px}}a{{display:block;margin-top:16px;color:#b9aed6}}
small{{display:block;margin-top:18px;color:#8f86a8;max-width:320px}}</style></head>
<body><div><h2>Agastya Premium — {html.escape(label)}</h2>
<p>{html.escape(price)} / {"year" if period == "annual" else "month"}</p>
<button id="pay">Continue to payment</button>
<a id="back" href="#">Cancel and return to app</a>
<small>Renews automatically until cancelled. Cancel anytime from Profile in the app.</small></div>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
var cancelUrl = {cancel_js};
var options = {options_js};
options.modal = {{ ondismiss: function () {{}} }};
function openCheckout() {{ new Razorpay(options).open(); }}
document.getElementById("pay").onclick = openCheckout;
document.getElementById("back").onclick = function (e) {{ e.preventDefault(); window.location.replace(cancelUrl); }};
window.addEventListener("load", openCheckout);
</script></body></html>"""
    return HTMLResponse(page, headers={"Cache-Control": "no-store"})


@router.post("/billing/razorpay/subscription-callback", response_class=HTMLResponse)
async def razorpay_subscription_callback(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    intent: Annotated[str, Query(alias="intent", min_length=1, max_length=64)],
) -> HTMLResponse:
    """Razorpay Checkout POSTs here after the subscription's first payment."""
    intent_row = await _load_subscription_intent(settings, intent)
    success_url = _with_query(str(intent_row.get("success_url") or ""), {"checkoutIntentId": intent})
    cancel_url = str(intent_row.get("cancel_url") or success_url)

    form = dict(parse_qsl((await request.body()).decode("utf-8", errors="ignore")))
    payment_id = (form.get("razorpay_payment_id") or "").strip()
    signature = form.get("razorpay_signature")
    subscription_id = str(intent_row["razorpay_subscription_id"])

    if not payment_id:
        logger.info(
            "Razorpay subscription checkout not completed intent=%s error=%s",
            intent,
            form.get("error[description]") or form.get("error[code]"),
        )
        return _redirect_page(cancel_url, title="Payment not completed", message="Returning to Agastya…")

    if not razorpay_client.verify_subscription_signature(
        key_secret=settings.razorpay_key_secret or "",
        payment_id=payment_id,
        subscription_id=subscription_id,
        signature=signature,
    ):
        logger.warning("Razorpay subscription callback signature invalid intent=%s", intent)
        return _redirect_page(cancel_url, title="Payment could not be verified", message="Returning to Agastya…")

    # Grant here so premium is live before the app reopens; the app's confirm call
    # and the subscription webhooks are idempotent backups.
    try:
        session_id = str(intent_row.get("session_id") or "")
        await _hydrate(session_id, settings)
        expires = None
        try:
            sub = await razorpay_client.fetch_subscription(settings, subscription_id)
            expires = razorpay_client.subscription_access_until(sub)
        except Exception as exc:
            logger.warning("Razorpay subscription fetch after callback failed: %s", exc)
        await _grant_razorpay_premium_from_intent(
            settings, intent_row, bkt=bucket(session_id), payment_id=payment_id, expires=expires
        )
    except Exception:
        logger.exception("Razorpay subscription grant on callback failed intent=%s", intent)

    return _redirect_page(success_url, title="Payment successful", message="Returning to Agastya…")


@router.post(
    "/billing/razorpay/cancel-subscription",
    response_model=RazorpayCancelSubscriptionResponse,
    response_model_by_alias=True,
)
async def cancel_razorpay_subscription(
    body: RazorpayCancelSubscriptionBody,
    settings: Annotated[Settings, Depends(get_settings)],
) -> RazorpayCancelSubscriptionResponse:
    """Stop auto-renewal; premium stays active until the paid cycle ends."""
    if not settings.razorpay_configured:
        raise HTTPException(status_code=503, detail="Razorpay is not configured")
    await _hydrate(body.session_id, settings)
    bkt = bucket(body.session_id)
    assert_device_binding(
        session_id=body.session_id,
        device_install_id=body.device_install_id,
        stored_device_id=bkt.meta.get("deviceInstallId"),
        allow_rebind=False,
    )
    supabase_user_id = bkt.meta.get("supabaseUserId")
    intent = await billing_intents.get_latest_paid_subscription_intent(
        settings,
        supabase_user_id=str(supabase_user_id) if supabase_user_id else None,
        session_id=body.session_id,
    )
    if not intent:
        raise HTTPException(status_code=404, detail="No active subscription found")

    subscription_id = str(intent["razorpay_subscription_id"])
    try:
        sub = await razorpay_client.fetch_subscription(settings, subscription_id)
        status = str(sub.get("status") or "")
        if status not in razorpay_client.SUBSCRIPTION_ENDED_STATUSES:
            try:
                sub = await razorpay_client.cancel_subscription(
                    settings, subscription_id, at_cycle_end=status != "created"
                )
            except httpx.HTTPStatusError as exc:
                # 400 when cancellation is already scheduled for the cycle end.
                if exc.response.status_code != 400:
                    raise
                logger.info("Razorpay cancel returned 400 (likely already scheduled): %s", exc)
    except Exception as exc:
        logger.warning("Razorpay cancel subscription failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not cancel subscription") from exc

    access_until = razorpay_client.subscription_access_until(sub)
    return RazorpayCancelSubscriptionResponse(
        cancelled=True,
        status=str(sub.get("status") or "unknown"),
        access_until=access_until.isoformat() if access_until else None,
    )


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

    if not settings.google_play_service_account_json:
        logger.error("verify-purchase called but GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is unset")
        raise HTTPException(status_code=503, detail="Google Play verification not configured")

    sub = await play_purchase_verify.verify_subscription_purchase(
        settings,
        purchase_token=body.purchase_token,
        product_id=body.product_id,
    )
    product = None
    if sub is None:
        product = await play_purchase_verify.verify_product_purchase(
            settings,
            purchase_token=body.purchase_token,
            product_id=body.product_id,
        )
    if sub is None and product is None:
        raise HTTPException(status_code=402, detail="Purchase verification failed")

    # Record only after Google confirms the token, so a failed verify can be retried.
    recorded = await play_purchase_verify.record_play_purchase(
        settings,
        purchase_token=body.purchase_token,
        session_id=body.session_id,
        product_id=body.product_id,
    )
    if not recorded:
        if bkt.effectively_premium():
            return GooglePlayVerifyResponse(is_premium=True, source="google_play")
        raise HTTPException(status_code=409, detail="Purchase token already processed")

    supabase_user_id = bkt.meta.get("supabaseUserId")
    expires: datetime | None = None
    if sub:
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
        clear_expires=expires is None,
    )
    if supabase_user_id:
        await session_repository.set_premium_by_user(
            str(supabase_user_id),
            True,
            settings,
            premium_source="google_play",
            premium_expires_at=expires,
            clear_expires=expires is None,
        )

    if not ok:
        raise HTTPException(status_code=502, detail="Could not grant premium")

    bkt.is_premium = True
    bkt.premium_source = "google_play"
    bkt.premium_expires_at = expires

    try:
        from app.services import expo_push

        await expo_push.notify_session(
            body.session_id,
            "premium_unlocked",
            settings=settings,
            event_key=f"premium_play:{body.purchase_token[-24:]}",
            supabase_user_id=str(supabase_user_id) if supabase_user_id else None,
        )
    except Exception:
        logger.exception("premium_unlocked push failed session=%s", body.session_id)

    return GooglePlayVerifyResponse(is_premium=True, source="google_play")

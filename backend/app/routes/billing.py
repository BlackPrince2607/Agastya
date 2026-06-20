"""Stripe Checkout for web subscriptions."""

from __future__ import annotations

import logging
from typing import Annotated

import stripe
from fastapi import APIRouter, Depends, HTTPException

from app.config import Settings, get_settings
from app.middleware.rate_limit import check_rate_limit
from app.schemas.billing import StripeCheckoutBody, StripeCheckoutResponse
from app.services.bucket_store import bucket, has_bucket, set_bucket
from app.services import session_repository
from app.utils.validators import assert_device_binding, validate_session_id

logger = logging.getLogger(__name__)

router = APIRouter(tags=["billing"], dependencies=[Depends(check_rate_limit)])


async def _hydrate(session_id: str, settings: Settings) -> None:
    validate_session_id(session_id)
    if has_bucket(session_id):
        return
    loaded = await session_repository.load(session_id, settings)
    if loaded:
        set_bucket(session_id, loaded)
    else:
        bucket(session_id)


def _price_id(settings: Settings, period: str) -> str:
    if period == "annual":
        price = settings.stripe_price_annual
    else:
        price = settings.stripe_price_monthly
    if not price:
        raise HTTPException(status_code=503, detail="Stripe price not configured")
    return price


@router.post("/billing/checkout", response_model=StripeCheckoutResponse, response_model_by_alias=True)
async def create_checkout_session(
    body: StripeCheckoutBody,
    settings: Annotated[Settings, Depends(get_settings)],
) -> StripeCheckoutResponse:
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured")

    await _hydrate(body.session_id, settings)
    bkt = bucket(body.session_id)
    assert_device_binding(
        session_id=body.session_id,
        device_install_id=body.device_install_id,
        stored_device_id=bkt.meta.get("deviceInstallId"),
    )
    if not bkt.meta.get("deviceInstallId"):
        bkt.meta["deviceInstallId"] = body.device_install_id

    stripe.api_key = settings.stripe_secret_key
    price_id = _price_id(settings, body.billing_period)
    supabase_user_id = bkt.meta.get("supabaseUserId")

    metadata: dict[str, str] = {
        "session_id": body.session_id,
        "device_install_id": body.device_install_id,
    }
    if supabase_user_id:
        metadata["supabase_user_id"] = str(supabase_user_id)

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=body.success_url,
            cancel_url=body.cancel_url,
            client_reference_id=body.session_id,
            metadata=metadata,
        )
    except stripe.StripeError as exc:
        logger.warning("Stripe checkout failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not create checkout session") from exc

    if not session.url:
        raise HTTPException(status_code=502, detail="Stripe checkout URL missing")

    return StripeCheckoutResponse(checkout_url=session.url)

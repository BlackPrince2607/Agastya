"""Account deletion and auth helpers."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException

from app.auth.supabase_jwt import _bearer_token, verify_supabase_access_token
from app.config import Settings, get_settings
from app.middleware.rate_limit import check_rate_limit
from app.schemas.auth import CheckEmailBody, CheckEmailResponse, DeleteAccountResponse
from app.services.auth_admin import delete_user_by_id, user_exists_by_email
from app.services import billing_intents, razorpay_client, session_repository
from app.services.palm_storage import delete_palm_capture_if_configured

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth"], dependencies=[Depends(check_rate_limit)])


@router.post("/auth/check-email", response_model=CheckEmailResponse)
async def check_email(
    body: CheckEmailBody,
    settings: Annotated[Settings, Depends(get_settings)],
) -> CheckEmailResponse:
    exists = await user_exists_by_email(body.email, settings)
    if exists is None:
        return CheckEmailResponse(exists=False, checked=False)
    return CheckEmailResponse(exists=exists, checked=True)


async def _cancel_razorpay_subscriptions(user_id: str, settings: Settings) -> None:
    """Stop renewals before the account disappears; otherwise Razorpay keeps charging."""
    if not settings.razorpay_configured:
        return
    intents = await billing_intents.list_paid_subscription_intents(
        settings, supabase_user_id=user_id, session_id=None
    )
    for intent in intents:
        subscription_id = str(intent["razorpay_subscription_id"])
        try:
            await razorpay_client.cancel_subscription_if_active(
                settings, subscription_id, at_cycle_end=False
            )
        except Exception as exc:
            logger.error("Cancel subscription %s on account delete failed: %s", subscription_id, exc)
            raise HTTPException(
                status_code=502,
                detail="Could not cancel your subscription. Please try again or contact support.",
            ) from exc


@router.post("/auth/delete-account", response_model=DeleteAccountResponse)
async def delete_account(
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> DeleteAccountResponse:
    if not settings.supabase_enabled:
        raise HTTPException(status_code=503, detail="Account deletion requires Supabase configuration")

    token = _bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Authorization bearer token required")
    claims = verify_supabase_access_token(token, settings)
    user_id = str(claims.get("sub", ""))

    await _cancel_razorpay_subscriptions(user_id, settings)

    rows = await session_repository.list_sessions_for_user(user_id, settings)
    for row in rows:
        storage_path = row.get("palm_storage_path")
        if storage_path:
            await delete_palm_capture_if_configured(settings, storage_path=str(storage_path))

    deleted_sessions = len(rows)
    if deleted_sessions:
        await session_repository.delete_sessions_for_user(user_id, settings)

    auth_deleted = await delete_user_by_id(user_id, settings)
    if not auth_deleted:
        logger.error("Failed to delete Supabase auth user %s after session cleanup", user_id)
        raise HTTPException(status_code=502, detail="Could not delete your account. Please try again or contact support.")

    return DeleteAccountResponse(deleted_sessions=deleted_sessions)

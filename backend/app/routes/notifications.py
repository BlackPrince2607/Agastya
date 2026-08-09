"""Push token registration, client events, and cron dispatch."""

from __future__ import annotations

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException

from app.config import Settings, get_settings
from app.middleware.rate_limit import check_rate_limit
from app.schemas.notifications import (
    OkResponse,
    PushEventBody,
    PushHeartbeatBody,
    RegisterPushTokenBody,
    UnregisterPushTokenBody,
)
from app.services import expo_push, push_token_repository
from app.services.bucket_store import bucket, has_bucket, set_bucket
from app.services import session_repository
from app.services.push_cron import dispatch_all
from app.utils.validators import assert_device_binding, validate_session_id

logger = logging.getLogger(__name__)

router = APIRouter(tags=["notifications"], dependencies=[Depends(check_rate_limit)])


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


@router.post("/notifications/register-token", response_model=OkResponse)
async def register_token(
    body: RegisterPushTokenBody,
    settings: Annotated[Settings, Depends(get_settings)],
) -> OkResponse:
    await _hydrate(body.session_id, settings)
    bkt = bucket(body.session_id)
    assert_device_binding(
        session_id=body.session_id,
        device_install_id=body.device_install_id,
        stored_device_id=bkt.meta.get("deviceInstallId"),
        allow_rebind=True,
    )
    if not bkt.meta.get("deviceInstallId"):
        bkt.meta["deviceInstallId"] = body.device_install_id

    # Push token FK requires the session row to exist.
    if session_repository.is_enabled(settings):
        await session_repository.save(body.session_id, bkt, settings)

    user_id = bkt.meta.get("supabaseUserId")
    ok = await push_token_repository.upsert_token(
        session_id=body.session_id,
        expo_push_token=body.expo_push_token,
        platform=body.platform,
        timezone_offset_minutes=body.timezone_offset_minutes,
        supabase_user_id=str(user_id) if user_id else None,
        settings=settings,
    )
    if not ok and settings.supabase_enabled:
        raise HTTPException(status_code=503, detail="Could not save push token")
    return OkResponse(ok=True)


@router.post("/notifications/unregister-token", response_model=OkResponse)
async def unregister_token(
    body: UnregisterPushTokenBody,
    settings: Annotated[Settings, Depends(get_settings)],
) -> OkResponse:
    await _hydrate(body.session_id, settings)
    bkt = bucket(body.session_id)
    assert_device_binding(
        session_id=body.session_id,
        device_install_id=body.device_install_id,
        stored_device_id=bkt.meta.get("deviceInstallId"),
        allow_rebind=False,
    )
    if body.expo_push_token:
        await push_token_repository.disable_token(body.expo_push_token, settings)
    else:
        await push_token_repository.disable_tokens_for_session(body.session_id, settings)
    return OkResponse(ok=True)


@router.post("/notifications/heartbeat", response_model=OkResponse)
async def heartbeat(
    body: PushHeartbeatBody,
    settings: Annotated[Settings, Depends(get_settings)],
) -> OkResponse:
    await _hydrate(body.session_id, settings)
    bkt = bucket(body.session_id)
    assert_device_binding(
        session_id=body.session_id,
        device_install_id=body.device_install_id,
        stored_device_id=bkt.meta.get("deviceInstallId"),
        allow_rebind=True,
    )
    await push_token_repository.heartbeat(
        session_id=body.session_id,
        expo_push_token=body.expo_push_token,
        timezone_offset_minutes=body.timezone_offset_minutes,
        settings=settings,
    )
    return OkResponse(ok=True)


@router.post("/notifications/event", response_model=OkResponse)
async def client_push_event(
    body: PushEventBody,
    settings: Annotated[Settings, Depends(get_settings)],
) -> OkResponse:
    """Client-triggered remote push (compatibility ready, payment pending, etc.)."""
    await _hydrate(body.session_id, settings)
    bkt = bucket(body.session_id)
    assert_device_binding(
        session_id=body.session_id,
        device_install_id=body.device_install_id,
        stored_device_id=bkt.meta.get("deviceInstallId"),
        allow_rebind=False,
    )

    if body.expo_push_token:
        user_id = bkt.meta.get("supabaseUserId")
        await push_token_repository.upsert_token(
            session_id=body.session_id,
            expo_push_token=body.expo_push_token,
            supabase_user_id=str(user_id) if user_id else None,
            settings=settings,
        )

    event_key = body.event_key or body.event
    user_id = bkt.meta.get("supabaseUserId")
    sent = await expo_push.notify_session(
        body.session_id,
        body.event,
        settings=settings,
        event_key=event_key,
        supabase_user_id=str(user_id) if user_id else None,
    )
    return OkResponse(ok=True, sent=sent)


@router.post("/notifications/cron/dispatch")
async def cron_dispatch(
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    """Hourly cron entrypoint — Authorization: Bearer $CRON_SECRET."""
    secret = (settings.cron_secret or "").strip()
    if not secret:
        if not settings.debug:
            raise HTTPException(status_code=503, detail="CRON_SECRET not configured")
        logger.warning("CRON_SECRET unset — allowing cron dispatch in DEBUG")
    else:
        expected = f"Bearer {secret}"
        if (authorization or "").strip() != expected:
            raise HTTPException(status_code=401, detail="Unauthorized")

    counts = await dispatch_all(settings)
    return {"ok": True, "counts": counts}

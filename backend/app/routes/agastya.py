"""Core Agastya HTTP surface — palm v1, dossiers, chat, daily rituals."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from app.auth.supabase_jwt import _bearer_token, verify_supabase_access_token
from app.config import Settings, get_settings
from app.middleware.rate_limit import check_rate_limit
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.palm_analyze import PalmAnalyzeBody
from app.schemas.predictions import PredictionsGenerateBody, PredictionsResponse
from app.schemas.report import GenerateReportBody
from app.schemas.session import (
    SessionBootstrapResponse,
    SessionMergeBody,
    SessionMergeResponse,
    SessionProfilePatchBody,
    SessionProfileResponse,
    SessionRegisterBody,
    SessionRegisterResponse,
)
from app.schemas.tasks import DailyTasksBody, DailyTasksResponse
from app.services.ai_interactions import generate_chat_reply, generate_daily_tasks
from app.services.bucket_store import SessionBucket, bucket, has_bucket, link_supabase_user, set_bucket
from app.services.palm_pipeline import analyze_palm
from app.services.palm_storage import upload_palm_capture_if_configured
from app.services.predictions_engine import build_predictions_payload
from app.services.report_engine import build_report_payload
from app.services import session_repository
from app.utils.validators import assert_device_binding, validate_session_id

router = APIRouter(tags=["agastya"], dependencies=[Depends(check_rate_limit)])


async def _hydrate(session_id: str, settings: Settings) -> None:
    validate_session_id(session_id)
    if has_bucket(session_id):
        return
    loaded = await session_repository.load(session_id, settings)
    if loaded:
        set_bucket(session_id, loaded)
    else:
        bucket(session_id)


async def _persist(session_id: str, settings: Settings) -> None:
    await session_repository.save(session_id, bucket(session_id), settings)


async def _sync_premium(session_id: str, settings: Settings) -> SessionBucket:
    await _hydrate(session_id, settings)
    bkt = bucket(session_id)
    await session_repository.refresh_premium_from_db(session_id, bkt, settings)
    return bkt


@router.post("/sessions/register", response_model=SessionRegisterResponse)
async def register_session(
    body: SessionRegisterBody,
    settings: Annotated[Settings, Depends(get_settings)],
) -> SessionRegisterResponse:
    await _hydrate(body.session_id, settings)
    bkt = bucket(body.session_id)
    stored = bkt.meta.get("deviceInstallId")
    if stored and stored != body.device_install_id:
        raise HTTPException(status_code=403, detail="deviceInstallId does not match session owner")
    bkt.meta["deviceInstallId"] = body.device_install_id
    if body.display_name:
        bkt.meta["displayName"] = body.display_name
    if body.gender:
        bkt.meta["gender"] = body.gender
    if body.focus_topics:
        bkt.meta["focusTopics"] = body.focus_topics
    await _persist(body.session_id, settings)
    return SessionRegisterResponse()


def _bootstrap_from_bucket(session_id: str, bkt: SessionBucket) -> SessionBootstrapResponse:
    meta = bkt.meta
    topics = meta.get("focusTopics") or []
    return SessionBootstrapResponse(
        session_id=session_id,
        device_install_id=meta.get("deviceInstallId"),
        display_name=meta.get("displayName"),
        gender=meta.get("gender"),
        focus_topics=topics if isinstance(topics, list) else [],
        supabase_user_id=meta.get("supabaseUserId"),
        palm_storage_path=meta.get("palmStoragePath"),
        palm_analysis=bkt.palm.model_dump() if bkt.palm else None,
        preview_report=bkt.preview.model_dump(by_alias=True) if bkt.preview else None,
        full_report=bkt.full.model_dump(by_alias=True) if bkt.full else None,
        is_premium=bkt.is_premium,
    )


@router.get(
    "/sessions/bootstrap",
    response_model=SessionBootstrapResponse,
    response_model_by_alias=True,
)
async def session_bootstrap(
    settings: Annotated[Settings, Depends(get_settings)],
    session_id: str = Query(..., alias="sessionId"),
) -> SessionBootstrapResponse:
    validate_session_id(session_id)
    await _hydrate(session_id, settings)
    bkt = await _sync_premium(session_id, settings)
    return _bootstrap_from_bucket(session_id, bkt)


@router.get(
    "/sessions/profile",
    response_model=SessionProfileResponse,
    response_model_by_alias=True,
)
async def session_profile(
    settings: Annotated[Settings, Depends(get_settings)],
    session_id: str = Query(..., alias="sessionId"),
) -> SessionProfileResponse:
    validate_session_id(session_id)
    await _hydrate(session_id, settings)
    bkt = bucket(session_id)
    meta = bkt.meta
    topics = meta.get("focusTopics") or []
    return SessionProfileResponse(
        session_id=session_id,
        device_install_id=meta.get("deviceInstallId"),
        display_name=meta.get("displayName"),
        gender=meta.get("gender"),
        focus_topics=topics if isinstance(topics, list) else [],
        supabase_user_id=meta.get("supabaseUserId"),
        palm_storage_path=meta.get("palmStoragePath"),
    )


@router.patch("/sessions/profile", response_model=SessionProfileResponse, response_model_by_alias=True)
async def patch_session_profile(
    body: SessionProfilePatchBody,
    settings: Annotated[Settings, Depends(get_settings)],
) -> SessionProfileResponse:
    await _hydrate(body.session_id, settings)
    bkt = bucket(body.session_id)
    assert_device_binding(
        session_id=body.session_id,
        device_install_id=body.device_install_id,
        stored_device_id=bkt.meta.get("deviceInstallId"),
    )
    if not bkt.meta.get("deviceInstallId"):
        bkt.meta["deviceInstallId"] = body.device_install_id
    if body.display_name is not None:
        bkt.meta["displayName"] = body.display_name
    if body.gender is not None:
        bkt.meta["gender"] = body.gender
    if body.focus_topics is not None:
        bkt.meta["focusTopics"] = body.focus_topics
    await _persist(body.session_id, settings)
    meta = bkt.meta
    topics = meta.get("focusTopics") or []
    return SessionProfileResponse(
        session_id=body.session_id,
        device_install_id=meta.get("deviceInstallId"),
        display_name=meta.get("displayName"),
        gender=meta.get("gender"),
        focus_topics=topics if isinstance(topics, list) else [],
        supabase_user_id=meta.get("supabaseUserId"),
        palm_storage_path=meta.get("palmStoragePath"),
    )


@router.post("/sessions/merge", response_model=SessionMergeResponse)
async def merge_session(
    body: SessionMergeBody,
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> SessionMergeResponse:
    if settings.supabase_enabled and not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=503,
            detail="SUPABASE_JWT_SECRET is required for session merge",
        )
    token = _bearer_token(authorization)
    if settings.supabase_jwt_secret:
        if not token:
            raise HTTPException(status_code=401, detail="Authorization bearer token required")
        claims = verify_supabase_access_token(token, settings)
        token_user = str(claims.get("sub", ""))
        if token_user != body.supabase_user_id:
            raise HTTPException(status_code=403, detail="Token subject does not match supabaseUserId")

    await _hydrate(body.anonymous_session_id, settings)
    linked = link_supabase_user(body.anonymous_session_id, body.supabase_user_id)
    if session_repository.is_enabled(settings):
        await session_repository.link_user(
            body.anonymous_session_id,
            body.supabase_user_id,
            settings,
        )
        await _persist(body.anonymous_session_id, settings)
    return SessionMergeResponse(linked=linked)


@router.post("/palm/analyze")
async def palm_analyze(
    body: PalmAnalyzeBody,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any]:
    await _hydrate(body.session_id, settings)
    bkt = bucket(body.session_id)
    assert_device_binding(
        session_id=body.session_id,
        device_install_id=body.device_install_id,
        stored_device_id=bkt.meta.get("deviceInstallId"),
    )
    if body.device_install_id and not bkt.meta.get("deviceInstallId"):
        bkt.meta["deviceInstallId"] = body.device_install_id
    palm = await analyze_palm(settings, body)
    bkt.palm = palm
    storage_path = await upload_palm_capture_if_configured(
        settings,
        session_id=body.session_id,
        image_base64=body.image_base64,
    )
    if storage_path:
        bkt.meta["palmStoragePath"] = storage_path
    await _persist(body.session_id, settings)
    return palm.model_dump()


@router.post("/reports/generate")
async def reports_generate(
    body: GenerateReportBody,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any]:
    bkt = await _sync_premium(body.session_id, settings)
    if body.mode == "full" and not bkt.is_premium:
        raise HTTPException(status_code=403, detail="Premium required for full report")
    palm = body.palm_analysis or bkt.palm
    if palm is None:
        raise HTTPException(status_code=400, detail="Run palm analysis before requesting a dossier.")
    report = await build_report_payload(
        settings,
        seed=body.seed,
        palm=palm,
        topics=body.focus_topics,
        mode=body.mode,
        display_name=body.display_name,
        gender=body.gender,
    )
    if body.mode == "preview":
        bkt.preview = report
    else:
        bkt.full = report
    if body.seed:
        bkt.meta["readingSeed"] = body.seed
    await _persist(body.session_id, settings)
    return report.model_dump(by_alias=True)


@router.post("/chat", response_model=ChatResponse)
async def cosmic_chat(body: ChatRequest, settings: Annotated[Settings, Depends(get_settings)]) -> ChatResponse:
    bkt = await _sync_premium(body.session_id, settings)
    reply, suggestions = await generate_chat_reply(
        settings, body, server_is_premium=bkt.is_premium
    )
    tail = [{"role": m.role, "content": m.content} for m in body.messages]
    tail.append({"role": "guide", "content": reply})
    bkt.chat_tail = tail[-40:]
    await _persist(body.session_id, settings)
    return ChatResponse(reply=reply, suggestions=suggestions)


@router.post("/tasks/daily", response_model=DailyTasksResponse, response_model_by_alias=True)
async def daily_tasks(body: DailyTasksBody, settings: Annotated[Settings, Depends(get_settings)]) -> DailyTasksResponse:
    bkt = await _sync_premium(body.session_id, settings)
    body = body.model_copy(update={"is_premium": bkt.is_premium})
    tasks, variant = await generate_daily_tasks(settings, body)
    return DailyTasksResponse(tasks=tasks, variant=variant)


@router.post(
    "/predictions/generate",
    response_model=PredictionsResponse,
    response_model_by_alias=True,
)
async def predictions_generate(
    body: PredictionsGenerateBody,
    settings: Annotated[Settings, Depends(get_settings)],
) -> PredictionsResponse:
    bkt = await _sync_premium(body.session_id, settings)
    if body.period in {"3month", "year"} and not bkt.is_premium:
        raise HTTPException(status_code=403, detail="Premium required for this prediction period")
    palm = body.palm_analysis or bkt.palm
    if palm is None:
        raise HTTPException(status_code=400, detail="Run palm analysis before requesting predictions.")
    seed = body.seed or bkt.meta.get("readingSeed") or body.session_id
    topics = body.focus_topics or (bkt.meta.get("focusTopics") if isinstance(bkt.meta.get("focusTopics"), list) else [])
    result = await build_predictions_payload(
        settings,
        seed=seed,
        period=body.period,
        palm=palm,
        topics=topics or [],
    )
    bkt.predictions[body.period] = result
    await _persist(body.session_id, settings)
    return result

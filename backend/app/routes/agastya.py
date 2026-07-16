"""Core Agastya HTTP surface — palm v1, dossiers, chat, daily rituals."""

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from app.auth.supabase_jwt import _bearer_token, verify_supabase_access_token
from app.config import Settings, get_settings
from app.middleware.rate_limit import check_rate_limit
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.palm_analyze import PalmAnalyzeBody
from app.schemas.palm_landmarks import PalmLandmarksBody, PalmLandmarksResponse
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
from app.schemas.guidance import (
    DailyGuidanceBody,
    DailyGuidanceResponse,
    DailyReflectBody,
    DailyReflectResponse,
    JourneyTimelineBody,
    JourneyTimelineResponse,
    WeeklySummaryBody,
    WeeklySummaryResponse,
)
from app.schemas.tasks import DailyTasksBody, DailyTasksResponse
from app.services.ai_interactions import GuideLlmUnavailableError, generate_chat_reply, generate_daily_tasks
from app.services.daily_insight import generate_daily_guidance
from app.services.day_context import is_complete_daily_context, utc_today_iso
from app.services.journey_timeline import build_journey_timeline
from app.services.user_memory import maybe_extract_and_merge_memory, stamp_reflection_completed
from app.services.weekly_insight import generate_weekly_summary, cached_weekly_if_current
from app.services.bucket_store import SessionBucket, bucket, has_bucket, link_supabase_user, merge_bucket_data, set_bucket
from app.services.palm_pipeline import analyze_palm
from app.services.palm_landmarks import detect_hand_landmarks_from_bytes
from app.services.palm_storage import decode_capture_bytes, upload_palm_capture_if_configured
from app.services.predictions_engine import build_predictions_payload
from app.services.report_engine import build_report_payload
from app.services import session_repository
from app.utils.validators import assert_device_binding, validate_session_id

logger = logging.getLogger(__name__)

router = APIRouter(tags=["agastya"], dependencies=[Depends(check_rate_limit)])


def _claims_email(claims: dict[str, Any]) -> str:
    email = claims.get("email")
    return email.strip().lower() if isinstance(email, str) else ""


def _email_is_premium_allowlisted(email: str, settings: Settings) -> bool:
    return bool(email) and email in settings.premium_email_allowlist_set


async def _grant_allowlist_premium(
    *,
    session_id: str,
    bkt: SessionBucket,
    user_id: str,
    email: str,
    settings: Settings,
) -> bool:
    """Stamp is_premium for founder/tester emails from PREMIUM_EMAIL_ALLOWLIST."""
    if not _email_is_premium_allowlisted(email, settings):
        return False
    bkt.is_premium = True
    if session_repository.is_enabled(settings):
        await session_repository.set_premium_by_user(user_id, True, settings)
        await session_repository.set_premium_by_session(session_id, True, settings)
    return True


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


async def _persist(session_id: str, settings: Settings) -> None:
    if not session_repository.is_enabled(settings):
        return
    ok = await session_repository.save(session_id, bucket(session_id), settings)
    if not ok:
        raise HTTPException(
            status_code=503,
            detail="Failed to save session. Please try again.",
        )


async def _hydrate_from_user_sessions(
    session_id: str,
    bkt: SessionBucket,
    settings: Settings,
) -> None:
    """Merge prior user sessions: always inherit premium; copy readings when current is empty."""
    user_id = bkt.meta.get("supabaseUserId")
    if not user_id or not session_repository.is_enabled(settings):
        return

    prior_rows = await session_repository.list_sessions_for_user(str(user_id), settings)
    best_row: dict[str, Any] | None = None
    best_score = -1
    inherited_premium = False
    for row in prior_rows:
        if row.get("session_id") == session_id:
            continue
        if row.get("is_premium"):
            inherited_premium = True
        score = _restore_score(row)
        if score > best_score:
            best_score = score
            best_row = row

    if inherited_premium:
        bkt.is_premium = True

    if bkt.palm or bkt.preview or bkt.full:
        if inherited_premium:
            await _persist(session_id, settings)
        return

    if best_row is None:
        if inherited_premium:
            await _persist(session_id, settings)
        return
    source = session_repository.row_to_bucket(best_row)
    merge_bucket_data(bkt, source)
    # Persist merge so cold workers do not re-list all user sessions on every bootstrap.
    await _persist(session_id, settings)


def _restore_score(row: dict[str, Any]) -> int:
    score = 0
    if row.get("palm_analysis"):
        score += 4
    if row.get("preview_report"):
        score += 2
    if row.get("full_report"):
        score += 3
    if row.get("is_premium"):
        score += 1
    if row.get("chat_tail"):
        score += 1
    return score


async def _richest_session_for_user(
    user_id: str,
    settings: Settings,
    *,
    exclude_session_id: str | None = None,
) -> dict[str, Any] | None:
    if not session_repository.is_enabled(settings):
        return None
    prior_rows = await session_repository.list_sessions_for_user(str(user_id), settings)
    best_row: dict[str, Any] | None = None
    best_score = -1
    for row in prior_rows:
        if exclude_session_id and row.get("session_id") == exclude_session_id:
            continue
        score = _restore_score(row)
        if score > best_score:
            best_score = score
            best_row = row
    return best_row


def _bind_device(bkt: SessionBucket, session_id: str, device_install_id: str) -> None:
    stored = bkt.meta.get("deviceInstallId")
    assert_device_binding(
        session_id=session_id,
        device_install_id=device_install_id,
        stored_device_id=stored,
        allow_rebind=False,
    )
    if device_install_id:
        bkt.meta["deviceInstallId"] = device_install_id


async def _sync_premium(session_id: str, settings: Settings) -> SessionBucket:
    """Hydrate if needed; refresh premium only when the bucket was already warm in-memory."""
    was_cached = has_bucket(session_id)
    await _hydrate(session_id, settings)
    bkt = bucket(session_id)
    # Fresh DB hydrate already includes is_premium — skip the extra select.
    if was_cached:
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


def _slim_daily_context(bkt: SessionBucket) -> dict[str, Any] | None:
    ctx = bkt.daily_context
    if not is_complete_daily_context(ctx, utc_today_iso()):
        return None
    assert isinstance(ctx, dict)
    guidance = ctx.get("guidance") or {}
    return {
        "date": ctx.get("date"),
        "title": guidance.get("title"),
        "body": guidance.get("body"),
        "focusTheme": ctx.get("focusTheme"),
    }


def _slim_weekly_context(bkt: SessionBucket) -> dict[str, Any] | None:
    cached = cached_weekly_if_current(bkt)
    if cached is None:
        return None
    return {
        "weekKey": cached.week_key,
        "title": cached.title,
        "body": cached.body,
        "topTheme": cached.top_theme,
        "consistencyNote": cached.consistency_note,
        "currentChapter": cached.current_chapter,
    }


def _bootstrap_light_from_bucket(session_id: str, bkt: SessionBucket) -> SessionBootstrapResponse:
    """Anonymous restore: profile + premium + slim guidance only (no reading/chat)."""
    meta = bkt.meta
    topics = meta.get("focusTopics") or []
    return SessionBootstrapResponse(
        session_id=session_id,
        device_install_id=meta.get("deviceInstallId"),
        display_name=meta.get("displayName"),
        gender=meta.get("gender"),
        focus_topics=topics if isinstance(topics, list) else [],
        supabase_user_id=meta.get("supabaseUserId"),
        palm_storage_path=None,
        palm_analysis=None,
        preview_report=None,
        full_report=None,
        is_premium=bkt.is_premium,
        chat_tail=[],
        daily_context=_slim_daily_context(bkt),
        weekly_context=_slim_weekly_context(bkt),
    )


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
        chat_tail=bkt.chat_tail[-40:] if bkt.chat_tail else [],
        daily_context=_slim_daily_context(bkt),
        weekly_context=_slim_weekly_context(bkt),
    )


@router.get(
    "/sessions/bootstrap",
    response_model=SessionBootstrapResponse,
    response_model_by_alias=True,
)
async def session_bootstrap(
    settings: Annotated[Settings, Depends(get_settings)],
    session_id: str = Query(..., alias="sessionId"),
    device_install_id: str = Query(..., alias="deviceInstallId"),
) -> SessionBootstrapResponse:
    validate_session_id(session_id)
    bkt = await _sync_premium(session_id, settings)
    _bind_device(bkt, session_id, device_install_id)
    # Do not hydrate from other user sessions on anonymous bootstrap (keeps response light).
    return _bootstrap_light_from_bucket(session_id, bkt)


@router.get(
    "/sessions/bootstrap/authenticated",
    response_model=SessionBootstrapResponse,
    response_model_by_alias=True,
)
async def authenticated_session_bootstrap(
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> SessionBootstrapResponse:
    if not settings.supabase_enabled:
        raise HTTPException(status_code=503, detail="Supabase session persistence is not configured")

    token = _bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Authorization bearer token required")
    claims = verify_supabase_access_token(token, settings)
    user_id = str(claims.get("sub", ""))
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing subject")

    try:
        best_row = await _richest_session_for_user(user_id, settings)
    except session_repository.SupabaseUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail="Session storage temporarily unavailable. Please try again.",
        ) from exc
    if best_row is None:
        raise HTTPException(status_code=404, detail="No saved session found")

    session_id = str(best_row["session_id"])
    bkt = session_repository.row_to_bucket(best_row)
    if await _grant_allowlist_premium(
        session_id=session_id,
        bkt=bkt,
        user_id=user_id,
        email=_claims_email(claims),
        settings=settings,
    ):
        set_bucket(session_id, bkt)
        await _persist(session_id, settings)
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
    _bind_device(bkt, body.session_id, body.device_install_id)
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
    claims: dict[str, Any] = {}
    if settings.supabase_enabled:
        token = _bearer_token(authorization)
        if not token:
            raise HTTPException(status_code=401, detail="Authorization bearer token required")
        claims = verify_supabase_access_token(token, settings)
        token_user = str(claims.get("sub", ""))
        if token_user != body.supabase_user_id:
            raise HTTPException(status_code=403, detail="Token subject does not match supabaseUserId")

    await _hydrate(body.anonymous_session_id, settings)
    bkt = bucket(body.anonymous_session_id)
    existing_user = bkt.meta.get("supabaseUserId")
    if existing_user and str(existing_user) != body.supabase_user_id:
        raise HTTPException(status_code=403, detail="Session already linked to another account")
    if not body.device_install_id:
        raise HTTPException(status_code=403, detail="deviceInstallId required")
    _bind_device(bkt, body.anonymous_session_id, body.device_install_id)

    bkt.meta["supabaseUserId"] = body.supabase_user_id
    await _hydrate_from_user_sessions(body.anonymous_session_id, bkt, settings)
    await _grant_allowlist_premium(
        session_id=body.anonymous_session_id,
        bkt=bkt,
        user_id=body.supabase_user_id,
        email=_claims_email(claims),
        settings=settings,
    )

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
    try:
        await _hydrate(body.session_id, settings)
        bkt = bucket(body.session_id)
        _bind_device(bkt, body.session_id, body.device_install_id)
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
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("palm/analyze failed session=%s", body.session_id)
        raise HTTPException(status_code=500, detail="Palm analysis failed. Please try again.") from exc


@router.post("/palm/landmarks")
async def palm_landmarks(body: PalmLandmarksBody) -> dict[str, Any]:
    """Detect hand landmarks from a palm photo (MediaPipe). Used by native clients."""
    decoded = decode_capture_bytes(body.image_base64)
    if not decoded:
        return PalmLandmarksResponse(landmarks=None, source="not_found").model_dump()
    image_bytes, _, _ = decoded
    landmarks, source = detect_hand_landmarks_from_bytes(image_bytes, body.dominant_hand or "right")
    return PalmLandmarksResponse(landmarks=landmarks, source=source).model_dump()


@router.post("/reports/generate")
async def reports_generate(
    body: GenerateReportBody,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any]:
    await _hydrate(body.session_id, settings)
    bkt = bucket(body.session_id)
    _bind_device(bkt, body.session_id, body.device_install_id)
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


@router.post("/chat", response_model=ChatResponse, response_model_by_alias=True)
async def cosmic_chat(body: ChatRequest, settings: Annotated[Settings, Depends(get_settings)]) -> ChatResponse:
    await _hydrate(body.session_id, settings)
    bkt = bucket(body.session_id)
    _bind_device(bkt, body.session_id, body.device_install_id)
    bkt = await _sync_premium(body.session_id, settings)
    try:
        reply, suggestions = await generate_chat_reply(
            settings,
            body,
            server_is_premium=bkt.is_premium,
            prior_chat_tail=bkt.chat_tail,
            bkt=bkt,
        )
    except GuideLlmUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail="guide_llm_unavailable",
        ) from exc
    tail = [{"role": m.role, "content": m.content} for m in body.messages]
    tail.append({"role": "guide", "content": reply})
    bkt.chat_tail = tail[-40:]

    memory_changed = False
    last_user = next(
        (m.content for m in reversed(body.messages) if m.role in {"user", "you"}),
        "",
    )
    if last_user.strip():
        memory_changed = await maybe_extract_and_merge_memory(settings, bkt, last_user)

    await _persist(body.session_id, settings)
    if memory_changed:
        logger.info("user_memory_updated session=%s", body.session_id)
    return ChatResponse(reply=reply, suggestions=suggestions, memory_changed=memory_changed)


@router.post("/insights/daily", response_model=DailyGuidanceResponse, response_model_by_alias=True)
async def daily_guidance(
    body: DailyGuidanceBody, settings: Annotated[Settings, Depends(get_settings)]
) -> DailyGuidanceResponse:
    """Today's Guidance — cached once per calendar day on the session."""
    await _hydrate(body.session_id, settings)
    bkt = bucket(body.session_id)
    _bind_device(bkt, body.session_id, body.device_install_id)
    try:
        result, changed = await generate_daily_guidance(settings, body, bkt)
    except ValueError as exc:
        if str(exc) == "palm_required":
            raise HTTPException(status_code=400, detail="Run palm analysis before requesting guidance.") from exc
        raise
    if changed:
        await _persist(body.session_id, settings)
    return result


@router.post("/insights/reflect", response_model=DailyReflectResponse, response_model_by_alias=True)
async def daily_reflect(
    body: DailyReflectBody, settings: Annotated[Settings, Depends(get_settings)]
) -> DailyReflectResponse:
    """Stamp evening reflection onto today's daily_context (creates a same-day shell if needed)."""
    await _hydrate(body.session_id, settings)
    bkt = bucket(body.session_id)
    _bind_device(bkt, body.session_id, body.device_install_id)
    persisted = stamp_reflection_completed(bkt, body.note)
    if persisted:
        await _persist(body.session_id, settings)
    return DailyReflectResponse(ok=True, persisted=persisted)


@router.post("/insights/weekly", response_model=WeeklySummaryResponse, response_model_by_alias=True)
async def weekly_summary(
    body: WeeklySummaryBody, settings: Annotated[Settings, Depends(get_settings)]
) -> WeeklySummaryResponse:
    """Weekly Journey Summary — cached once per ISO week."""
    await _hydrate(body.session_id, settings)
    bkt = bucket(body.session_id)
    _bind_device(bkt, body.session_id, body.device_install_id)
    try:
        result, changed = await generate_weekly_summary(settings, body, bkt)
    except ValueError as exc:
        if str(exc) == "palm_required":
            raise HTTPException(status_code=400, detail="Run palm analysis before requesting weekly summary.") from exc
        raise
    if changed:
        await _persist(body.session_id, settings)
    return result


@router.post("/insights/journey", response_model=JourneyTimelineResponse, response_model_by_alias=True)
async def journey_timeline(
    body: JourneyTimelineBody, settings: Annotated[Settings, Depends(get_settings)]
) -> JourneyTimelineResponse:
    """Lightweight journey timeline derived from existing session + client consistency stats."""
    await _hydrate(body.session_id, settings)
    bkt = bucket(body.session_id)
    _bind_device(bkt, body.session_id, body.device_install_id)
    return build_journey_timeline(
        bkt,
        streak=body.streak,
        rituals_completed_total=body.rituals_completed_total,
    )


@router.post("/tasks/daily", response_model=DailyTasksResponse, response_model_by_alias=True)
async def daily_tasks(body: DailyTasksBody, settings: Annotated[Settings, Depends(get_settings)]) -> DailyTasksResponse:
    await _hydrate(body.session_id, settings)
    bkt = bucket(body.session_id)
    _bind_device(bkt, body.session_id, body.device_install_id)
    bkt = await _sync_premium(body.session_id, settings)
    body = body.model_copy(update={"is_premium": bkt.is_premium})
    tasks, variant, focus_theme, changed = await generate_daily_tasks(settings, body, bkt)
    # tasksCache lives under daily_context but never overwrites Today's Focus / guidance.
    if changed:
        await _persist(body.session_id, settings)
    return DailyTasksResponse(tasks=tasks, variant=variant, focus_theme=focus_theme)


@router.post(
    "/predictions/generate",
    response_model=PredictionsResponse,
    response_model_by_alias=True,
)
async def predictions_generate(
    body: PredictionsGenerateBody,
    settings: Annotated[Settings, Depends(get_settings)],
) -> PredictionsResponse:
    await _hydrate(body.session_id, settings)
    bkt = bucket(body.session_id)
    _bind_device(bkt, body.session_id, body.device_install_id)
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

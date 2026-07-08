"""Palm analysis pipeline — delegate here so routes stay thin."""

from __future__ import annotations

import logging

from fastapi import HTTPException

from app.config import Settings
from app.schemas.palm import PalmAnalysis
from app.schemas.palm_analyze import PalmAnalyzeBody
from app.services.palm_ai import palm_analysis_from_vision
from app.services.palm_cv import merge_cv_into_analysis
from app.services.palm_dummy import dummy_palm_analysis

logger = logging.getLogger(__name__)


def _entropy_from_body(body: PalmAnalyzeBody) -> str:
    entropy = body.seed
    if body.image_base64:
        entropy = f"{body.seed}:{body.image_base64[-48:]}"
    return entropy


def _use_real_landmarks(body: PalmAnalyzeBody) -> bool:
    return body.landmarks_source == "mediapipe" and bool(body.landmarks)


async def analyze_palm(settings: Settings, body: PalmAnalyzeBody) -> PalmAnalysis:
    entropy = _entropy_from_body(body)
    img = body.image_base64.strip() if isinstance(body.image_base64, str) else None
    has_image = bool(img)
    mode = settings.palm_analysis_mode
    ai_mode = mode in {"vision", "hybrid"}

    if mode == "dummy":
        result = dummy_palm_analysis(entropy)
        if _use_real_landmarks(body):
            return merge_cv_into_analysis(result, body.landmarks)
        return result

    if settings.llm_enabled and ai_mode and not has_image:
        raise HTTPException(status_code=400, detail="Palm image required for AI analysis.")

    inferred: PalmAnalysis | None = None
    if settings.llm_enabled and has_image and ai_mode:
        inferred = await palm_analysis_from_vision(
            settings,
            image_base64=img or "",
            seed=body.seed,
            dominant_hand=body.dominant_hand,
        )

    if inferred is not None:
        if inferred.image_quality in {"no_hand", "poor"} and not settings.debug:
            raise HTTPException(
                status_code=422,
                detail="No clear palm visible - please retake the photo with your palm open and well lit.",
            )
        if mode == "hybrid" and _use_real_landmarks(body):
            inferred = merge_cv_into_analysis(inferred, body.landmarks)
        return inferred

    if has_image and settings.llm_enabled:
        logger.error("palm_fallback reason=openrouter_vision_failed seed=%s", body.seed[:32])

    logger.warning("Palm analysis falling back to deterministic motifs (seed entropy)")
    fallback = dummy_palm_analysis(entropy)
    fallback = fallback.model_copy(update={"analysis_source": "fallback"})
    if _use_real_landmarks(body):
        return merge_cv_into_analysis(fallback, body.landmarks)
    return fallback

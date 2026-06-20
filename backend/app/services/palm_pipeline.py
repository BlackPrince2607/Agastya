"""Palm analysis pipeline — delegate here so routes stay thin."""

from __future__ import annotations

import logging

from fastapi import HTTPException

from app.config import Settings
from app.schemas.palm import PalmAnalysis
from app.schemas.palm_analyze import PalmAnalyzeBody
from app.services.palm_ai import palm_analysis_from_groq
from app.services.palm_cv import merge_cv_into_analysis
from app.services.palm_dummy import dummy_palm_analysis

logger = logging.getLogger(__name__)


def _entropy_from_body(body: PalmAnalyzeBody) -> str:
    entropy = body.seed
    if body.image_base64:
        entropy = f"{body.seed}:{body.image_base64[-48:]}"
    return entropy


async def analyze_palm(settings: Settings, body: PalmAnalyzeBody) -> PalmAnalysis:
    entropy = _entropy_from_body(body)
    img = body.image_base64.strip() if isinstance(body.image_base64, str) else None
    has_image = bool(img)
    mode = settings.palm_analysis_mode

    if mode == "dummy":
        result = dummy_palm_analysis(entropy)
        return merge_cv_into_analysis(result, body.landmarks)

    inferred: PalmAnalysis | None = None
    if settings.groq_enabled and has_image:
        inferred = await palm_analysis_from_groq(
            settings,
            image_base64=img or "",
            seed=body.seed,
            dominant_hand=body.dominant_hand,
        )

    if inferred is not None:
        if inferred.image_quality == "no_hand" and not settings.debug:
            raise HTTPException(
                status_code=422,
                detail="No clear palm visible — please retake the photo with your palm open and well lit.",
            )
        if mode == "hybrid" or body.landmarks:
            inferred = merge_cv_into_analysis(inferred, body.landmarks)
        return inferred

    if has_image and settings.groq_enabled and not settings.debug:
        raise HTTPException(
            status_code=422,
            detail="Could not analyze palm image — try better lighting and retake the photo.",
        )

    logger.warning("Palm analysis falling back to deterministic motifs (seed entropy)")
    fallback = dummy_palm_analysis(entropy)
    fallback = fallback.model_copy(update={"analysis_source": "fallback"})
    return merge_cv_into_analysis(fallback, body.landmarks)

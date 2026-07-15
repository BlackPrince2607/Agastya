"""Palm analysis pipeline — vision narrative + OpenCV crease geometry."""

from __future__ import annotations

import logging

from fastapi import HTTPException

from app.config import Settings
from app.schemas.palm import PalmAnalysis
from app.schemas.palm_analyze import PalmAnalyzeBody
from app.services.palm_ai import palm_analysis_from_vision
from app.services.palm_crease import _decode_bgr
from app.services.palm_cv import apply_crease_result, merge_cv_into_analysis, run_crease_extraction
from app.services.palm_dummy import dummy_palm_analysis
from app.services.palm_landmarks import detect_hand_landmarks_from_bytes
from app.services.palm_storage import decode_capture_bytes

logger = logging.getLogger(__name__)


def _entropy_from_body(body: PalmAnalyzeBody) -> str:
    entropy = body.seed
    if body.image_base64:
        entropy = f"{body.seed}:{body.image_base64[-48:]}"
    return entropy


def _resolve_landmarks(body: PalmAnalyzeBody) -> tuple[list[list[float]] | None, str | None]:
    """Prefer server MediaPipe; fall back to client landmarks when reliable."""
    img = body.image_base64
    if img:
        decoded = decode_capture_bytes(img)
        if decoded is not None:
            data, _, _ = decoded
            landmarks, source = detect_hand_landmarks_from_bytes(
                data,
                dominant_hand=body.dominant_hand or "right",
            )
            if landmarks and source == "mediapipe":
                return landmarks, source

    if body.landmarks and body.landmarks_source == "mediapipe":
        return body.landmarks, body.landmarks_source

    # roi_estimate is a client fake — only use if nothing else (and crease may fail)
    if body.landmarks and body.landmarks_source in {"mediapipe", "roi_estimate"}:
        return body.landmarks, body.landmarks_source
    return None, None


def _attach_creases(
    analysis: PalmAnalysis,
    body: PalmAnalyzeBody,
    landmarks: list[list[float]] | None,
    settings: Settings,
) -> PalmAnalysis:
    img = body.image_base64.strip() if isinstance(body.image_base64, str) else None
    return merge_cv_into_analysis(
        analysis,
        landmarks,
        image_base64=img,
        allow_landmark_heuristic=settings.palm_crease_fallback_heuristic,
    )


async def analyze_palm(settings: Settings, body: PalmAnalyzeBody) -> PalmAnalysis:
    entropy = _entropy_from_body(body)
    img = body.image_base64.strip() if isinstance(body.image_base64, str) else None
    has_image = bool(img)
    mode = settings.palm_analysis_mode
    ai_mode = mode in {"vision", "hybrid"}

    landmarks, _lm_source = _resolve_landmarks(body)

    if mode == "dummy":
        result = dummy_palm_analysis(entropy)
        if has_image:
            return _attach_creases(result, body, landmarks, settings)
        return result

    if settings.llm_enabled and ai_mode and not has_image:
        raise HTTPException(status_code=400, detail="Palm image required for AI analysis.")

    # When we have an image, run crease extraction (geometry owned by CV).
    crease = None
    if has_image:
        crease = run_crease_extraction(img, landmarks)
        # Force retake only when the image decodes but no hand landmarks exist.
        if (
            crease.image_quality == "no_hand"
            and not landmarks
            and _decode_bgr(img or "") is not None
            and not settings.debug
        ):
            raise HTTPException(
                status_code=422,
                detail="No clear palm visible - please retake the photo with your palm open and well lit.",
            )

    inferred: PalmAnalysis | None = None
    if settings.llm_enabled and has_image and ai_mode:
        inferred = await palm_analysis_from_vision(
            settings,
            image_base64=img or "",
            seed=body.seed,
            dominant_hand=body.dominant_hand,
            gender=body.gender,
        )

    if inferred is not None:
        # Strip any model geometry before merge
        inferred = inferred.model_copy(update={"line_geometry": None, "geometry_source": None})
        if inferred.image_quality in {"no_hand", "poor"} and not settings.debug:
            raise HTTPException(
                status_code=422,
                detail="No clear palm visible - please retake the photo with your palm open and well lit.",
            )
        if crease is not None and crease.geometry_source == "opencv_creases":
            merged = apply_crease_result(inferred, crease, prefer_cv_motifs=True)
            return merged
        return _attach_creases(inferred, body, landmarks, settings)

    if has_image and settings.llm_enabled:
        logger.error("palm_fallback reason=openrouter_vision_failed seed=%s", body.seed[:32])

    # CV-only path when LLM failed but creases succeeded
    if crease is not None and crease.geometry_source == "opencv_creases" and crease.line_geometry:
        base = dummy_palm_analysis(entropy)
        base = base.model_copy(
            update={
                "analysis_source": "opencv_creases",
                "life_line": crease.life_line,
                "heart_line": crease.heart_line,
                "head_line": crease.head_line,
                "confidence": crease.confidence,
                "image_quality": crease.image_quality,
                "quality_warnings": crease.quality_warnings,
            }
        )
        return apply_crease_result(base, crease, prefer_cv_motifs=True)

    logger.warning("Palm analysis falling back to deterministic motifs (seed entropy)")
    fallback = dummy_palm_analysis(entropy)
    fallback = fallback.model_copy(update={"analysis_source": "fallback"})
    if has_image:
        return _attach_creases(fallback, body, landmarks, settings)
    return fallback

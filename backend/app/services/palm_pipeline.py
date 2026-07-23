"""Palm analysis pipeline — vision model primary; OpenCV optional upgrade."""

from __future__ import annotations

import logging

from fastapi import HTTPException

from app.config import Settings
from app.schemas.palm import PalmAnalysis
from app.schemas.palm_analyze import PalmAnalyzeBody
from app.services.palm_ai import palm_analysis_from_vision
from app.services.palm_cv import extract_line_geometry, merge_cv_into_analysis
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
    """Best-effort MediaPipe landmarks — optional for vision-first path."""
    img = body.image_base64
    if img:
        decoded = decode_capture_bytes(img)
        if decoded is not None:
            data, _, _ = decoded
            try:
                landmarks, source = detect_hand_landmarks_from_bytes(
                    data,
                    dominant_hand=body.dominant_hand or "right",
                )
                if landmarks and source == "mediapipe":
                    return landmarks, source
            except Exception:
                logger.exception("landmark detection failed — continuing with vision-only")

    if body.landmarks and body.landmarks_source == "mediapipe":
        return body.landmarks, body.landmarks_source
    return None, None


def _has_usable_geometry(palm: PalmAnalysis | None) -> bool:
    if palm is None or not palm.line_geometry:
        return False
    if palm.geometry_source not in {"opencv_creases", "vision_model", "landmark_heuristic"}:
        return False
    return len(palm.line_geometry) >= 2


def _attach_cv_if_possible(
    analysis: PalmAnalysis,
    body: PalmAnalyzeBody,
    landmarks: list[list[float]] | None,
    settings: Settings,
) -> PalmAnalysis:
    """Prefer OpenCV creases when they lock; otherwise keep vision geometry."""
    img = body.image_base64.strip() if isinstance(body.image_base64, str) else None
    if not img or not landmarks:
        return analysis

    prior_geom = analysis.line_geometry
    prior_source = analysis.geometry_source
    merged = merge_cv_into_analysis(
        analysis,
        landmarks,
        image_base64=img,
        allow_landmark_heuristic=False,
    )
    if merged.geometry_source == "opencv_creases" and merged.line_geometry:
        return merged

    # CV miss — restore vision geometry if we had it.
    if prior_geom and prior_source == "vision_model":
        return analysis.model_copy(
            update={
                "line_geometry": prior_geom,
                "geometry_source": "vision_model",
            }
        )
    return analysis


async def analyze_palm(settings: Settings, body: PalmAnalyzeBody) -> PalmAnalysis:
    entropy = _entropy_from_body(body)
    img = body.image_base64.strip() if isinstance(body.image_base64, str) else None
    has_image = bool(img)
    mode = settings.palm_analysis_mode
    ai_mode = mode in {"vision", "hybrid"}

    landmarks, _lm_source = _resolve_landmarks(body)

    if mode == "dummy":
        result = dummy_palm_analysis(entropy)
        if has_image and landmarks:
            return merge_cv_into_analysis(
                result,
                landmarks,
                image_base64=img,
                allow_landmark_heuristic=settings.palm_crease_fallback_heuristic,
            )
        return result

    if settings.llm_enabled and ai_mode and not has_image:
        raise HTTPException(status_code=400, detail="Palm image required for AI analysis.")

    # Vision-first: model reads motifs + crease polylines from the photo.
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
        # Optional OpenCV upgrade when landmarks are available (before rejecting no_hand).
        result = _attach_cv_if_possible(inferred, body, landmarks, settings)

        # If vision omitted polylines but landmarks exist, use anatomic guide for overlay.
        if not _has_usable_geometry(result) and landmarks:
            guide = extract_line_geometry(landmarks)
            if guide:
                result = result.model_copy(
                    update={
                        "line_geometry": guide,
                        "geometry_source": "landmark_heuristic",
                        "analysis_source": "hybrid"
                        if result.analysis_source == "openrouter_vision"
                        else result.analysis_source,
                    }
                )

        # Only reject when there is truly no palm signal (no geometry, model says no_hand).
        if (
            result.image_quality == "no_hand"
            and not _has_usable_geometry(result)
            and not settings.debug
        ):
            raise HTTPException(
                status_code=422,
                detail="No clear palm visible - please retake the photo with your palm open and well lit.",
            )

        if _has_usable_geometry(result):
            if result.image_quality in {"poor", "no_hand"}:
                result = result.model_copy(update={"image_quality": "acceptable"})
            return result

        # Motifs without drawable geometry — still usable for the reading text.
        if result.life_line and result.heart_line and result.head_line:
            if result.image_quality == "no_hand" and not _has_usable_geometry(result):
                if not settings.debug:
                    raise HTTPException(
                        status_code=422,
                        detail="No clear palm visible - please retake the photo with your palm open and well lit.",
                    )
            logger.warning("vision motifs without geometry seed=%s", body.seed[:32])
            quality = result.image_quality
            if quality in {"poor", "no_hand"}:
                quality = "acceptable"
            return result.model_copy(
                update={
                    "geometry_source": result.geometry_source or "unavailable",
                    "image_quality": quality,
                }
            )

        if not settings.debug:
            raise HTTPException(
                status_code=422,
                detail="Palm creases not detected — please retake with your open palm filling the frame and even light.",
            )
        return result

    if has_image and settings.llm_enabled:
        logger.error("palm_fallback reason=openrouter_vision_failed seed=%s", body.seed[:32])

    # Vision unavailable — try CV-only when landmarks exist.
    if has_image and landmarks:
        base = dummy_palm_analysis(entropy)
        merged = merge_cv_into_analysis(
            base,
            landmarks,
            image_base64=img,
            allow_landmark_heuristic=True,
        )
        if merged.geometry_source == "opencv_creases" and merged.line_geometry:
            return merged.model_copy(update={"analysis_source": "opencv_creases"})
        if merged.line_geometry:
            return merged.model_copy(update={"analysis_source": "hybrid"})

    logger.warning("Palm analysis falling back to deterministic motifs (seed entropy)")
    fallback = dummy_palm_analysis(entropy)
    fallback = fallback.model_copy(update={"analysis_source": "fallback"})
    if has_image and landmarks:
        return merge_cv_into_analysis(
            fallback,
            landmarks,
            image_base64=img,
            allow_landmark_heuristic=settings.palm_crease_fallback_heuristic,
        )
    if has_image and not settings.debug and settings.llm_enabled:
        raise HTTPException(
            status_code=422,
            detail="Palm creases not detected — please retake with your open palm filling the frame and even light.",
        )
    return fallback

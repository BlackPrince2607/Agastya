"""Palm analysis pipeline — vision primary; geometry optional; report-first."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import HTTPException

from app.config import Settings
from app.schemas.palm import PalmAnalysis
from app.schemas.palm_analyze import PalmAnalyzeBody
from app.services.palm_ai import palm_analysis_from_vision
from app.services.palm_cv import extract_line_geometry, merge_cv_into_analysis
from app.services.palm_dummy import dummy_palm_analysis
from app.services.palm_landmarks import detect_hand_landmarks_from_bytes
from app.services.palm_storage import decode_capture_bytes
from app.utils.ai_errors import log_ai_fallback, raise_ai_http_error
from app.utils.ai_logging import log_ai_event

logger = logging.getLogger(__name__)

_DEFAULT_UNREADABLE_REASONS = (
    "blurry image",
    "low lighting",
    "palm partially outside the frame",
)


def _unreadable_detail(
    message: str = "We couldn't clearly analyze your palm.",
    reasons: tuple[str, ...] | list[str] | None = None,
    *,
    code: str = "palm_unreadable",
) -> dict[str, Any]:
    return {
        "code": code,
        "message": message,
        "reasons": list(reasons or _DEFAULT_UNREADABLE_REASONS),
    }


def _raise_unreadable(
    message: str = "We couldn't clearly analyze your palm.",
    reasons: tuple[str, ...] | list[str] | None = None,
) -> None:
    raise HTTPException(status_code=422, detail=_unreadable_detail(message, reasons))


def _entropy_from_body(body: PalmAnalyzeBody) -> str:
    entropy = body.seed
    if body.image_base64:
        entropy = f"{body.seed}:{body.image_base64[-48:]}"
    return entropy


def _client_landmarks(body: PalmAnalyzeBody) -> tuple[list[list[float]] | None, str | None]:
    if body.landmarks and body.landmarks_source == "mediapipe":
        return body.landmarks, body.landmarks_source
    return None, None


def _resolve_landmarks(body: PalmAnalyzeBody, *, fast: bool = True) -> tuple[list[list[float]] | None, str | None]:
    """Best-effort MediaPipe landmarks — optional enrichment only."""
    client_lm, client_src = _client_landmarks(body)
    if client_lm is not None:
        return client_lm, client_src

    img = body.image_base64
    if img:
        decoded = decode_capture_bytes(img)
        if decoded is not None:
            data, _, _ = decoded
            try:
                landmarks, source = detect_hand_landmarks_from_bytes(
                    data,
                    dominant_hand=body.dominant_hand or "right",
                    fast=fast,
                )
                if landmarks and source == "mediapipe":
                    return landmarks, source
            except Exception:
                logger.exception("landmark detection failed — continuing with vision-only")

    return None, None


async def _landmarks_with_budget(
    body: PalmAnalyzeBody,
    timeout_seconds: float,
    *,
    fast: bool = True,
) -> tuple[list[list[float]] | None, str | None]:
    """Run landmark detection off the event loop with a hard wall-clock budget."""
    client_lm, client_src = _client_landmarks(body)
    if client_lm is not None:
        return client_lm, client_src
    if not body.image_base64:
        return None, None
    # Shield so a timeout abandons the result immediately — MediaPipe/TFLite
    # cannot be cancelled mid-inference; waiting on cancel would reintroduce hangs.
    loop = asyncio.get_running_loop()
    fut = loop.run_in_executor(None, lambda: _resolve_landmarks(body, fast=fast))
    try:
        return await asyncio.wait_for(asyncio.shield(fut), timeout=max(0.5, float(timeout_seconds)))
    except TimeoutError:
        logger.warning(
            "landmark detection budget exceeded (%.1fs) — continuing without landmarks",
            timeout_seconds,
        )
        fut.add_done_callback(lambda f: f.exception() if not f.cancelled() else None)
        return None, None
    except Exception:
        logger.exception("landmark detection failed — continuing without landmarks")
        return None, None


def _has_usable_geometry(palm: PalmAnalysis | None) -> bool:
    if palm is None or not palm.line_geometry:
        return False
    if palm.geometry_source not in {"opencv_creases", "vision_model", "landmark_heuristic"}:
        return False
    return len(palm.line_geometry) >= 2


def _has_usable_motifs(palm: PalmAnalysis | None) -> bool:
    if palm is None:
        return False
    return bool(palm.life_line and palm.heart_line and palm.head_line)


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

    if prior_geom and prior_source == "vision_model":
        return analysis.model_copy(
            update={
                "line_geometry": prior_geom,
                "geometry_source": "vision_model",
            }
        )
    return analysis


def _finalize_success(result: PalmAnalysis) -> PalmAnalysis:
    """Normalize quality when we have enough signal for a report."""
    quality = result.image_quality
    if quality in {"poor", "no_hand"} and (_has_usable_motifs(result) or _has_usable_geometry(result)):
        quality = "acceptable"
    return result.model_copy(
        update={
            "geometry_source": result.geometry_source or "unavailable",
            "image_quality": quality,
        }
    )


async def analyze_palm(settings: Settings, body: PalmAnalyzeBody) -> PalmAnalysis:
    entropy = _entropy_from_body(body)
    img = body.image_base64.strip() if isinstance(body.image_base64, str) else None
    has_image = bool(img)
    mode = settings.palm_analysis_mode
    ai_mode = mode in {"vision", "hybrid"}
    lm_budget = float(settings.palm_landmarks_timeout_seconds)

    if mode == "dummy":
        landmarks, _lm_source = await _landmarks_with_budget(body, lm_budget, fast=True)
        result = dummy_palm_analysis(entropy)
        if has_image and landmarks:
            return await asyncio.to_thread(
                merge_cv_into_analysis,
                result,
                landmarks,
                image_base64=img,
                allow_landmark_heuristic=settings.palm_crease_fallback_heuristic,
            )
        return result

    if settings.llm_enabled and ai_mode and not has_image:
        raise HTTPException(status_code=400, detail="Palm image required for AI analysis.")

    if has_image and ai_mode and not settings.llm_enabled:
        raise_ai_http_error(
            503,
            "Palm vision not configured — set OPENROUTER_API_KEY on the server.",
            feature="palm_analyze",
            reason="vision_not_configured",
        )

    # Vision first — never serialize MediaPipe ahead of OpenRouter (root cause of 28% hangs).
    inferred: PalmAnalysis | None = None
    if settings.llm_enabled and has_image and ai_mode:
        try:
            inferred = await palm_analysis_from_vision(
                settings,
                image_base64=img or "",
                seed=body.seed,
                dominant_hand=body.dominant_hand,
                gender=body.gender,
            )
        except Exception:
            log_ai_event(
                logger,
                "palm_vision_threw",
                feature="palm_analyze",
                level=logging.ERROR,
            )
            inferred = None

    if inferred is not None:
        # Prefer client landmarks (free). Only run server MediaPipe when vision
        # did not already produce usable geometry / quality.
        landmarks, _lm_source = _client_landmarks(body)
        needs_server_landmarks = landmarks is None and (
            not _has_usable_geometry(inferred)
            or inferred.image_quality in {"poor", "no_hand"}
        )
        if needs_server_landmarks:
            landmarks, _lm_source = await _landmarks_with_budget(body, lm_budget, fast=True)
        if landmarks:
            inferred = await asyncio.to_thread(
                _attach_cv_if_possible, inferred, body, landmarks, settings
            )

        result = inferred

        # Optional anatomic guide for overlays — never required for success.
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

        # True no-hand with no motifs → structured retake.
        if result.image_quality == "no_hand" and not _has_usable_motifs(result) and not _has_usable_geometry(
            result
        ):
            if not settings.debug:
                _raise_unreadable(
                    "We couldn't clearly analyze your palm.",
                    ("no clear palm visible", "palm partially outside the frame", "low lighting"),
                )
            return _finalize_success(result)

        # Motifs alone are enough for the Life Blueprint.
        if _has_usable_motifs(result) or _has_usable_geometry(result):
            if not _has_usable_geometry(result):
                logger.warning("vision motifs without geometry seed=%s", body.seed[:32])
            return _finalize_success(result)

        if not settings.debug:
            _raise_unreadable()
        return _finalize_success(result)

    if has_image and settings.llm_enabled:
        log_ai_fallback("palm_analyze", "openrouter_vision_failed", seed_prefix=body.seed[:32])

    # Vision unavailable — try CV-only when landmarks exist.
    landmarks, _lm_source = await _landmarks_with_budget(body, lm_budget, fast=True)
    if has_image and landmarks:
        base = dummy_palm_analysis(entropy)
        merged = await asyncio.to_thread(
            merge_cv_into_analysis,
            base,
            landmarks,
            image_base64=img,
            allow_landmark_heuristic=True,
        )
        if _has_usable_geometry(merged) or _has_usable_motifs(merged):
            # Motifs came from seed-hash dummy — never claim opencv_creases/hybrid for provenance.
            # geometry_source still reflects real CV when present.
            return _finalize_success(merged.model_copy(update={"analysis_source": "fallback"}))

    if has_image and ai_mode and settings.llm_enabled and not settings.debug:
        raise_ai_http_error(
            503,
            "Palm vision temporarily unavailable — please try again in a moment.",
            feature="palm_analyze",
            reason="vision_unavailable",
        )

    log_ai_fallback("palm_analyze", "deterministic_motifs")
    fallback = dummy_palm_analysis(entropy)
    fallback = fallback.model_copy(update={"analysis_source": "fallback"})
    if has_image and landmarks:
        return await asyncio.to_thread(
            merge_cv_into_analysis,
            fallback,
            landmarks,
            image_base64=img,
            allow_landmark_heuristic=settings.palm_crease_fallback_heuristic,
        )
    return fallback

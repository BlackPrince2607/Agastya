"""Computer-vision helpers — crease merge + optional landmark heuristic fallback."""

from __future__ import annotations

import logging
from typing import Any

from app.schemas.palm import LineGeometry, LineGeometryPoint, PalmAnalysis
from app.services.palm_crease import CreaseExtractionResult, extract_creases_from_image

logger = logging.getLogger(__name__)


def _pt(landmarks: list[list[float]], idx: int) -> tuple[float, float] | None:
    if idx >= len(landmarks):
        return None
    row = landmarks[idx]
    if len(row) < 2:
        return None
    return float(row[0]), float(row[1])


def _mid(a: tuple[float, float], b: tuple[float, float], t: float = 0.5) -> tuple[float, float]:
    return (a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t)


def _below(p: tuple[float, float], amount: float = 0.035) -> tuple[float, float]:
    return (p[0], p[1] + amount)


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _parse_point(raw: object) -> dict[str, float] | None:
    if not isinstance(raw, dict):
        return None
    try:
        return {
            "x": _clamp01(float(raw.get("x", 0))),
            "y": _clamp01(float(raw.get("y", 0))),
        }
    except (TypeError, ValueError):
        return None


def _sanitize_geometry(geometry: list[dict] | None) -> list[dict]:
    if not geometry:
        return []
    allowed = {"life_line", "heart_line", "head_line"}
    cleaned: list[dict] = []
    for line in geometry:
        name = str(line.get("name", "")).strip()
        points = line.get("points")
        if name not in allowed or not isinstance(points, list):
            continue
        parsed = [_parse_point(p) for p in points]
        parsed = [p for p in parsed if p is not None]
        if len(parsed) < 2:
            continue
        cleaned.append({"name": name, "points": parsed})
    return cleaned


def extract_line_geometry(landmarks: list[list[float]] | None) -> list[dict]:
    """
    Landmark-only approximate polylines (debug/fallback).

    Prefer extract_creases_from_image for production overlays.
    """
    if not landmarks or len(landmarks) < 18:
        return []

    wrist = _pt(landmarks, 0)
    index_mcp = _pt(landmarks, 5)
    middle_mcp = _pt(landmarks, 9)
    ring_mcp = _pt(landmarks, 13)
    pinky_mcp = _pt(landmarks, 17)
    thumb_cmc = _pt(landmarks, 1)

    if not all([wrist, index_mcp, middle_mcp, ring_mcp, pinky_mcp, thumb_cmc]):
        return []

    palm_span = ((pinky_mcp[0] - index_mcp[0]) ** 2 + (pinky_mcp[1] - index_mcp[1]) ** 2) ** 0.5
    curve = max(0.02, palm_span * 0.12)

    life_start = _mid(thumb_cmc, index_mcp, 0.42)
    life_curve = (
        thumb_cmc[0] * 0.55 + wrist[0] * 0.25 + index_mcp[0] * 0.2,
        thumb_cmc[1] * 0.25 + wrist[1] * 0.55 + index_mcp[1] * 0.2,
    )
    life_lower = _mid(thumb_cmc, wrist, 0.62)
    life_end = _mid(wrist, thumb_cmc, 0.18)

    heart_start = _below(pinky_mcp, curve * 0.35)
    heart_mid = _below(middle_mcp, curve * 0.55)
    heart_end = _below(index_mcp, curve * 0.45)

    head_start = _mid(index_mcp, thumb_cmc, 0.28)
    head_mid = (
        (index_mcp[0] + middle_mcp[0] + ring_mcp[0]) / 3,
        (index_mcp[1] + middle_mcp[1]) / 2 + (wrist[1] - index_mcp[1]) * 0.18,
    )
    head_end = _mid(ring_mcp, pinky_mcp, 0.35)

    lines = [
        LineGeometry(
            name="life_line",
            points=[
                LineGeometryPoint(x=life_start[0], y=life_start[1]),
                LineGeometryPoint(x=life_curve[0], y=life_curve[1]),
                LineGeometryPoint(x=life_lower[0], y=life_lower[1]),
                LineGeometryPoint(x=life_end[0], y=life_end[1]),
            ],
        ),
        LineGeometry(
            name="heart_line",
            points=[
                LineGeometryPoint(x=heart_start[0], y=heart_start[1]),
                LineGeometryPoint(x=_below(ring_mcp, curve * 0.5)[0], y=_below(ring_mcp, curve * 0.5)[1]),
                LineGeometryPoint(x=heart_mid[0], y=heart_mid[1]),
                LineGeometryPoint(x=heart_end[0], y=heart_end[1]),
            ],
        ),
        LineGeometry(
            name="head_line",
            points=[
                LineGeometryPoint(x=head_start[0], y=head_start[1]),
                LineGeometryPoint(x=head_mid[0], y=head_mid[1]),
                LineGeometryPoint(x=head_end[0], y=head_end[1]),
            ],
        ),
    ]

    return [lg.model_dump() for lg in lines]


def apply_crease_result(
    analysis: PalmAnalysis,
    crease: CreaseExtractionResult,
    *,
    prefer_cv_motifs: bool = True,
) -> PalmAnalysis:
    """Attach CV geometry/features; override motifs from measured creases when requested."""
    data = analysis.model_dump()
    geom = _sanitize_geometry(crease.line_geometry)
    if geom:
        data["line_geometry"] = geom
        data["geometry_source"] = crease.geometry_source or "opencv_creases"
        if prefer_cv_motifs:
            data["life_line"] = crease.life_line
            data["heart_line"] = crease.heart_line
            data["head_line"] = crease.head_line
        if crease.line_features:
            data["line_features"] = crease.line_features
            # Mirror into line_details for report consumers
            details = dict(data.get("line_details") or {})
            for name, feat in crease.line_features.items():
                details[name] = {
                    "length": feat.get("length_label", "medium"),
                    "depth": feat.get("depth", "moderate"),
                    "breaks": int(feat.get("breaks", 0)),
                    "notes": str(feat.get("notes", "")),
                }
            data["line_details"] = details
        # Confidence: blend CV and prior
        prior = float(data.get("confidence") or 0.5)
        data["confidence"] = round(min(1.0, 0.45 * prior + 0.55 * crease.confidence), 3)
        if crease.quality_warnings:
            existing = list(data.get("quality_warnings") or [])
            for w in crease.quality_warnings:
                if w not in existing:
                    existing.append(w)
            data["quality_warnings"] = existing[:8]
        if analysis.analysis_source in {"openrouter_vision", "dummy", "fallback"}:
            data["analysis_source"] = "hybrid"
        elif not analysis.analysis_source or analysis.analysis_source == "opencv_creases":
            data["analysis_source"] = data.get("analysis_source") or "opencv_creases"
    else:
        data["line_geometry"] = None
        data["geometry_source"] = "unavailable"
        if crease.quality_warnings:
            data["quality_warnings"] = list(crease.quality_warnings)[:8]
        if crease.image_quality in {"poor", "no_hand"}:
            # Only downgrade if we have no better visual quality from LLM
            current_q = str(data.get("image_quality") or "acceptable")
            if current_q not in {"good"}:
                data["image_quality"] = crease.image_quality
    return PalmAnalysis.model_validate(data)


def run_crease_extraction(
    image_base64: str | None,
    landmarks: list[list[float]] | None,
) -> CreaseExtractionResult:
    if not image_base64:
        return CreaseExtractionResult(
            quality_warnings=["Palm image required for crease scan"],
            image_quality="poor",
        )
    return extract_creases_from_image(image_base64, landmarks)


def merge_cv_into_analysis(
    analysis: PalmAnalysis,
    landmarks: list[list[float]] | None,
    *,
    image_base64: str | None = None,
    allow_landmark_heuristic: bool = False,
) -> PalmAnalysis:
    """
    Attach line geometry from OpenCV crease extraction.

    LLM/vision geometry is ignored. When crease scan fails, fall back to
    landmark-derived major-line polylines (MediaPipe anatomy), or when
    allow_landmark_heuristic=True for any landmark set.
    """
    try:
        # Never keep model-invented geometry
        stripped = analysis.model_copy(update={"line_geometry": None, "geometry_source": None})

        if image_base64:
            crease = run_crease_extraction(image_base64, landmarks)
            if crease.geometry_source == "opencv_creases" and crease.line_geometry:
                return apply_crease_result(stripped, crease, prefer_cv_motifs=True)

        # Prefer anatomy-based overlays over an empty geometry field on real captures.
        geometry = extract_line_geometry(landmarks)
        if geometry and (allow_landmark_heuristic or image_base64):
            data = stripped.model_dump()
            data["line_geometry"] = geometry
            data["geometry_source"] = "landmark_heuristic"
            if analysis.analysis_source in {"openrouter_vision", "dummy"}:
                data["analysis_source"] = "hybrid"
            return PalmAnalysis.model_validate(data)

        # Failed crease scan — no overlay invention
        data = stripped.model_dump()
        data["line_geometry"] = None
        data["geometry_source"] = "unavailable"
        return PalmAnalysis.model_validate(data)
    except Exception:
        logger.exception("palm_cv merge failed — returning analysis without overlay")
        return analysis.model_copy(update={"line_geometry": None, "geometry_source": "unavailable"})

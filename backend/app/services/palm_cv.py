"""Computer-vision helpers — crease merge + optional landmark heuristic fallback."""

from __future__ import annotations

import logging

from app.schemas.palm import LineGeometry, LineGeometryPoint, PalmAnalysis
from app.services.palm_crease import CreaseExtractionResult, extract_creases_from_image, public_quality_warnings

logger = logging.getLogger(__name__)

_MAJOR_GEOMETRY = {"life_line", "heart_line", "head_line"}
_SECONDARY_GEOMETRY = {"fate_line", "sun_line", "marriage_line"}
_ALLOWED_GEOMETRY = _MAJOR_GEOMETRY | _SECONDARY_GEOMETRY


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


def _sanitize_geometry(geometry: list[dict] | None, *, majors_only: bool = False) -> list[dict]:
    if not geometry:
        return []
    allowed = _MAJOR_GEOMETRY if majors_only else _ALLOWED_GEOMETRY
    cleaned: list[dict] = []
    for line in geometry:
        name = str(line.get("name", "")).strip().lower().replace(" ", "_").replace("-", "_")
        points = line.get("points")
        if name not in allowed or not isinstance(points, list):
            continue
        parsed = [_parse_point(p) for p in points]
        parsed = [p for p in parsed if p is not None]
        if len(parsed) < 2:
            continue
        cleaned.append({"name": name, "points": parsed})
    return cleaned


def _secondary_geometry_from(prior: list[dict] | None) -> list[dict]:
    """Keep vision fate/sun/marriage overlays when OpenCV only locks major 3."""
    if not prior:
        return []
    return [g for g in _sanitize_geometry(prior) if g["name"] in _SECONDARY_GEOMETRY]


def _merge_geometry(cv_geom: list[dict], prior: list[dict] | None) -> list[dict]:
    """Merge CV overlays with vision; prefer denser vision majors; keep secondary from either."""
    cv = _sanitize_geometry(cv_geom)
    prior_clean = _sanitize_geometry(prior)
    by_name: dict[str, dict] = {g["name"]: g for g in cv}

    for g in prior_clean:
        name = g["name"]
        pts = g.get("points") or []
        if name in _SECONDARY_GEOMETRY:
            by_name.setdefault(name, g)
            continue
        if name in _MAJOR_GEOMETRY:
            existing = by_name.get(name)
            # Prefer vision when it traces the crease with more detail.
            if existing is None or (len(pts) >= 5 and len(pts) >= len(existing.get("points") or []) + 2):
                by_name[name] = g

    order = ["life_line", "heart_line", "head_line", "fate_line", "sun_line", "marriage_line"]
    return [by_name[n] for n in order if n in by_name]


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
    """Attach CV geometry/features; override major motifs from measured creases when requested.

    Preserves vision secondary line motifs (fate/sun/marriage) and their geometry.
    """
    prior_geometry = analysis.line_geometry
    data = analysis.model_dump()
    geom = _merge_geometry(crease.line_geometry, prior_geometry)
    major_names = {g["name"] for g in geom if g["name"] in _MAJOR_GEOMETRY}
    if len(major_names) < 2:
        geom = []
    if geom:
        data["line_geometry"] = geom
        data["geometry_source"] = crease.geometry_source or "opencv_creases"
        # CV lock means the palm was usable — don't keep a false LLM "poor"/"no_hand".
        if crease.image_quality in {"good", "acceptable"}:
            data["image_quality"] = crease.image_quality
        elif data.get("image_quality") in {None, "poor", "no_hand"}:
            data["image_quality"] = "acceptable"
        if prefer_cv_motifs:
            data["life_line"] = crease.life_line
            data["heart_line"] = crease.heart_line
            data["head_line"] = crease.head_line
            # Do NOT overwrite fate_line / sun_line / marriage_line from CV (vision-only).
        if crease.line_features:
            data["line_features"] = crease.line_features
            # Mirror into line_details for report consumers; keep secondary details from vision.
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
        data["quality_warnings"] = public_quality_warnings(
            list(data.get("quality_warnings") or []) + list(crease.quality_warnings or []),
            locked=True,
        )
        if analysis.analysis_source in {"openrouter_vision", "dummy", "fallback"}:
            data["analysis_source"] = "hybrid"
        elif not analysis.analysis_source or analysis.analysis_source == "opencv_creases":
            data["analysis_source"] = data.get("analysis_source") or "opencv_creases"
    else:
        data["line_geometry"] = None
        data["geometry_source"] = "unavailable"
        data["quality_warnings"] = public_quality_warnings(
            list(crease.quality_warnings or []) or list(data.get("quality_warnings") or []),
            locked=False,
        )
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

    Vision major-line geometry may be replaced by CV; secondary vision lines
    (fate/sun/marriage) are preserved. Landmark-derived overlays are used only
    if allow_landmark_heuristic=True.
    """
    try:
        # Strip prior geometry for CV attempt; secondary lines reattached in apply_crease_result.
        stripped = analysis.model_copy(update={"line_geometry": None, "geometry_source": None})

        if image_base64:
            crease = run_crease_extraction(image_base64, landmarks)
            if crease.geometry_source == "opencv_creases" and crease.line_geometry:
                # Pass original analysis so secondary geometry/motifs survive.
                return apply_crease_result(analysis, crease, prefer_cv_motifs=True)

        # Anatomy overlays only when explicitly enabled — never invent creases from a photo.
        geometry = extract_line_geometry(landmarks)
        if geometry and allow_landmark_heuristic:
            data = stripped.model_dump()
            data["line_geometry"] = _merge_geometry(geometry, analysis.line_geometry)
            data["geometry_source"] = "landmark_heuristic"
            if analysis.analysis_source in {"openrouter_vision", "dummy"}:
                data["analysis_source"] = "hybrid"
            return PalmAnalysis.model_validate(data)

        # Failed crease scan — keep prior vision geometry when available
        if analysis.line_geometry and analysis.geometry_source == "vision_model":
            return analysis
        data = stripped.model_dump()
        data["line_geometry"] = None
        data["geometry_source"] = "unavailable"
        return PalmAnalysis.model_validate(data)
    except Exception:
        logger.exception("palm_cv merge failed — returning analysis without overlay")
        return analysis.model_copy(update={"line_geometry": None, "geometry_source": "unavailable"})

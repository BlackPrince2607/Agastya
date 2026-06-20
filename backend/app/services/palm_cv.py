"""Computer-vision helpers for palm landmarks and line geometry."""

from __future__ import annotations

from app.schemas.palm import LineGeometry, LineGeometryPoint, PalmAnalysis


def _pt(landmarks: list[list[float]], idx: int) -> tuple[float, float] | None:
    if idx >= len(landmarks):
        return None
    row = landmarks[idx]
    if len(row) < 2:
        return None
    return float(row[0]), float(row[1])


def extract_line_geometry(landmarks: list[list[float]] | None) -> list[dict]:
    """
    Derive approximate major-line polylines from MediaPipe-style 21 hand landmarks.

    Indices (MediaPipe Hands): 0=wrist, 5=index_mcp, 9=middle_mcp, 13=ring_mcp,
    17=pinky_mcp, 1-4 thumb chain.
    """
    if not landmarks or len(landmarks) < 18:
        return []

    wrist = _pt(landmarks, 0)
    index_mcp = _pt(landmarks, 5)
    middle_mcp = _pt(landmarks, 9)
    ring_mcp = _pt(landmarks, 13)
    pinky_mcp = _pt(landmarks, 17)
    thumb_cmc = _pt(landmarks, 1)

    if not all([wrist, index_mcp, middle_mcp, ring_mcp, pinky_mcp]):
        return []

    lines: list[LineGeometry] = []

    # Life line: wrist → between thumb and index toward middle base
    if thumb_cmc:
        life_mid = (
            (wrist[0] * 0.35 + thumb_cmc[0] * 0.35 + index_mcp[0] * 0.3),
            (wrist[1] * 0.35 + thumb_cmc[1] * 0.35 + index_mcp[1] * 0.3),
        )
        lines.append(
            LineGeometry(
                name="life_line",
                points=[
                    LineGeometryPoint(x=wrist[0], y=wrist[1]),
                    LineGeometryPoint(x=life_mid[0], y=life_mid[1]),
                    LineGeometryPoint(x=middle_mcp[0], y=middle_mcp[1]),
                ],
            )
        )

    # Heart line: pinky_mcp → ring → middle → index (horizontal arc)
    lines.append(
        LineGeometry(
            name="heart_line",
            points=[
                LineGeometryPoint(x=pinky_mcp[0], y=pinky_mcp[1]),
                LineGeometryPoint(x=ring_mcp[0], y=ring_mcp[1]),
                LineGeometryPoint(x=middle_mcp[0], y=middle_mcp[1]),
                LineGeometryPoint(x=index_mcp[0], y=index_mcp[1]),
            ],
        )
    )

    # Head line: index_mcp → middle_mcp → ring area
    lines.append(
        LineGeometry(
            name="head_line",
            points=[
                LineGeometryPoint(x=index_mcp[0], y=index_mcp[1]),
                LineGeometryPoint(x=middle_mcp[0], y=middle_mcp[1]),
                LineGeometryPoint(x=ring_mcp[0], y=ring_mcp[1]),
            ],
        )
    )

    return [lg.model_dump() for lg in lines]


def merge_cv_into_analysis(analysis: PalmAnalysis, landmarks: list[list[float]] | None) -> PalmAnalysis:
    geometry = extract_line_geometry(landmarks)
    if not geometry:
        return analysis
    data = analysis.model_dump()
    data["line_geometry"] = geometry
    if analysis.analysis_source == "groq_vision":
        data["analysis_source"] = "hybrid"
    elif analysis.analysis_source == "dummy":
        data["analysis_source"] = "hybrid"
    return PalmAnalysis.model_validate(data)

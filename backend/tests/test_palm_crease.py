"""OpenCV crease extraction tests."""

from __future__ import annotations

import base64

import cv2
import numpy as np
import pytest

from app.schemas.palm import PalmAnalysis
from app.services.palm_crease import extract_creases_from_image
from app.services.palm_cv import merge_cv_into_analysis


def _synthetic_palm_jpeg_and_landmarks() -> tuple[str, list[list[float]]]:
    """Draw dark creases on a skin-toned canvas and return base64 + MediaPipe-shaped landmarks."""
    h, w = 480, 360
    img = np.full((h, w, 3), (180, 140, 120), dtype=np.uint8)

    # Palm region roughly covering the canvas center
    # Dark creases (heart / head horizontal, life arc on left)
    cv2.line(img, (40, 90), (320, 100), (40, 30, 25), 3)  # heart
    cv2.line(img, (50, 160), (310, 175), (35, 28, 22), 3)  # head
    pts = np.array([[70, 95], [55, 180], [50, 280], [80, 360]], dtype=np.int32)
    cv2.polylines(img, [pts], False, (30, 25, 20), 3)  # life

    ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
    assert ok
    b64 = base64.b64encode(buf.tobytes()).decode("ascii")

    # Normalized landmarks — palm quad spans most of the image
    landmarks = [[0.5, 0.5] for _ in range(21)]
    landmarks[0] = [0.50, 0.88]  # wrist
    landmarks[1] = [0.28, 0.70]  # thumb cmc
    landmarks[5] = [0.22, 0.22]  # index mcp
    landmarks[9] = [0.45, 0.18]  # middle
    landmarks[13] = [0.65, 0.20]  # ring
    landmarks[17] = [0.82, 0.26]  # pinky
    return b64, landmarks


def test_extract_creases_detects_major_lines():
    b64, landmarks = _synthetic_palm_jpeg_and_landmarks()
    result = extract_creases_from_image(b64, landmarks)
    assert result.geometry_source == "opencv_creases"
    assert len(result.line_geometry) >= 2
    names = {g["name"] for g in result.line_geometry}
    assert names & {"life_line", "heart_line", "head_line"}
    for line in result.line_geometry:
        assert len(line["points"]) >= 2
        for p in line["points"]:
            assert 0.0 <= p["x"] <= 1.0
            assert 0.0 <= p["y"] <= 1.0
    assert result.life_line in {"strong", "moderate", "subtle"}
    assert result.heart_line in {"straight", "curved", "broken"}
    assert result.head_line in {"short", "medium", "long"}
    assert result.line_features


def test_extract_creases_fails_without_landmarks():
    b64, _ = _synthetic_palm_jpeg_and_landmarks()
    result = extract_creases_from_image(b64, None)
    assert result.geometry_source == "unavailable"
    assert not result.line_geometry


def test_merge_ignores_llm_geometry_prefers_cv():
    b64, landmarks = _synthetic_palm_jpeg_and_landmarks()
    palm = PalmAnalysis(
        life_line="subtle",
        heart_line="straight",
        head_line="short",
        personality="quiet visionary",
        traits=["thoughtful", "resilient"],
        analysis_source="openrouter_vision",
        line_geometry=[
            {
                "name": "life_line",
                "points": [{"x": 0.01, "y": 0.01}, {"x": 0.02, "y": 0.02}, {"x": 0.03, "y": 0.03}],
            },
            {
                "name": "heart_line",
                "points": [{"x": 0.9, "y": 0.9}, {"x": 0.8, "y": 0.8}, {"x": 0.7, "y": 0.7}],
            },
            {
                "name": "head_line",
                "points": [{"x": 0.5, "y": 0.5}, {"x": 0.6, "y": 0.6}, {"x": 0.4, "y": 0.4}],
            },
        ],
    )
    merged = merge_cv_into_analysis(palm, landmarks, image_base64=b64, allow_landmark_heuristic=False)
    assert merged.geometry_source == "opencv_creases"
    assert merged.analysis_source == "hybrid"
    # LLM corner geometry should not survive
    life = next(g for g in (merged.line_geometry or []) if g["name"] == "life_line")
    xs = [p["x"] for p in life["points"]]
    assert not (max(xs) < 0.05)


def test_merge_does_not_invent_overlay_without_image():
    palm = PalmAnalysis(
        life_line="strong",
        heart_line="curved",
        head_line="long",
        personality="quiet visionary",
        traits=["thoughtful", "resilient"],
        analysis_source="openrouter_vision",
        line_geometry=[
            {"name": "life_line", "points": [{"x": 0.1, "y": 0.2}, {"x": 0.3, "y": 0.4}]},
            {"name": "heart_line", "points": [{"x": 0.1, "y": 0.2}, {"x": 0.3, "y": 0.4}]},
            {"name": "head_line", "points": [{"x": 0.1, "y": 0.2}, {"x": 0.3, "y": 0.4}]},
        ],
    )
    landmarks = [[0.5, 0.5] for _ in range(21)]
    merged = merge_cv_into_analysis(palm, landmarks, image_base64=None, allow_landmark_heuristic=False)
    assert merged.line_geometry is None
    assert merged.geometry_source == "unavailable"


@pytest.mark.parametrize("heuristic", [True, False])
def test_landmark_heuristic_gate(heuristic: bool):
    palm = PalmAnalysis(
        life_line="strong",
        heart_line="curved",
        head_line="long",
        personality="quiet visionary",
        traits=["thoughtful", "resilient"],
        analysis_source="dummy",
    )
    landmarks = [[0.5, 0.7], [0.4, 0.6], [0.42, 0.55], [0.44, 0.5], [0.46, 0.45]]
    while len(landmarks) < 21:
        landmarks.append([0.5, 0.5])
    landmarks[5] = [0.3, 0.3]
    landmarks[9] = [0.5, 0.28]
    landmarks[13] = [0.65, 0.3]
    landmarks[17] = [0.8, 0.35]
    landmarks[0] = [0.5, 0.85]
    landmarks[1] = [0.25, 0.65]
    merged = merge_cv_into_analysis(
        palm,
        landmarks,
        image_base64=None,
        allow_landmark_heuristic=heuristic,
    )
    if heuristic:
        assert merged.line_geometry and len(merged.line_geometry) == 3
        assert merged.geometry_source == "landmark_heuristic"
    else:
        assert merged.line_geometry is None
        assert merged.geometry_source == "unavailable"


def test_merge_does_not_invent_overlay_when_creases_fail_with_image():
    """Honesty gate: a real photo must not get landmark_heuristic overlays by default."""
    # Blank skin tone — no creases; MediaPipe-shaped landmarks still present.
    h, w = 480, 360
    img = np.full((h, w, 3), (180, 140, 120), dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    assert ok
    b64 = base64.b64encode(buf.tobytes()).decode("ascii")
    landmarks = [[0.5, 0.5] for _ in range(21)]
    landmarks[0] = [0.50, 0.88]
    landmarks[1] = [0.28, 0.70]
    landmarks[5] = [0.22, 0.22]
    landmarks[9] = [0.45, 0.18]
    landmarks[13] = [0.65, 0.20]
    landmarks[17] = [0.82, 0.26]
    palm = PalmAnalysis(
        life_line="strong",
        heart_line="curved",
        head_line="long",
        personality="quiet visionary",
        traits=["thoughtful"],
        analysis_source="openrouter_vision",
    )
    merged = merge_cv_into_analysis(palm, landmarks, image_base64=b64, allow_landmark_heuristic=False)
    assert merged.geometry_source == "unavailable"
    assert merged.line_geometry is None

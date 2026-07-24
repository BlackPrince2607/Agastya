"""Palm pipeline tests."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app
from app.schemas.palm import PalmAnalysis
from app.services.palm_cv import extract_line_geometry, merge_cv_into_analysis
from tests.test_palm_crease import _synthetic_palm_jpeg_and_landmarks


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("PALM_ANALYSIS_MODE", "dummy")
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    get_settings.cache_clear()
    return TestClient(create_app())


@pytest.fixture
def vision_client(monkeypatch):
    monkeypatch.setenv("PALM_ANALYSIS_MODE", "vision")
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test-key")
    get_settings.cache_clear()
    return TestClient(create_app())


def test_landmark_geometry_produces_three_lines():
    landmarks = [[0.5, 0.7], [0.4, 0.6], [0.42, 0.55], [0.44, 0.5], [0.46, 0.45]]
    while len(landmarks) < 21:
        landmarks.append([0.5, 0.5])
    landmarks[5] = [0.3, 0.3]
    landmarks[9] = [0.5, 0.28]
    landmarks[13] = [0.65, 0.3]
    landmarks[17] = [0.8, 0.35]
    landmarks[0] = [0.5, 0.85]
    landmarks[1] = [0.25, 0.65]
    geometry = extract_line_geometry(landmarks)
    assert len(geometry) == 3
    assert {g["name"] for g in geometry} == {"life_line", "heart_line", "head_line"}


def test_palm_analyze_dummy_mode(client):
    session_id = str(uuid.uuid4())
    client.post(
        "/v1/sessions/register",
        json={"sessionId": session_id, "deviceInstallId": "device-test-1"},
    )
    res = client.post(
        "/v1/palm/analyze",
        json={
            "sessionId": session_id,
            "deviceInstallId": "device-test-1",
            "seed": "unit-test",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["life_line"] in {"strong", "moderate", "subtle"}
    assert data["analysis_source"] == "dummy"


def test_palm_analyze_rejects_device_mismatch(client):
    session_id = str(uuid.uuid4())
    client.post(
        "/v1/sessions/register",
        json={"sessionId": session_id, "deviceInstallId": "device-a"},
    )
    res = client.post(
        "/v1/palm/analyze",
        json={
            "sessionId": session_id,
            "deviceInstallId": "device-b",
            "seed": "unit-test",
        },
    )
    assert res.status_code == 403


def test_palm_analyze_vision_mode_requires_image(vision_client):
    session_id = str(uuid.uuid4())
    vision_client.post(
        "/v1/sessions/register",
        json={"sessionId": session_id, "deviceInstallId": "device-test-1"},
    )
    res = vision_client.post(
        "/v1/palm/analyze",
        json={
            "sessionId": session_id,
            "deviceInstallId": "device-test-1",
            "seed": "unit-test",
        },
    )
    assert res.status_code == 400


def test_merge_cv_strips_null_geometry_points_without_inventing():
    palm = PalmAnalysis(
        life_line="strong",
        heart_line="curved",
        head_line="long",
        personality="quiet visionary",
        traits=["thoughtful", "resilient"],
        analysis_source="openrouter_vision",
        line_geometry=[
            {"name": "life_line", "points": [{"x": None, "y": 0.5}, {"x": 0.2, "y": 0.3}]},
            {"name": "heart_line", "points": [{"x": 0.1, "y": 0.2}, {"x": 0.3, "y": 0.4}]},
            {"name": "head_line", "points": [{"x": 0.1, "y": 0.2}, {"x": 0.3, "y": 0.4}]},
        ],
    )
    landmarks = [[0.5, 0.5] for _ in range(21)]
    merged = merge_cv_into_analysis(palm, landmarks, image_base64=None, allow_landmark_heuristic=False)
    assert merged.line_geometry is None
    assert merged.geometry_source == "unavailable"


@patch("app.services.palm_pipeline.palm_analysis_from_vision", new_callable=AsyncMock)
@patch("app.services.palm_pipeline.detect_hand_landmarks_from_bytes")
def test_palm_analyze_vision_only_without_landmarks(mock_landmarks, mock_vision, vision_client):
    """Vision model owns motifs + line geometry — MediaPipe optional."""
    mock_landmarks.return_value = (None, "not_found")
    mock_vision.return_value = PalmAnalysis(
        life_line="strong",
        heart_line="curved",
        head_line="long",
        personality="quiet visionary",
        traits=["thoughtful", "resilient"],
        analysis_source="openrouter_vision",
        image_quality="good",
        geometry_source="vision_model",
        line_geometry=[
            {"name": "life_line", "points": [{"x": 0.3, "y": 0.4}, {"x": 0.32, "y": 0.55}, {"x": 0.35, "y": 0.7}]},
            {"name": "heart_line", "points": [{"x": 0.2, "y": 0.28}, {"x": 0.5, "y": 0.26}, {"x": 0.8, "y": 0.3}]},
            {"name": "head_line", "points": [{"x": 0.25, "y": 0.4}, {"x": 0.55, "y": 0.42}, {"x": 0.75, "y": 0.45}]},
        ],
    )
    # minimal valid jpeg bytes as base64
    b64, _ = _synthetic_palm_jpeg_and_landmarks()
    session_id = str(uuid.uuid4())
    vision_client.post(
        "/v1/sessions/register",
        json={"sessionId": session_id, "deviceInstallId": "device-test-1"},
    )
    res = vision_client.post(
        "/v1/palm/analyze",
        json={
            "sessionId": session_id,
            "deviceInstallId": "device-test-1",
            "seed": "unit-test",
            "imageBase64": b64,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["analysis_source"] == "openrouter_vision"
    assert data["geometry_source"] == "vision_model"
    assert len(data["line_geometry"]) >= 2


@patch("app.services.palm_pipeline.palm_analysis_from_vision", new_callable=AsyncMock)
@patch("app.services.palm_pipeline.detect_hand_landmarks_from_bytes")
def test_palm_analyze_succeeds_with_motifs_without_geometry(mock_landmarks, mock_vision, vision_client):
    """Report-first: motifs alone are enough — missing polylines must not 422."""
    mock_landmarks.return_value = (None, "not_found")
    mock_vision.return_value = PalmAnalysis(
        life_line="moderate",
        heart_line="curved",
        head_line="medium",
        personality="steady navigator",
        traits=["grounded", "curious"],
        analysis_source="openrouter_vision",
        image_quality="acceptable",
        geometry_source=None,
        line_geometry=None,
    )
    b64, _ = _synthetic_palm_jpeg_and_landmarks()
    session_id = str(uuid.uuid4())
    vision_client.post(
        "/v1/sessions/register",
        json={"sessionId": session_id, "deviceInstallId": "device-test-1"},
    )
    res = vision_client.post(
        "/v1/palm/analyze",
        json={
            "sessionId": session_id,
            "deviceInstallId": "device-test-1",
            "seed": "unit-test",
            "imageBase64": b64,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["life_line"] == "moderate"
    assert data["heart_line"] == "curved"
    assert data["head_line"] == "medium"
    assert data.get("line_geometry") in (None, [])


@patch("app.services.palm_pipeline.palm_analysis_from_vision", new_callable=AsyncMock)
@patch("app.services.palm_pipeline.detect_hand_landmarks_from_bytes")
def test_palm_analyze_structured_unreadable_when_no_hand(mock_landmarks, mock_vision, monkeypatch):
    mock_landmarks.return_value = (None, "not_found")
    mock_vision.return_value = PalmAnalysis(
        life_line="",
        heart_line="",
        head_line="",
        personality="unknown",
        traits=["unknown"],
        analysis_source="openrouter_vision",
        image_quality="no_hand",
        confidence=0.05,
        line_geometry=None,
    )
    monkeypatch.setenv("PALM_ANALYSIS_MODE", "vision")
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test-key")
    monkeypatch.setenv("DEBUG", "false")
    get_settings.cache_clear()
    client = TestClient(create_app())
    b64, _ = _synthetic_palm_jpeg_and_landmarks()
    session_id = str(uuid.uuid4())
    client.post(
        "/v1/sessions/register",
        json={"sessionId": session_id, "deviceInstallId": "device-test-1"},
    )
    res = client.post(
        "/v1/palm/analyze",
        json={
            "sessionId": session_id,
            "deviceInstallId": "device-test-1",
            "seed": "unit-test",
            "imageBase64": b64,
        },
    )
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert isinstance(detail, dict)
    assert detail["code"] == "palm_unreadable"
    assert isinstance(detail.get("reasons"), list) and len(detail["reasons"]) >= 1


@patch("app.services.palm_pipeline.palm_analysis_from_vision", new_callable=AsyncMock)
@patch("app.services.palm_pipeline.detect_hand_landmarks_from_bytes")
def test_palm_analyze_prefers_cv_when_vision_says_no_hand(mock_landmarks, mock_vision, vision_client):
    """False vision no_hand must not 422 when OpenCV already locked creases."""
    b64, landmarks = _synthetic_palm_jpeg_and_landmarks()
    mock_landmarks.return_value = (landmarks, "mediapipe")
    mock_vision.return_value = PalmAnalysis(
        life_line="subtle",
        heart_line="straight",
        head_line="short",
        personality="quiet visionary",
        traits=["thoughtful"],
        analysis_source="openrouter_vision",
        image_quality="no_hand",
        confidence=0.1,
    )
    session_id = str(uuid.uuid4())
    vision_client.post(
        "/v1/sessions/register",
        json={"sessionId": session_id, "deviceInstallId": "device-test-1"},
    )
    res = vision_client.post(
        "/v1/palm/analyze",
        json={
            "sessionId": session_id,
            "deviceInstallId": "device-test-1",
            "seed": "unit-test",
            "imageBase64": b64,
            "landmarks": landmarks,
            "landmarksSource": "mediapipe",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["geometry_source"] == "opencv_creases"
    assert data.get("line_geometry")
    assert len(data["line_geometry"]) >= 2
    assert data["image_quality"] in {"good", "acceptable"}


@patch("app.services.palm_pipeline.palm_analysis_from_vision", new_callable=AsyncMock)
@patch("app.services.palm_pipeline.detect_hand_landmarks_from_bytes")
def test_palm_analyze_vision_success_with_creases(mock_landmarks, mock_vision, vision_client):
    b64, landmarks = _synthetic_palm_jpeg_and_landmarks()
    mock_landmarks.return_value = (landmarks, "mediapipe")
    mock_vision.return_value = PalmAnalysis(
        life_line="subtle",
        heart_line="straight",
        head_line="short",
        personality="quiet visionary",
        traits=["thoughtful", "resilient"],
        analysis_source="openrouter_vision",
        image_quality="good",
        geometry_source="vision_model",
        line_geometry=[
            {"name": "life_line", "points": [{"x": 0.01, "y": 0.01}, {"x": 0.02, "y": 0.02}]},
            {"name": "heart_line", "points": [{"x": 0.9, "y": 0.9}, {"x": 0.8, "y": 0.8}]},
            {"name": "head_line", "points": [{"x": 0.5, "y": 0.5}, {"x": 0.6, "y": 0.6}]},
        ],
    )
    session_id = str(uuid.uuid4())
    vision_client.post(
        "/v1/sessions/register",
        json={"sessionId": session_id, "deviceInstallId": "device-test-1"},
    )
    res = vision_client.post(
        "/v1/palm/analyze",
        json={
            "sessionId": session_id,
            "deviceInstallId": "device-test-1",
            "seed": "unit-test",
            "imageBase64": b64,
            "landmarks": landmarks,
            "landmarksSource": "mediapipe",
        },
    )
    assert res.status_code == 200
    data = res.json()
    # CV upgrade preferred when it locks; otherwise vision geometry retained.
    assert data["geometry_source"] in {"opencv_creases", "vision_model"}
    assert data.get("line_geometry")
    assert len(data["line_geometry"]) >= 2


@patch("app.services.palm_pipeline.palm_analysis_from_vision", new_callable=AsyncMock)
@patch("app.services.palm_pipeline.detect_hand_landmarks_from_bytes")
def test_palm_analyze_cv_only_when_llm_fails(mock_landmarks, mock_vision, vision_client):
    b64, landmarks = _synthetic_palm_jpeg_and_landmarks()
    mock_landmarks.return_value = (landmarks, "mediapipe")
    mock_vision.return_value = None
    session_id = str(uuid.uuid4())
    vision_client.post(
        "/v1/sessions/register",
        json={"sessionId": session_id, "deviceInstallId": "device-test-1"},
    )
    res = vision_client.post(
        "/v1/palm/analyze",
        json={
            "sessionId": session_id,
            "deviceInstallId": "device-test-1",
            "seed": "unit-test",
            "imageBase64": b64,
            "landmarks": landmarks,
            "landmarksSource": "mediapipe",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["analysis_source"] == "opencv_creases"
    assert data["geometry_source"] == "opencv_creases"
    assert data.get("line_geometry")


@patch("app.services.palm_pipeline.palm_analysis_from_vision", new_callable=AsyncMock)
def test_palm_analyze_vision_fallback_when_llm_fails_without_usable_image(mock_vision, vision_client):
    mock_vision.return_value = None
    session_id = str(uuid.uuid4())
    vision_client.post(
        "/v1/sessions/register",
        json={"sessionId": session_id, "deviceInstallId": "device-test-1"},
    )
    res = vision_client.post(
        "/v1/palm/analyze",
        json={
            "sessionId": session_id,
            "deviceInstallId": "device-test-1",
            "seed": "unit-test",
            "imageBase64": "aGVsbG8=",
        },
    )
    # DEBUG=true in conftest allows deterministic fallback (production returns 503).
    assert res.status_code == 200
    data = res.json()
    assert data["analysis_source"] == "fallback"
    assert data.get("line_geometry") in (None, [])


def test_palm_analyze_503_when_vision_not_configured(monkeypatch):
    monkeypatch.setenv("PALM_ANALYSIS_MODE", "vision")
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    get_settings.cache_clear()
    client = TestClient(create_app())
    session_id = str(uuid.uuid4())
    client.post(
        "/v1/sessions/register",
        json={"sessionId": session_id, "deviceInstallId": "device-test-1"},
    )
    res = client.post(
        "/v1/palm/analyze",
        json={
            "sessionId": session_id,
            "deviceInstallId": "device-test-1",
            "seed": "unit-test",
            "imageBase64": "aGVsbG8=",
        },
    )
    assert res.status_code == 503
    assert "OPENROUTER" in (res.json().get("detail") or "").upper() or "vision" in (
        res.json().get("detail") or ""
    ).lower()


@patch("app.services.palm_pipeline.palm_analysis_from_vision", new_callable=AsyncMock)
def test_palm_analyze_503_when_vision_fails_in_production(mock_vision, monkeypatch):
    mock_vision.return_value = None
    monkeypatch.setenv("PALM_ANALYSIS_MODE", "vision")
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test-key")
    monkeypatch.setenv("DEBUG", "false")
    get_settings.cache_clear()
    client = TestClient(create_app())
    session_id = str(uuid.uuid4())
    client.post(
        "/v1/sessions/register",
        json={"sessionId": session_id, "deviceInstallId": "device-test-1"},
    )
    res = client.post(
        "/v1/palm/analyze",
        json={
            "sessionId": session_id,
            "deviceInstallId": "device-test-1",
            "seed": "unit-test",
            "imageBase64": "aGVsbG8=",
        },
    )
    assert res.status_code == 503
    assert "unavailable" in (res.json().get("detail") or "").lower()

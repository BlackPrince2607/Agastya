"""Palm pipeline tests."""

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app
from app.schemas.palm import PalmAnalysis
from app.services.palm_cv import extract_line_geometry


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


@patch("app.services.palm_pipeline.palm_analysis_from_vision", new_callable=AsyncMock)
def test_palm_analyze_vision_success(mock_vision, vision_client):
    mock_vision.return_value = PalmAnalysis(
        life_line="strong",
        heart_line="curved",
        head_line="long",
        personality="quiet visionary",
        traits=["thoughtful", "resilient"],
        analysis_source="openrouter_vision",
        image_quality="good",
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
            "imageBase64": "aGVsbG8=",
        },
    )
    assert res.status_code == 200
    assert res.json()["analysis_source"] == "openrouter_vision"


@patch("app.services.palm_pipeline.palm_analysis_from_vision", new_callable=AsyncMock)
def test_palm_analyze_vision_fallback_when_llm_fails(mock_vision, vision_client):
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
    assert res.status_code == 200
    assert res.json()["analysis_source"] == "fallback"

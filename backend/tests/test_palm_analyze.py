"""Palm pipeline tests."""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app
from app.services.palm_cv import extract_line_geometry


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("PALM_ANALYSIS_MODE", "dummy")
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

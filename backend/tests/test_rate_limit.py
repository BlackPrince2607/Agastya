"""Rate limit smoke tests."""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app
from app.middleware import rate_limit as rate_limit_mod


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("DEBUG", "true")
    get_settings.cache_clear()
    rate_limit_mod._windows.clear()
    return TestClient(create_app())


def test_bootstrap_rate_limit_eventually_trips(client):
    session_id = str(uuid.uuid4())
    device = "device-rate-limit"
    last_status = 200
    for _ in range(25):
        res = client.get(
            f"/v1/sessions/bootstrap?sessionId={session_id}&deviceInstallId={device}",
        )
        last_status = res.status_code
        if res.status_code == 429:
            break
    assert last_status == 429


def test_mismatched_x_session_id_does_not_bypass_session_bucket(client):
    """Spoofed X-Session-Id must not create a fresh unlimited session key."""
    rate_limit_mod._windows.clear()
    session_id = str(uuid.uuid4())
    client.post(
        "/v1/sessions/register",
        json={"sessionId": session_id, "deviceInstallId": "device-a"},
    )
    rate_limit_mod._windows.clear()

    # Chat is limited to 30/hour by session. Spoofing header with random UUIDs
    # previously reset the bucket; now body session wins (or IP on mismatch).
    statuses: list[int] = []
    for i in range(35):
        spoof = str(uuid.uuid4())
        res = client.post(
            "/v1/chat",
            headers={"X-Session-Id": spoof},
            json={
                "sessionId": session_id,
                "deviceInstallId": "device-a",
                "messages": [{"role": "user", "content": f"hi {i}"}],
                "palmAnalysis": {
                    "life_line": "strong",
                    "heart_line": "curved",
                    "head_line": "long",
                    "personality": "seeker",
                    "traits": ["thoughtful"],
                },
                "profileSummary": "Name: Test",
                "isPremium": True,
            },
        )
        statuses.append(res.status_code)
        if res.status_code == 429:
            break
    assert 429 in statuses

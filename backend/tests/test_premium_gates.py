"""Premium gate tests."""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app
from app.services.bucket_store import bucket, set_bucket


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("DEBUG", "true")
    get_settings.cache_clear()
    return TestClient(create_app())


def _palm_payload():
    return {
        "life_line": "strong",
        "heart_line": "curved",
        "head_line": "long",
        "personality": "visionary",
        "traits": ["creative", "bold"],
    }


TEST_DEVICE = "pytest-device-install"


def test_full_report_requires_premium(client):
    session_id = str(uuid.uuid4())
    from app.schemas.palm import PalmAnalysis
    from app.services.bucket_store import bucket, set_bucket

    bkt = bucket(session_id)
    bkt.palm = PalmAnalysis(**_palm_payload())
    bkt.is_premium = False
    bkt.meta["deviceInstallId"] = TEST_DEVICE
    set_bucket(session_id, bkt)

    res = client.post(
        "/v1/reports/generate",
        json={
            "sessionId": session_id,
            "deviceInstallId": TEST_DEVICE,
            "seed": "test-seed",
            "mode": "full",
            "focusTopics": ["love"],
            "palmAnalysis": _palm_payload(),
        },
    )
    assert res.status_code == 403


def test_chat_free_cap_at_five(client):
    session_id = str(uuid.uuid4())
    from app.schemas.palm import PalmAnalysis

    bkt = bucket(session_id)
    bkt.palm = PalmAnalysis(**_palm_payload())
    bkt.is_premium = False
    bkt.meta["deviceInstallId"] = TEST_DEVICE
    set_bucket(session_id, bkt)

    body = {
        "sessionId": session_id,
        "deviceInstallId": TEST_DEVICE,
        "isPremium": True,
        "profileSummary": "Name: Test",
        "palmAnalysis": _palm_payload(),
        "messages": [{"role": "user", "content": f"msg {i}"} for i in range(6)],
    }
    res = client.post("/v1/chat", json=body)
    assert res.status_code == 200
    assert "preview ceiling" in res.json()["reply"].lower()


def test_chat_single_message_bypass_blocked_by_tail(client):
    """Sending one user message per request cannot bypass the free cap."""
    session_id = str(uuid.uuid4())
    from app.schemas.palm import PalmAnalysis

    bkt = bucket(session_id)
    bkt.palm = PalmAnalysis(**_palm_payload())
    bkt.is_premium = False
    bkt.meta["deviceInstallId"] = TEST_DEVICE
    bkt.chat_tail = [
        {"role": "user", "content": f"msg {i}"} for i in range(5)
    ]
    set_bucket(session_id, bkt)

    res = client.post(
        "/v1/chat",
        json={
            "sessionId": session_id,
            "deviceInstallId": TEST_DEVICE,
            "profileSummary": "Name: Test",
            "palmAnalysis": _palm_payload(),
            "messages": [{"role": "user", "content": "one more"}],
        },
    )
    assert res.status_code == 200
    assert "preview ceiling" in res.json()["reply"].lower()


def test_chat_accepts_frontend_payload_without_is_premium(client):
    """Expo client omits isPremium — server uses session bucket instead."""
    session_id = str(uuid.uuid4())
    from app.schemas.palm import PalmAnalysis

    bkt = bucket(session_id)
    bkt.palm = PalmAnalysis(**_palm_payload())
    bkt.meta["deviceInstallId"] = TEST_DEVICE
    set_bucket(session_id, bkt)

    res = client.post(
        "/v1/chat",
        json={
            "sessionId": session_id,
            "deviceInstallId": TEST_DEVICE,
            "profileSummary": "Name: Test",
            "palmAnalysis": _palm_payload(),
            "messages": [{"role": "user", "content": "Hello guide"}],
        },
    )
    assert res.status_code == 200
    assert res.json()["reply"]


def test_daily_tasks_accepts_frontend_payload_without_is_premium(client):
    session_id = str(uuid.uuid4())
    from app.schemas.palm import PalmAnalysis

    bkt = bucket(session_id)
    bkt.palm = PalmAnalysis(**_palm_payload())
    bkt.meta["deviceInstallId"] = TEST_DEVICE
    set_bucket(session_id, bkt)

    res = client.post(
        "/v1/tasks/daily",
        json={
            "sessionId": session_id,
            "deviceInstallId": TEST_DEVICE,
            "palmAnalysis": _palm_payload(),
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["tasks"]) >= 3

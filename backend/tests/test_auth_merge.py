"""Auth and session security tests."""

import uuid

import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-jwt-secret-for-pytest-only")
    get_settings.cache_clear()
    return TestClient(create_app())


def test_merge_requires_bearer_when_jwt_configured(client):
    session_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    res = client.post(
        "/v1/sessions/merge",
        json={"anonymousSessionId": session_id, "supabaseUserId": user_id},
    )
    assert res.status_code == 401


def test_merge_rejects_subject_mismatch(client):
    session_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    other_user = str(uuid.uuid4())
    token = jwt.encode(
        {"sub": other_user, "aud": "authenticated"},
        "test-jwt-secret-for-pytest-only",
        algorithm="HS256",
    )
    res = client.post(
        "/v1/sessions/merge",
        json={"anonymousSessionId": session_id, "supabaseUserId": user_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_register_rejects_invalid_session_id(client):
    res = client.post(
        "/v1/sessions/register",
        json={"sessionId": "not-a-uuid", "deviceInstallId": "dev-1"},
    )
    assert res.status_code == 422

"""Auth and session security tests."""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth.supabase_jwks import clear_jwks_client_cache
from app.config import get_settings
from app.main import create_app
from tests.jwt_test_utils import (
    TEST_SUPABASE_URL,
    generate_es256_test_keys,
    install_jwks_mock,
)


@pytest.fixture
def client(monkeypatch):
    keys = generate_es256_test_keys()
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("SUPABASE_URL", TEST_SUPABASE_URL)
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
    install_jwks_mock(monkeypatch, keys)
    get_settings.cache_clear()
    clear_jwks_client_cache()
    test_client = TestClient(create_app())
    test_client.test_keys = keys  # type: ignore[attr-defined]
    return test_client


def test_merge_requires_bearer_when_supabase_configured(client):
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
    token = client.test_keys.token(other_user)  # type: ignore[attr-defined]
    res = client.post(
        "/v1/sessions/merge",
        json={"anonymousSessionId": session_id, "supabaseUserId": user_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_merge_rejects_hs256_token(client, monkeypatch):
    """Legacy HS256 tokens must not be accepted after JWKS migration."""
    import jwt as pyjwt

    session_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    token = pyjwt.encode(
        {
            "sub": user_id,
            "aud": "authenticated",
            "iss": f"{TEST_SUPABASE_URL}/auth/v1",
            "exp": 9_999_999_999,
        },
        "legacy-shared-secret",
        algorithm="HS256",
    )
    res = client.post(
        "/v1/sessions/merge",
        json={"anonymousSessionId": session_id, "supabaseUserId": user_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 401


def test_authenticated_bootstrap_returns_richest_saved_session(client, monkeypatch):
    user_id = str(uuid.uuid4())
    plain_session_id = str(uuid.uuid4())
    premium_session_id = str(uuid.uuid4())

    async def _sessions_for_user(*_args, **_kwargs):
        return [
            {
                "session_id": plain_session_id,
                "device_install_id": "dev-old",
                "supabase_user_id": user_id,
                "display_name": "Plain",
                "gender": None,
                "focus_topics": [],
                "palm_storage_path": None,
                "palm_analysis": None,
                "preview_report": None,
                "full_report": None,
                "predictions": None,
                "chat_tail": [],
                "is_premium": False,
            },
            {
                "session_id": premium_session_id,
                "device_install_id": "dev-old",
                "supabase_user_id": user_id,
                "display_name": "Restored",
                "gender": "prefer_not",
                "focus_topics": ["growth"],
                "palm_storage_path": None,
                "palm_analysis": None,
                "preview_report": None,
                "full_report": None,
                "predictions": None,
                "chat_tail": [{"role": "guide", "content": "Welcome back"}],
                "is_premium": True,
            },
        ]

    monkeypatch.setattr(
        "app.routes.agastya.session_repository.list_sessions_for_user",
        _sessions_for_user,
    )

    token = client.test_keys.token(user_id)  # type: ignore[attr-defined]
    res = client.get(
        "/v1/sessions/bootstrap/authenticated",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert res.status_code == 200
    body = res.json()
    assert body["sessionId"] == premium_session_id
    assert body["displayName"] == "Restored"
    assert body["isPremium"] is True
    assert body["chatTail"] == [{"role": "guide", "content": "Welcome back"}]


def test_register_rejects_invalid_session_id(client):
    res = client.post(
        "/v1/sessions/register",
        json={"sessionId": "not-a-uuid", "deviceInstallId": "dev-1"},
    )
    assert res.status_code == 422

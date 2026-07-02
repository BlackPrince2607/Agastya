"""Account deletion endpoint tests."""

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


def test_delete_account_requires_auth(client):
    res = client.post("/v1/auth/delete-account")
    assert res.status_code == 401


def test_delete_account_success(client, monkeypatch):
    user_id = str(uuid.uuid4())

    async def _empty_sessions(*_args, **_kwargs):
        return []

    async def _delete_user(*_args, **_kwargs):
        return True

    monkeypatch.setattr(
        "app.routes.auth.session_repository.list_sessions_for_user",
        _empty_sessions,
    )
    monkeypatch.setattr(
        "app.routes.auth.delete_user_by_id",
        _delete_user,
    )

    token = client.test_keys.token(user_id)  # type: ignore[attr-defined]
    res = client.post(
        "/v1/auth/delete-account",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["ok"] is True

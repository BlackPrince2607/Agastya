"""Auth check-email endpoint tests."""

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("DEBUG", "true")
    get_settings.cache_clear()
    return TestClient(create_app())


def test_check_email_invalid_format(client):
    res = client.post("/v1/auth/check-email", json={"email": "not-an-email"})
    assert res.status_code == 422


def test_check_email_unchecked_without_service_role(client, monkeypatch):
    async def lookup_unavailable(email, settings):
        return None

    monkeypatch.setattr("app.routes.auth.user_exists_by_email", lookup_unavailable)
    res = client.post("/v1/auth/check-email", json={"email": "user@example.com"})
    assert res.status_code == 200
    data = res.json()
    assert data["checked"] is False
    assert data["exists"] is False


def test_check_email_returns_exists_when_admin_lookup_succeeds(client, monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role")
    get_settings.cache_clear()

    class FakeResponse:
        status_code = 200

        def json(self):
            return {"users": [{"email": "user@example.com"}]}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def get(self, url, headers=None, params=None):
            return FakeResponse()

    monkeypatch.setattr("app.services.auth_admin.httpx.AsyncClient", lambda **kwargs: FakeClient())

    res = client.post("/v1/auth/check-email", json={"email": "user@example.com"})
    assert res.status_code == 200
    assert res.json() == {"exists": True, "checked": True}

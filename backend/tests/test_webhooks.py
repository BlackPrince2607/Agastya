"""Webhook verification tests."""

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("REVENUECAT_WEBHOOK_SECRET", "rc-test-secret")
    get_settings.cache_clear()
    return TestClient(create_app())


def test_webhook_rejects_missing_auth(client):
    res = client.post(
        "/v1/webhooks/revenuecat",
        json={"event": {"type": "INITIAL_PURCHASE", "app_user_id": "abc"}},
    )
    assert res.status_code == 401


def test_webhook_accepts_valid_secret(client):
    res = client.post(
        "/v1/webhooks/revenuecat",
        headers={"Authorization": "rc-test-secret"},
        json={
            "event": {
                "type": "INITIAL_PURCHASE",
                "app_user_id": "00000000-0000-4000-8000-000000000001",
                "aliases": [],
            }
        },
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

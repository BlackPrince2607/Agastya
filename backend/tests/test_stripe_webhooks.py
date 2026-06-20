"""Stripe webhook tests."""

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("DEBUG", "true")
    get_settings.cache_clear()
    return TestClient(create_app())


def test_stripe_webhook_checkout_completed(client, monkeypatch):
    session_id = "00000000-0000-4000-8000-000000000099"

    async def fake_set_premium_by_session(sid, is_premium, settings):
        assert sid == session_id
        assert is_premium is True
        return True

    async def fake_set_premium_by_user(uid, is_premium, settings):
        return False

    monkeypatch.setattr(
        "app.routes.webhooks.session_repository.set_premium_by_session",
        fake_set_premium_by_session,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.session_repository.set_premium_by_user",
        fake_set_premium_by_user,
    )

    res = client.post(
        "/v1/webhooks/stripe",
        json={
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "client_reference_id": session_id,
                    "metadata": {"session_id": session_id},
                }
            },
        },
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_stripe_webhook_subscription_deleted(client, monkeypatch):
    session_id = "00000000-0000-4000-8000-000000000088"

    async def fake_set_premium_by_session(sid, is_premium, settings):
        assert sid == session_id
        assert is_premium is False
        return True

    monkeypatch.setattr(
        "app.routes.webhooks.session_repository.set_premium_by_session",
        fake_set_premium_by_session,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.session_repository.set_premium_by_user",
        lambda *a, **k: None,
    )

    res = client.post(
        "/v1/webhooks/stripe",
        json={
            "type": "customer.subscription.deleted",
            "data": {
                "object": {
                    "status": "canceled",
                    "metadata": {"session_id": session_id},
                }
            },
        },
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

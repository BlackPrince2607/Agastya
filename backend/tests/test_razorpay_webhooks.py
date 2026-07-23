"""Razorpay webhook tests."""

import hashlib
import hmac
import json

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", "whsec_test")
    get_settings.cache_clear()
    return TestClient(create_app())


def _sign(body: bytes, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


async def _async_true(*a, **k):
    return True


def test_razorpay_payment_link_paid_grants_premium(client, monkeypatch):
    session_id = "00000000-0000-4000-8000-000000000077"
    granted = {}

    async def fake_set_premium_by_session(sid, is_premium, settings, **kwargs):
        granted["session"] = (sid, is_premium, kwargs.get("premium_source"))
        return True

    async def fake_claim(*a, **k):
        return True

    monkeypatch.setattr(
        "app.routes.webhooks.session_repository.set_premium_by_session",
        fake_set_premium_by_session,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.session_repository.set_premium_by_user",
        lambda *a, **k: None,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_idempotency.claim_webhook_event",
        fake_claim,
    )

    payload = {
        "event": "payment_link.paid",
        "id": "evt_test_1",
        "payload": {
            "payment_link": {
                "entity": {
                    "id": "plink_1",
                    "amount_paid": 79900,
                    "notes": {
                        "session_id": session_id,
                        "billing_period": "monthly",
                    },
                }
            }
        },
    }
    body = json.dumps(payload).encode("utf-8")
    res = client.post(
        "/v1/webhooks/razorpay",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": _sign(body, "whsec_test"),
        },
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert granted["session"][0] == session_id
    assert granted["session"][1] is True
    assert granted["session"][2] == "razorpay"


def test_razorpay_payment_captured_resolves_link(client, monkeypatch):
    session_id = "00000000-0000-4000-8000-000000000066"
    granted = {}

    async def fake_set_premium_by_session(sid, is_premium, settings, **kwargs):
        granted["session"] = sid
        return True

    async def fake_claim(*a, **k):
        return True

    async def fake_intent_by_link(settings, link_id):
        assert link_id == "plink_abc"
        return {
            "id": "intent-1",
            "session_id": session_id,
            "billing_period": "monthly",
            "amount": 79900,
        }

    monkeypatch.setattr(
        "app.routes.webhooks.session_repository.set_premium_by_session",
        fake_set_premium_by_session,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.session_repository.set_premium_by_user",
        lambda *a, **k: None,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_idempotency.claim_webhook_event",
        fake_claim,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_intents.get_intent_by_payment_link",
        fake_intent_by_link,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_intents.mark_intent_paid",
        lambda *a, **k: _async_true(),
    )

    payload = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_abc",
                    "amount": 79900,
                    "payment_link_id": "plink_abc",
                    "notes": {},
                }
            }
        },
    }
    body = json.dumps(payload).encode("utf-8")
    res = client.post(
        "/v1/webhooks/razorpay",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": _sign(body, "whsec_test"),
        },
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert granted["session"] == session_id


def test_razorpay_refund_revokes(client, monkeypatch):
    session_id = "00000000-0000-4000-8000-000000000055"
    revoked = {}

    async def fake_set_premium_by_session(sid, is_premium, settings, **kwargs):
        revoked["premium"] = is_premium
        return True

    async def fake_claim(*a, **k):
        return True

    monkeypatch.setattr(
        "app.routes.webhooks.session_repository.set_premium_by_session",
        fake_set_premium_by_session,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.session_repository.set_premium_by_user",
        lambda *a, **k: None,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_idempotency.claim_webhook_event",
        fake_claim,
    )

    payload = {
        "event": "refund.processed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_refund_1",
                    "notes": {"session_id": session_id},
                }
            }
        },
    }
    body = json.dumps(payload).encode("utf-8")
    res = client.post(
        "/v1/webhooks/razorpay",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": _sign(body, "whsec_test"),
        },
    )
    assert res.status_code == 200
    assert revoked["premium"] is False


def test_razorpay_duplicate_event_ignored(client, monkeypatch):
    async def fake_claim(*a, **k):
        return False

    monkeypatch.setattr(
        "app.routes.webhooks.billing_idempotency.claim_webhook_event",
        fake_claim,
    )

    payload = {
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": "pay_dup"}}},
    }
    body = json.dumps(payload).encode("utf-8")
    res = client.post(
        "/v1/webhooks/razorpay",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": _sign(body, "whsec_test"),
        },
    )
    assert res.status_code == 200
    assert res.json()["status"] == "duplicate"

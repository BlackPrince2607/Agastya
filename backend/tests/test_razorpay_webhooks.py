"""Razorpay webhook tests — idempotency, dedupe, refund resolution."""

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


def _begin_process(*a, **k):
    async def _inner(*_a, **_k):
        return ("process", ["claimed-1"])

    return _inner


def test_razorpay_payment_link_paid_grants_premium(client, monkeypatch):
    session_id = "00000000-0000-4000-8000-000000000077"
    granted = {}
    completed = {}

    async def fake_set_premium_by_session(sid, is_premium, settings, **kwargs):
        granted["session"] = (sid, is_premium, kwargs.get("premium_source"))
        return True

    async def fake_begin(*a, **k):
        return ("process", ["plink:plink_1:paid"])

    async def fake_complete(provider, ids, settings):
        completed["ids"] = list(ids)

    monkeypatch.setattr(
        "app.routes.webhooks.session_repository.set_premium_by_session",
        fake_set_premium_by_session,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.session_repository.set_premium_by_user",
        lambda *a, **k: None,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_idempotency.begin_webhook_events",
        fake_begin,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_idempotency.complete_webhook_events",
        fake_complete,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_idempotency.ensure_processed_webhook_event",
        _async_true,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_intents.report_play_external_for_intent",
        _async_true,
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
    assert completed["ids"] == ["plink:plink_1:paid"]


def test_razorpay_payment_captured_resolves_link(client, monkeypatch):
    session_id = "00000000-0000-4000-8000-000000000066"
    granted = {}
    paid_kwargs = {}

    async def fake_set_premium_by_session(sid, is_premium, settings, **kwargs):
        granted["session"] = sid
        return True

    async def fake_begin(provider, keys, settings):
        assert "pay:pay_abc" in keys
        assert "plink:plink_abc:paid" in keys
        return ("process", list(keys))

    async def fake_intent_resolve(settings, **kwargs):
        assert kwargs.get("payment_link_id") == "plink_abc"
        return {
            "id": "intent-1",
            "session_id": session_id,
            "billing_period": "monthly",
            "amount": 79900,
        }

    async def fake_mark(settings, intent_id, **kwargs):
        paid_kwargs["payment_id"] = kwargs.get("razorpay_payment_id")
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
        "app.routes.webhooks.billing_idempotency.begin_webhook_events",
        fake_begin,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_idempotency.complete_webhook_events",
        _async_true,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_idempotency.ensure_processed_webhook_event",
        _async_true,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_intents.resolve_intent_for_payment",
        fake_intent_resolve,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_intents.mark_intent_paid",
        fake_mark,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_intents.report_play_external_for_intent",
        _async_true,
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
    assert paid_kwargs["payment_id"] == "pay_abc"


def test_razorpay_paid_events_dedupe_across_shapes(client, monkeypatch):
    """payment.captured then payment_link.paid for the same payment → second is duplicate."""
    begins = []

    async def fake_begin(provider, keys, settings):
        begins.append(list(keys))
        # First call processes; second call sees shared pay: key → duplicate.
        if len(begins) == 1:
            return ("process", list(keys))
        return ("duplicate", [])

    monkeypatch.setattr(
        "app.routes.webhooks.billing_idempotency.begin_webhook_events",
        fake_begin,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_idempotency.complete_webhook_events",
        _async_true,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_idempotency.ensure_processed_webhook_event",
        _async_true,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_intents.resolve_intent_for_payment",
        lambda *a, **k: _async_true(),
    )

    async def fake_resolve(*a, **k):
        return {
            "id": "intent-1",
            "session_id": "00000000-0000-4000-8000-000000000066",
            "billing_period": "monthly",
            "amount": 100,
        }

    monkeypatch.setattr(
        "app.routes.webhooks.billing_intents.resolve_intent_for_payment",
        fake_resolve,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_intents.mark_intent_paid",
        _async_true,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.session_repository.set_premium_by_session",
        _async_true,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.session_repository.set_premium_by_user",
        _async_true,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_intents.report_play_external_for_intent",
        _async_true,
    )

    captured = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_same",
                    "amount": 100,
                    "payment_link_id": "plink_same",
                    "notes": {},
                }
            }
        },
    }
    body1 = json.dumps(captured).encode("utf-8")
    res1 = client.post(
        "/v1/webhooks/razorpay",
        content=body1,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": _sign(body1, "whsec_test"),
        },
    )
    assert res1.status_code == 200
    assert res1.json()["status"] == "ok"

    link_paid = {
        "event": "payment_link.paid",
        "payload": {
            "payment_link": {"entity": {"id": "plink_same", "amount_paid": 100, "notes": {}}},
            "payment": {"entity": {"id": "pay_same", "amount": 100}},
        },
    }
    body2 = json.dumps(link_paid).encode("utf-8")
    res2 = client.post(
        "/v1/webhooks/razorpay",
        content=body2,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": _sign(body2, "whsec_test"),
        },
    )
    assert res2.status_code == 200
    assert res2.json()["status"] == "duplicate"
    assert begins[0] == ["pay:pay_same", "plink:plink_same:paid"]
    assert begins[1] == ["pay:pay_same", "plink:plink_same:paid"]


def test_razorpay_refund_resolves_via_payment_id(client, monkeypatch):
    """Refund with empty notes still revokes when intent is found by payment id."""
    session_id = "00000000-0000-4000-8000-000000000055"
    revoked = {}

    async def fake_set_premium_by_session(sid, is_premium, settings, **kwargs):
        revoked["premium"] = is_premium
        revoked["session"] = sid
        return True

    async def fake_begin(*a, **k):
        return ("process", ["refund.processed:pay_refund_1"])

    async def fake_resolve(settings, **kwargs):
        assert kwargs.get("payment_id") == "pay_refund_1"
        assert not kwargs.get("checkout_intent_id")
        return {
            "id": "intent-refund",
            "session_id": session_id,
            "supabase_user_id": None,
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
        "app.routes.webhooks.billing_idempotency.begin_webhook_events",
        fake_begin,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_idempotency.complete_webhook_events",
        _async_true,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_intents.resolve_intent_for_payment",
        fake_resolve,
    )

    payload = {
        "event": "refund.processed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_refund_1",
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
    assert revoked["premium"] is False
    assert revoked["session"] == session_id


def test_razorpay_refund_resolves_via_payment_link_id(client, monkeypatch):
    session_id = "00000000-0000-4000-8000-000000000044"
    revoked = {}

    async def fake_set_premium_by_session(sid, is_premium, settings, **kwargs):
        revoked["session"] = sid
        revoked["premium"] = is_premium
        return True

    async def fake_begin(*a, **k):
        return ("process", ["refund.processed:plink_r1"])

    async def fake_resolve(settings, **kwargs):
        assert kwargs.get("payment_link_id") == "plink_r1"
        return {"id": "intent-2", "session_id": session_id}

    monkeypatch.setattr(
        "app.routes.webhooks.session_repository.set_premium_by_session",
        fake_set_premium_by_session,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.session_repository.set_premium_by_user",
        lambda *a, **k: None,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_idempotency.begin_webhook_events",
        fake_begin,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_idempotency.complete_webhook_events",
        _async_true,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_intents.resolve_intent_for_payment",
        fake_resolve,
    )

    payload = {
        "event": "refund.processed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_x",
                    "payment_link_id": "plink_r1",
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
    assert revoked["session"] == session_id
    assert revoked["premium"] is False


def test_razorpay_refund_revokes_via_notes_fallback(client, monkeypatch):
    session_id = "00000000-0000-4000-8000-000000000055"
    revoked = {}

    async def fake_set_premium_by_session(sid, is_premium, settings, **kwargs):
        revoked["premium"] = is_premium
        return True

    async def fake_begin(*a, **k):
        return ("process", ["refund.processed:pay_refund_notes"])

    async def fake_resolve(*a, **k):
        return None

    monkeypatch.setattr(
        "app.routes.webhooks.session_repository.set_premium_by_session",
        fake_set_premium_by_session,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.session_repository.set_premium_by_user",
        lambda *a, **k: None,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_idempotency.begin_webhook_events",
        fake_begin,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_idempotency.complete_webhook_events",
        _async_true,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_intents.resolve_intent_for_payment",
        fake_resolve,
    )

    payload = {
        "event": "refund.processed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_refund_notes",
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
    async def fake_begin(*a, **k):
        return ("duplicate", [])

    monkeypatch.setattr(
        "app.routes.webhooks.billing_idempotency.begin_webhook_events",
        fake_begin,
    )

    payload = {
        "event": "payment.captured",
        "payload": {"payment": {"entity": {"id": "pay_dup", "payment_link_id": "plink_dup"}}},
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


def test_razorpay_paid_fails_idempotency_on_missing_session(client, monkeypatch):
    failed = {}

    async def fake_begin(*a, **k):
        return ("process", ["pay:pay_orphan"])

    async def fake_fail(provider, ids, settings):
        failed["ids"] = list(ids)

    async def fake_resolve(*a, **k):
        return None

    monkeypatch.setattr(
        "app.routes.webhooks.billing_idempotency.begin_webhook_events",
        fake_begin,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_idempotency.fail_webhook_events",
        fake_fail,
    )
    monkeypatch.setattr(
        "app.routes.webhooks.billing_intents.resolve_intent_for_payment",
        fake_resolve,
    )

    payload = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_orphan",
                    "amount": 100,
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
    assert res.status_code == 500
    assert failed["ids"] == ["pay:pay_orphan"]

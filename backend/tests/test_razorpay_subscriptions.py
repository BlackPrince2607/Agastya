"""Razorpay Subscriptions — checkout, hosted page, callback, confirm, cancel, webhooks."""

import hashlib
import hmac
import json
import time
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app

SESSION_ID = "00000000-0000-4000-8000-000000000101"
USER_ID = "00000000-0000-4000-8000-0000000001aa"
DEVICE_ID = "device-install-sub-001"
INTENT_ID = "00000000-0000-4000-8000-000000000199"
SUB_ID = "sub_test_123"
KEY_SECRET = "secret"
CURRENT_END = int(time.time()) + 30 * 86400


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("DEBUG", "false")
    monkeypatch.setenv("BILLING_RAZORPAY_ENABLED", "true")
    monkeypatch.setenv("BILLING_RAZORPAY_ANDROID_ENABLED", "true")
    monkeypatch.setenv("BILLING_RAZORPAY_TEST_BYPASS", "true")
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_test_x")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", KEY_SECRET)
    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", "whsec_test")
    monkeypatch.setenv("RAZORPAY_PLAN_MONTHLY", "plan_monthly")
    monkeypatch.setenv("RAZORPAY_PLAN_ANNUAL", "plan_annual")
    monkeypatch.delenv("RAZORPAY_AMOUNT_MONTHLY_PAISE", raising=False)
    monkeypatch.delenv("RAZORPAY_AMOUNT_ANNUAL_PAISE", raising=False)
    monkeypatch.setenv("BILLING_FORCE_COUNTRY", "IN")
    monkeypatch.setenv("CHECKOUT_ALLOWED_RETURN_ORIGINS", "agastya://")
    monkeypatch.setenv("PUBLIC_API_BASE_URL", "https://api.example.com")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test")
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    monkeypatch.setenv("CORS_ORIGINS", "https://agastya.app")
    get_settings.cache_clear()

    async def fake_plan_amount(_settings, plan_id):
        return {"plan_monthly": 14900, "plan_annual": 69900}[plan_id]

    monkeypatch.setattr("app.services.razorpay_client.plan_amount_paise", fake_plan_amount)
    return TestClient(create_app())


def _seed_bucket(is_premium=False):
    from app.services.bucket_store import bucket

    b = bucket(SESSION_ID)
    b.meta["deviceInstallId"] = DEVICE_ID
    b.meta["supabaseUserId"] = USER_ID
    b.is_premium = is_premium
    b.premium_source = None
    b.premium_expires_at = None
    return b


def _intent(**overrides):
    row = {
        "id": INTENT_ID,
        "session_id": SESSION_ID,
        "device_install_id": DEVICE_ID,
        "supabase_user_id": USER_ID,
        "billing_period": "monthly",
        "amount": 14900,
        "currency": "INR",
        "status": "pending",
        "razorpay_subscription_id": SUB_ID,
        "success_url": "agastya://onboarding/paywall?checkout=success&provider=razorpay",
        "cancel_url": "agastya://onboarding/paywall?checkout=cancelled&provider=razorpay",
    }
    row.update(overrides)
    return row


def _patch_grant(monkeypatch, granted: dict):
    async def fake_set_session(sid, is_premium, settings, **kwargs):
        granted["session"] = (sid, is_premium, kwargs.get("premium_expires_at"))
        return True

    async def fake_set_user(uid, is_premium, settings, **kwargs):
        granted["user"] = (uid, is_premium, kwargs.get("premium_expires_at"))
        return True

    async def fake_mark(_settings, intent_id, **kwargs):
        granted["marked"] = (intent_id, kwargs.get("razorpay_payment_id"))
        return True

    async def noop(*_a, **_k):
        return None

    monkeypatch.setattr("app.services.session_repository.set_premium_by_session", fake_set_session)
    monkeypatch.setattr("app.services.session_repository.set_premium_by_user", fake_set_user)
    monkeypatch.setattr("app.services.billing_intents.mark_intent_paid", fake_mark)
    monkeypatch.setattr("app.services.billing_intents.report_play_external_for_intent", noop)


@pytest.mark.parametrize(
    ("period", "plan", "amount"),
    [("monthly", "plan_monthly", 14900), ("annual", "plan_annual", 69900)],
)
def test_create_checkout_uses_subscription_plan(client, monkeypatch, period, plan, amount):
    captured: dict = {}

    async def fake_intent(*_a, **kwargs):
        captured["intent_amount"] = kwargs["amount"]
        return {"id": INTENT_ID}

    async def fake_create_sub(_settings, **kwargs):
        captured["plan_id"] = kwargs["plan_id"]
        captured["notes"] = kwargs["notes"]
        return {"id": SUB_ID, "status": "created"}

    async def fake_attach(_settings, intent_id, subscription_id):
        captured["attached"] = (intent_id, subscription_id)
        return True

    async def fail_link(*_a, **_k):
        raise AssertionError("payment link should not be used for subscription plans")

    monkeypatch.setattr("app.services.billing_intents.create_checkout_intent", fake_intent)
    monkeypatch.setattr("app.services.razorpay_client.create_subscription", fake_create_sub)
    monkeypatch.setattr("app.services.billing_intents.attach_subscription", fake_attach)
    monkeypatch.setattr("app.services.razorpay_client.create_payment_link", fail_link)
    _seed_bucket()

    res = client.post(
        "/v1/billing/razorpay/create-payment-link",
        json={
            "sessionId": SESSION_ID,
            "deviceInstallId": DEVICE_ID,
            "billingPeriod": period,
            "successUrl": "agastya://onboarding/paywall?checkout=success",
            "cancelUrl": "agastya://onboarding/paywall?checkout=cancelled",
            "platform": "android",
        },
    )
    assert res.status_code == 200, res.text
    assert res.json()["checkoutUrl"] == (
        f"https://api.example.com/v1/billing/razorpay/subscribe/{INTENT_ID}"
    )
    assert captured["plan_id"] == plan
    assert captured["intent_amount"] == amount
    assert captured["attached"] == (INTENT_ID, SUB_ID)
    assert captured["notes"]["checkout_intent_id"] == INTENT_ID
    assert captured["notes"]["supabase_user_id"] == USER_ID


def test_billing_config_lists_subscription_plans(client):
    res = client.get("/v1/billing/config", params={"platform": "android"})
    assert res.status_code == 200
    plans = res.json()["plans"]
    assert plans["monthly"]["amount"] == 14900
    assert plans["monthly"]["interval"] == "month"
    assert plans["monthly"]["autoRenew"] is True
    assert plans["annual"]["amount"] == 69900
    assert plans["annual"]["interval"] == "year"


def test_hosted_checkout_page_embeds_subscription(client, monkeypatch):
    async def fake_get(*_a, **_k):
        return _intent()

    monkeypatch.setattr("app.services.billing_intents.get_intent_by_id", fake_get)
    res = client.get(f"/v1/billing/razorpay/subscribe/{INTENT_ID}")
    assert res.status_code == 200
    body = res.text
    assert "checkout.razorpay.com/v1/checkout.js" in body
    assert f'"subscription_id": "{SUB_ID}"' in body
    assert '"key": "rzp_test_x"' in body
    assert "subscription-callback?intent=" in body
    assert KEY_SECRET not in body


def test_hosted_checkout_page_rejects_bad_intent_id(client):
    res = client.get("/v1/billing/razorpay/subscribe/not-a-uuid")
    assert res.status_code == 404


def _sub_signature(payment_id: str) -> str:
    return hmac.new(
        KEY_SECRET.encode(), f"{payment_id}|{SUB_ID}".encode(), hashlib.sha256
    ).hexdigest()


def test_subscription_callback_grants_and_redirects(client, monkeypatch):
    granted: dict = {}
    _patch_grant(monkeypatch, granted)

    async def fake_get(*_a, **_k):
        return _intent()

    async def fake_fetch_sub(*_a, **_k):
        return {"id": SUB_ID, "status": "active", "current_end": CURRENT_END}

    monkeypatch.setattr("app.services.billing_intents.get_intent_by_id", fake_get)
    monkeypatch.setattr("app.services.razorpay_client.fetch_subscription", fake_fetch_sub)
    _seed_bucket()

    res = client.post(
        f"/v1/billing/razorpay/subscription-callback?intent={INTENT_ID}",
        data={
            "razorpay_payment_id": "pay_sub_1",
            "razorpay_subscription_id": SUB_ID,
            "razorpay_signature": _sub_signature("pay_sub_1"),
        },
    )
    assert res.status_code == 200
    assert "agastya://onboarding/paywall?checkout=success" in res.text
    assert f"checkoutIntentId={INTENT_ID}" in res.text
    assert granted["session"][1] is True
    assert granted["marked"] == (INTENT_ID, "pay_sub_1")
    expires = granted["session"][2]
    assert expires > datetime.fromtimestamp(CURRENT_END, tz=timezone.utc)


def test_subscription_callback_rejects_bad_signature(client, monkeypatch):
    granted: dict = {}
    _patch_grant(monkeypatch, granted)

    async def fake_get(*_a, **_k):
        return _intent()

    monkeypatch.setattr("app.services.billing_intents.get_intent_by_id", fake_get)
    _seed_bucket()

    res = client.post(
        f"/v1/billing/razorpay/subscription-callback?intent={INTENT_ID}",
        data={
            "razorpay_payment_id": "pay_sub_1",
            "razorpay_subscription_id": SUB_ID,
            "razorpay_signature": "deadbeef",
        },
    )
    assert res.status_code == 200
    assert "checkout=cancelled" in res.text
    assert "session" not in granted


def test_confirm_grants_when_subscription_active(client, monkeypatch):
    granted: dict = {}
    _patch_grant(monkeypatch, granted)

    async def fake_get(*_a, **_k):
        return _intent()

    async def fake_fetch_sub(*_a, **_k):
        return {"id": SUB_ID, "status": "active", "paid_count": 1, "current_end": CURRENT_END}

    monkeypatch.setattr("app.services.billing_intents.get_intent_by_id", fake_get)
    monkeypatch.setattr("app.services.razorpay_client.fetch_subscription", fake_fetch_sub)
    _seed_bucket()

    res = client.post(
        "/v1/billing/razorpay/confirm-payment",
        json={"sessionId": SESSION_ID, "deviceInstallId": DEVICE_ID, "checkoutIntentId": INTENT_ID},
    )
    assert res.status_code == 200, res.text
    assert res.json()["isPremium"] is True
    assert granted["user"][0] == USER_ID


def test_confirm_pending_when_subscription_not_paid(client, monkeypatch):
    async def fake_get(*_a, **_k):
        return _intent()

    async def fake_fetch_sub(*_a, **_k):
        return {"id": SUB_ID, "status": "created", "paid_count": 0}

    monkeypatch.setattr("app.services.billing_intents.get_intent_by_id", fake_get)
    monkeypatch.setattr("app.services.razorpay_client.fetch_subscription", fake_fetch_sub)
    _seed_bucket()

    res = client.post(
        "/v1/billing/razorpay/confirm-payment",
        json={"sessionId": SESSION_ID, "deviceInstallId": DEVICE_ID, "checkoutIntentId": INTENT_ID},
    )
    assert res.status_code == 200
    assert res.json()["isPremium"] is False
    assert res.json()["status"] == "created"


def test_cancel_subscription_at_cycle_end(client, monkeypatch):
    captured: dict = {}

    async def fake_latest(*_a, **_k):
        return _intent(status="paid")

    async def fake_fetch_sub(*_a, **_k):
        return {"id": SUB_ID, "status": "active", "current_end": CURRENT_END}

    async def fake_cancel(_settings, subscription_id, *, at_cycle_end):
        captured["cancel"] = (subscription_id, at_cycle_end)
        return {"id": SUB_ID, "status": "active", "current_end": CURRENT_END}

    monkeypatch.setattr(
        "app.services.billing_intents.get_latest_paid_subscription_intent", fake_latest
    )
    monkeypatch.setattr("app.services.razorpay_client.fetch_subscription", fake_fetch_sub)
    monkeypatch.setattr("app.services.razorpay_client.cancel_subscription", fake_cancel)
    _seed_bucket(is_premium=True)

    res = client.post(
        "/v1/billing/razorpay/cancel-subscription",
        json={"sessionId": SESSION_ID, "deviceInstallId": DEVICE_ID},
    )
    assert res.status_code == 200, res.text
    assert captured["cancel"] == (SUB_ID, True)
    assert res.json()["cancelled"] is True
    assert res.json()["accessUntil"]


def test_cancel_subscription_404_without_subscription(client, monkeypatch):
    async def fake_latest(*_a, **_k):
        return None

    monkeypatch.setattr(
        "app.services.billing_intents.get_latest_paid_subscription_intent", fake_latest
    )
    _seed_bucket(is_premium=True)
    res = client.post(
        "/v1/billing/razorpay/cancel-subscription",
        json={"sessionId": SESSION_ID, "deviceInstallId": DEVICE_ID},
    )
    assert res.status_code == 404


# --- Webhooks ---------------------------------------------------------------


def _post_webhook(client, payload: dict):
    body = json.dumps(payload).encode()
    sig = hmac.new(b"whsec_test", body, hashlib.sha256).hexdigest()
    return client.post(
        "/v1/webhooks/razorpay",
        content=body,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig},
    )


def _patch_webhook_infra(monkeypatch, applied: list):
    async def fake_begin(*_a, **_k):
        return ("process", ["claimed"])

    async def noop(*_a, **_k):
        return None

    async def fake_by_sub(*_a, **_k):
        return _intent(status="paid")

    async def fake_apply(settings, session_id, user_id, is_premium, source, **kwargs):
        applied.append((session_id, user_id, is_premium, kwargs))
        return True

    monkeypatch.setattr("app.routes.webhooks.billing_idempotency.begin_webhook_events", fake_begin)
    monkeypatch.setattr("app.routes.webhooks.billing_idempotency.complete_webhook_events", noop)
    monkeypatch.setattr("app.routes.webhooks.billing_idempotency.fail_webhook_events", noop)
    monkeypatch.setattr("app.services.billing_intents.get_intent_by_subscription", fake_by_sub)
    monkeypatch.setattr("app.routes.webhooks._apply_premium_to_ids", fake_apply)


def test_webhook_subscription_charged_extends_access(client, monkeypatch):
    applied: list = []
    _patch_webhook_infra(monkeypatch, applied)
    res = _post_webhook(
        client,
        {
            "event": "subscription.charged",
            "payload": {
                "subscription": {
                    "entity": {"id": SUB_ID, "status": "active", "current_end": CURRENT_END}
                },
                "payment": {"entity": {"id": "pay_renew_2", "invoice_id": "inv_2"}},
            },
        },
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    session_id, user_id, is_premium, kwargs = applied[0]
    assert (session_id, user_id, is_premium) == (SESSION_ID, USER_ID, True)
    assert kwargs["premium_expires_at"] > datetime.fromtimestamp(CURRENT_END, tz=timezone.utc)
    assert kwargs["notify"] is False


def test_webhook_subscription_halted_revokes(client, monkeypatch):
    applied: list = []
    _patch_webhook_infra(monkeypatch, applied)
    res = _post_webhook(
        client,
        {
            "event": "subscription.halted",
            "payload": {"subscription": {"entity": {"id": SUB_ID, "status": "halted"}}},
        },
    )
    assert res.status_code == 200
    assert applied[0][2] is False


def test_webhook_subscription_cancelled_keeps_paid_cycle(client, monkeypatch):
    applied: list = []
    _patch_webhook_infra(monkeypatch, applied)
    res = _post_webhook(
        client,
        {
            "event": "subscription.cancelled",
            "payload": {
                "subscription": {
                    "entity": {"id": SUB_ID, "status": "cancelled", "current_end": CURRENT_END}
                }
            },
        },
    )
    assert res.status_code == 200
    assert applied[0][2] is True
    assert applied[0][3]["notify"] is False


def test_webhook_subscription_payment_captured_ignored(client, monkeypatch):
    applied: list = []
    _patch_webhook_infra(monkeypatch, applied)
    res = _post_webhook(
        client,
        {
            "event": "payment.captured",
            "payload": {"payment": {"entity": {"id": "pay_x", "invoice_id": "inv_1", "notes": {}}}},
        },
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ignored"
    assert applied == []

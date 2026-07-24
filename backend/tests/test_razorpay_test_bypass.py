"""Billing create-payment-link allowlist + test-bypass + confirm smoke."""

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("BILLING_RAZORPAY_ENABLED", "true")
    monkeypatch.setenv("BILLING_RAZORPAY_ANDROID_ENABLED", "true")
    monkeypatch.setenv("BILLING_RAZORPAY_TEST_BYPASS", "true")
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_test_x")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "secret")
    monkeypatch.setenv("RAZORPAY_AMOUNT_MONTHLY_PAISE", "100")
    monkeypatch.setenv("RAZORPAY_AMOUNT_ANNUAL_PAISE", "200")
    monkeypatch.setenv("BILLING_FORCE_COUNTRY", "IN")
    monkeypatch.setenv("CHECKOUT_ALLOWED_RETURN_ORIGINS", "agastya://")
    get_settings.cache_clear()
    return TestClient(create_app())


SESSION_ID = "00000000-0000-4000-8000-000000000001"
USER_ID = "00000000-0000-4000-8000-0000000000aa"
DEVICE_ID = "device-install-test-001"


def _seed_signed_in_bucket():
    from app.services.bucket_store import bucket

    b = bucket(SESSION_ID)
    b.meta["deviceInstallId"] = DEVICE_ID
    b.meta["supabaseUserId"] = USER_ID
    return b


def test_android_without_token_rejected_when_bypass_off(monkeypatch):
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("BILLING_RAZORPAY_ENABLED", "true")
    monkeypatch.setenv("BILLING_RAZORPAY_ANDROID_ENABLED", "true")
    monkeypatch.setenv("BILLING_RAZORPAY_TEST_BYPASS", "false")
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_test_x")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "secret")
    monkeypatch.setenv("RAZORPAY_AMOUNT_MONTHLY_PAISE", "100")
    monkeypatch.setenv("RAZORPAY_AMOUNT_ANNUAL_PAISE", "200")
    monkeypatch.setenv("CHECKOUT_ALLOWED_RETURN_ORIGINS", "agastya://")
    get_settings.cache_clear()
    client = TestClient(create_app())
    _seed_signed_in_bucket()
    res = client.post(
        "/v1/billing/razorpay/create-payment-link",
        json={
            "sessionId": SESSION_ID,
            "deviceInstallId": DEVICE_ID,
            "billingPeriod": "monthly",
            "successUrl": "agastya://onboarding/paywall?checkout=success",
            "cancelUrl": "agastya://onboarding/paywall?checkout=cancelled",
            "platform": "android",
        },
    )
    assert res.status_code == 400
    assert "externalTransactionToken" in res.json()["detail"]


def test_create_payment_link_requires_sign_in(client):
    from app.services.bucket_store import bucket

    b = bucket(SESSION_ID)
    b.meta["deviceInstallId"] = DEVICE_ID
    b.meta.pop("supabaseUserId", None)

    res = client.post(
        "/v1/billing/razorpay/create-payment-link",
        json={
            "sessionId": SESSION_ID,
            "deviceInstallId": DEVICE_ID,
            "billingPeriod": "monthly",
            "successUrl": "agastya://onboarding/paywall?checkout=success",
            "cancelUrl": "agastya://onboarding/paywall?checkout=cancelled",
            "platform": "android",
        },
    )
    assert res.status_code == 401
    assert "Sign in" in res.json()["detail"]


def test_android_without_token_allowed_when_bypass_on(client, monkeypatch):
    captured: dict = {}

    async def fake_create(*_a, **kwargs):
        captured["callback_url"] = kwargs.get("callback_url")
        return {"id": "plink_test", "short_url": "https://rzp.io/test"}

    async def fake_intent(*_a, **kwargs):
        assert kwargs.get("supabase_user_id") == USER_ID
        return {"id": "00000000-0000-4000-8000-000000000099"}

    async def fake_attach(*_a, **_k):
        return True

    monkeypatch.setattr("app.services.razorpay_client.create_payment_link", fake_create)
    monkeypatch.setattr("app.services.billing_intents.create_checkout_intent", fake_intent)
    monkeypatch.setattr("app.services.billing_intents.attach_payment_link", fake_attach)

    _seed_signed_in_bucket()

    res = client.post(
        "/v1/billing/razorpay/create-payment-link",
        json={
            "sessionId": SESSION_ID,
            "deviceInstallId": DEVICE_ID,
            "billingPeriod": "monthly",
            "successUrl": "agastya://onboarding/paywall?checkout=success",
            "cancelUrl": "agastya://onboarding/paywall?checkout=cancelled",
            "platform": "android",
        },
    )
    assert res.status_code == 200
    assert "checkoutUrl" in res.json()
    # Razorpay gets an HTTPS bridge, not the raw deep link.
    assert captured["callback_url"].startswith("http")
    assert "/v1/billing/razorpay/return?target=" in captured["callback_url"]


def test_razorpay_return_bridge_redirects_to_allowlisted_deep_link(client):
    res = client.get(
        "/v1/billing/razorpay/return",
        params={
            "target": "agastya://onboarding/paywall?checkout=success",
            "razorpay_payment_id": "pay_x",
        },
        follow_redirects=False,
    )
    assert res.status_code == 302
    loc = res.headers["location"]
    assert loc.startswith("agastya://onboarding/paywall")
    assert "checkout=success" in loc
    assert "razorpay_payment_id=pay_x" in loc


def test_confirm_payment_grants_premium_when_link_paid(client, monkeypatch):
    intent = {
        "id": "00000000-0000-4000-8000-000000000099",
        "session_id": SESSION_ID,
        "device_install_id": DEVICE_ID,
        "supabase_user_id": USER_ID,
        "billing_period": "monthly",
        "razorpay_payment_link_id": "plink_paid",
        "status": "pending",
    }
    granted = {}

    async def fake_latest(*_a, **_k):
        return intent

    async def fake_fetch(*_a, **_k):
        return {"id": "plink_paid", "status": "paid", "amount_paid": 100}

    async def fake_mark(*_a, **_k):
        return True

    async def fake_set_session(sid, is_premium, settings, **kwargs):
        granted["session"] = (sid, is_premium, kwargs.get("premium_source"))
        return True

    async def fake_set_user(uid, is_premium, settings, **kwargs):
        granted["user"] = (uid, is_premium)
        return True

    monkeypatch.setattr("app.services.billing_intents.get_latest_intent_for_session", fake_latest)
    monkeypatch.setattr("app.services.razorpay_client.fetch_payment_link", fake_fetch)
    monkeypatch.setattr("app.services.billing_intents.mark_intent_paid", fake_mark)
    monkeypatch.setattr("app.services.session_repository.set_premium_by_session", fake_set_session)
    monkeypatch.setattr("app.services.session_repository.set_premium_by_user", fake_set_user)

    _seed_signed_in_bucket()

    res = client.post(
        "/v1/billing/razorpay/confirm-payment",
        json={
            "sessionId": SESSION_ID,
            "deviceInstallId": DEVICE_ID,
            "paymentLinkId": "plink_paid",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["isPremium"] is True
    assert body["status"] == "paid"
    assert granted["session"][0] == SESSION_ID
    assert granted["user"][0] == USER_ID


def test_confirm_payment_pending_when_link_not_paid(client, monkeypatch):
    intent = {
        "id": "00000000-0000-4000-8000-000000000099",
        "session_id": SESSION_ID,
        "device_install_id": DEVICE_ID,
        "supabase_user_id": USER_ID,
        "billing_period": "monthly",
        "razorpay_payment_link_id": "plink_open",
        "status": "pending",
    }

    async def fake_latest(*_a, **_k):
        return intent

    async def fake_fetch(*_a, **_k):
        return {"id": "plink_open", "status": "created"}

    monkeypatch.setattr("app.services.billing_intents.get_latest_intent_for_session", fake_latest)
    monkeypatch.setattr("app.services.razorpay_client.fetch_payment_link", fake_fetch)

    b = _seed_signed_in_bucket()
    b.is_premium = False
    b.premium_source = None
    b.premium_expires_at = None

    res = client.post(
        "/v1/billing/razorpay/confirm-payment",
        json={
            "sessionId": SESSION_ID,
            "deviceInstallId": DEVICE_ID,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["isPremium"] is False
    assert body["status"] == "created"

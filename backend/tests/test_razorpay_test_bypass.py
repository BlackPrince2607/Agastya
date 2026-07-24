"""Billing create-payment-link allowlist + test-bypass smoke."""

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
    res = client.post(
        "/v1/billing/razorpay/create-payment-link",
        json={
            "sessionId": "00000000-0000-4000-8000-000000000001",
            "deviceInstallId": "device-install-test-001",
            "billingPeriod": "monthly",
            "successUrl": "agastya://onboarding/paywall?checkout=success",
            "cancelUrl": "agastya://onboarding/paywall?checkout=cancelled",
            "platform": "android",
        },
    )
    assert res.status_code == 400
    assert "externalTransactionToken" in res.json()["detail"]


def test_android_without_token_allowed_when_bypass_on(client, monkeypatch):
    captured: dict = {}

    async def fake_create(*_a, **kwargs):
        captured["callback_url"] = kwargs.get("callback_url")
        return {"id": "plink_test", "short_url": "https://rzp.io/test"}

    async def fake_intent(*_a, **_k):
        return {"id": "00000000-0000-4000-8000-000000000099"}

    async def fake_attach(*_a, **_k):
        return True

    monkeypatch.setattr("app.services.razorpay_client.create_payment_link", fake_create)
    monkeypatch.setattr("app.services.billing_intents.create_checkout_intent", fake_intent)
    monkeypatch.setattr("app.services.billing_intents.attach_payment_link", fake_attach)

    # Ensure session hydrates without Supabase load errors
    from app.services.bucket_store import bucket

    b = bucket("00000000-0000-4000-8000-000000000001")
    b.meta["deviceInstallId"] = "device-install-test-001"

    res = client.post(
        "/v1/billing/razorpay/create-payment-link",
        json={
            "sessionId": "00000000-0000-4000-8000-000000000001",
            "deviceInstallId": "device-install-test-001",
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

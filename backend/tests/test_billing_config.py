"""Billing config endpoint tests — Android India Razorpay-only."""

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("BILLING_RAZORPAY_ENABLED", "true")
    monkeypatch.setenv("BILLING_RAZORPAY_ANDROID_ENABLED", "true")
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_test_x")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "secret")
    monkeypatch.setenv("RAZORPAY_AMOUNT_MONTHLY_PAISE", "14900")
    monkeypatch.setenv("RAZORPAY_AMOUNT_ANNUAL_PAISE", "34900")
    monkeypatch.setenv("BILLING_FORCE_COUNTRY", "IN")
    get_settings.cache_clear()
    return TestClient(create_app())


def test_billing_config_india_android(client):
    res = client.get("/v1/billing/config", params={"platform": "android"})
    assert res.status_code == 200
    data = res.json()
    assert data["country"] == "IN"
    ids = [p["id"] for p in data["providers"] if p["enabled"]]
    assert "google_play" in ids
    assert "razorpay" in ids
    rz = next(p for p in data["providers"] if p["id"] == "razorpay")
    assert rz["requiresPlayUserChoice"] is True
    assert "monthly" in data["plans"]
    assert "annual" in data["plans"]
    assert data["plans"]["monthly"]["amount"] == 14900
    assert data["plans"]["annual"]["amount"] == 34900
    assert "lifetime" not in data["plans"]


def test_billing_config_android_no_razorpay_when_flag_off(monkeypatch):
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("BILLING_RAZORPAY_ENABLED", "true")
    monkeypatch.setenv("BILLING_RAZORPAY_ANDROID_ENABLED", "false")
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_test_x")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "secret")
    monkeypatch.setenv("RAZORPAY_AMOUNT_MONTHLY_PAISE", "14900")
    monkeypatch.setenv("RAZORPAY_AMOUNT_ANNUAL_PAISE", "34900")
    monkeypatch.setenv("BILLING_FORCE_COUNTRY", "IN")
    get_settings.cache_clear()
    client = TestClient(create_app())
    res = client.get("/v1/billing/config", params={"platform": "android"})
    ids = [p["id"] for p in res.json()["providers"] if p["enabled"]]
    assert "google_play" in ids
    assert "razorpay" not in ids


def test_billing_config_ios_no_providers(client):
    res = client.get("/v1/billing/config", params={"platform": "ios"})
    assert res.status_code == 200
    ids = [p["id"] for p in res.json()["providers"] if p["enabled"]]
    assert ids == []


def test_billing_config_outside_india_no_razorpay(monkeypatch):
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("BILLING_RAZORPAY_ENABLED", "true")
    monkeypatch.setenv("BILLING_RAZORPAY_ANDROID_ENABLED", "true")
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_test_x")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "secret")
    monkeypatch.setenv("RAZORPAY_AMOUNT_MONTHLY_PAISE", "14900")
    monkeypatch.setenv("RAZORPAY_AMOUNT_ANNUAL_PAISE", "34900")
    monkeypatch.setenv("BILLING_FORCE_COUNTRY", "US")
    get_settings.cache_clear()
    client = TestClient(create_app())
    res = client.get("/v1/billing/config", params={"platform": "android"})
    ids = [p["id"] for p in res.json()["providers"] if p["enabled"]]
    assert "razorpay" not in ids
    assert "google_play" in ids


def test_spoofable_country_header_ignored(monkeypatch):
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("BILLING_RAZORPAY_ENABLED", "true")
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_test_x")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "secret")
    monkeypatch.setenv("RAZORPAY_AMOUNT_MONTHLY_PAISE", "14900")
    monkeypatch.setenv("RAZORPAY_AMOUNT_ANNUAL_PAISE", "34900")
    monkeypatch.delenv("BILLING_FORCE_COUNTRY", raising=False)
    get_settings.cache_clear()
    client = TestClient(create_app())
    res = client.get(
        "/v1/billing/config",
        params={"platform": "android"},
        headers={"x-country-code": "IN"},
    )
    assert res.json()["country"] is None
    ids = [p["id"] for p in res.json()["providers"] if p["enabled"]]
    assert "razorpay" not in ids

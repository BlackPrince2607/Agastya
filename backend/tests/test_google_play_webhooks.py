"""Google Play RTDN webhook tests."""

import base64
import json

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("GOOGLE_PLAY_RTDN_VERIFICATION_TOKEN", "rtdn-test-token")
    get_settings.cache_clear()
    return TestClient(create_app())


def _rtdn_payload(notification_type: int, purchase_token: str = "tok_abc") -> dict:
    inner = {
        "subscriptionNotification": {
            "notificationType": notification_type,
            "purchaseToken": purchase_token,
            "subscriptionId": "premium_unlock",
        }
    }
    encoded = base64.b64encode(json.dumps(inner).encode()).decode()
    return {"message": {"data": encoded, "messageId": f"msg-{notification_type}"}}


def _rtdn_onetime_payload(notification_type: int, purchase_token: str = "tok_ot") -> dict:
    inner = {
        "oneTimeProductNotification": {
            "notificationType": notification_type,
            "purchaseToken": purchase_token,
            "sku": "premium_unlock",
        }
    }
    encoded = base64.b64encode(json.dumps(inner).encode()).decode()
    return {"message": {"data": encoded, "messageId": f"ot-{notification_type}"}}


def test_rtdn_rejects_missing_token(client):
    res = client.post("/v1/webhooks/google-play", json=_rtdn_payload(13))
    assert res.status_code == 401


def test_rtdn_test_notification(client):
    inner = {"testNotification": {"version": "1.0"}}
    encoded = base64.b64encode(json.dumps(inner).encode()).decode()
    res = client.post(
        "/v1/webhooks/google-play?token=rtdn-test-token",
        json={"message": {"data": encoded, "messageId": "test-1"}},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_rtdn_unknown_token_ignored(client):
    res = client.post(
        "/v1/webhooks/google-play?token=rtdn-test-token",
        json=_rtdn_payload(13, purchase_token="unknown_token"),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ignored"


def test_rtdn_onetime_unknown_token_ignored(client):
    res = client.post(
        "/v1/webhooks/google-play?token=rtdn-test-token",
        json=_rtdn_onetime_payload(1, purchase_token="unknown_ot"),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ignored"

"""Unit tests for retry-safe webhook idempotency helpers."""

import asyncio
from datetime import datetime, timedelta, timezone

from app.config import Settings
from app.services import billing_idempotency


def _run(coro):
    return asyncio.run(coro)


def test_begin_without_supabase_allows_process(monkeypatch):
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    from app.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()
    outcome = _run(
        billing_idempotency.begin_webhook_event("razorpay", "pay:test-local", settings)
    )
    assert outcome == "process"


def test_begin_events_all_or_nothing_duplicate(monkeypatch):
    settings = Settings(
        debug=True,
        supabase_url="https://example.supabase.co",
        supabase_service_role_key="service-role",
    )
    calls = []

    async def fake_begin(provider, event_id, settings):
        calls.append(event_id)
        if event_id.endswith(":paid"):
            return "duplicate"
        return "process"

    failed = []

    async def fake_fail(provider, event_id, settings):
        failed.append(event_id)
        return True

    monkeypatch.setattr(billing_idempotency, "begin_webhook_event", fake_begin)
    monkeypatch.setattr(billing_idempotency, "fail_webhook_event", fake_fail)

    outcome, claimed = _run(
        billing_idempotency.begin_webhook_events(
            "razorpay",
            ["pay:p1", "plink:l1:paid"],
            settings,
        )
    )
    assert outcome == "duplicate"
    assert claimed == []
    assert failed == ["pay:p1"]
    assert calls == ["pay:p1", "plink:l1:paid"]


def test_begin_events_process_all(monkeypatch):
    settings = Settings(
        debug=True,
        supabase_url="https://example.supabase.co",
        supabase_service_role_key="service-role",
    )

    async def fake_begin(provider, event_id, settings):
        return "process"

    monkeypatch.setattr(billing_idempotency, "begin_webhook_event", fake_begin)

    outcome, claimed = _run(
        billing_idempotency.begin_webhook_events(
            "razorpay",
            ["pay:p1", "plink:l1:paid"],
            settings,
        )
    )
    assert outcome == "process"
    assert claimed == ["pay:p1", "plink:l1:paid"]


def test_is_stale_helper():
    now = datetime.now(timezone.utc)
    assert billing_idempotency._is_stale(None, now) is True
    assert billing_idempotency._is_stale(now.isoformat(), now) is False
    old = now - timedelta(minutes=10)
    assert billing_idempotency._is_stale(old.isoformat(), now) is True


def test_razorpay_paid_idempotency_keys_helper():
    assert billing_idempotency.razorpay_paid_idempotency_keys("pay_1", "plink_1") == [
        "pay:pay_1",
        "plink:plink_1:paid",
    ]
    assert billing_idempotency.razorpay_paid_idempotency_keys(None, "plink_1") == [
        "plink:plink_1:paid"
    ]
    assert billing_idempotency.razorpay_paid_idempotency_keys("pay_1", None) == ["pay:pay_1"]
    assert billing_idempotency.razorpay_paid_idempotency_keys(None, None) == []

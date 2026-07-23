"""Play ExternalTransactions reporter unit tests."""

import asyncio

from app.config import Settings
from app.services.play_external_transactions import report_external_transaction, _sanitize_transaction_id


def test_play_report_skipped_without_credentials():
    settings = Settings(
        google_play_service_account_json=None,
        play_package_name="com.agastya.app",
    )
    ok = asyncio.run(
        report_external_transaction(
            settings,
            external_transaction_id="intent_abc",
            external_transaction_token="tok_test",
            amount_micros=799000000,
            currency="INR",
            administrative_area="KA",
        )
    )
    assert ok is False


def test_sanitize_transaction_id_not_raw_token():
    tid = _sanitize_transaction_id("intent-uuid-with-dashes")
    assert len(tid) <= 63
    assert " " not in tid

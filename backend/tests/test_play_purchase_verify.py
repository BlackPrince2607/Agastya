"""Google Play purchase verification tests."""

from app.config import Settings
from app.services import play_purchase_verify


def test_record_play_purchase_no_supabase():
    settings = Settings(
        debug=True,
        supabase_url=None,
        supabase_service_role_key=None,
    )
    import asyncio

    ok = asyncio.run(
        play_purchase_verify.record_play_purchase(
            settings,
            purchase_token="tok_test",
            session_id="00000000-0000-4000-8000-000000000001",
            product_id="premium_monthly",
        )
    )
    assert ok is True


def test_verify_subscription_skips_without_credentials():
    settings = Settings(
        debug=True,
        google_play_service_account_json=None,
    )
    import asyncio

    result = asyncio.run(
        play_purchase_verify.verify_subscription_purchase(
            settings,
            purchase_token="tok_test",
            product_id="premium_monthly",
        )
    )
    assert result is None

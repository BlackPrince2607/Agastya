"""Return URL allowlist tests."""

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app
from app.routes.billing import _assert_return_url
from app.config import Settings
from fastapi import HTTPException


def test_allowlist_exact_origin_ok():
    settings = Settings(
        debug=False,
        checkout_allowed_return_origins="https://agastya.app,https://www.agastya.app",
    )
    _assert_return_url("https://agastya.app/onboarding/paywall?checkout=success", settings)


def test_allowlist_rejects_evil_subdomain():
    settings = Settings(
        debug=False,
        checkout_allowed_return_origins="https://agastya.app",
    )
    with pytest.raises(HTTPException) as exc:
        _assert_return_url("https://agastya.app.evil.com/phish", settings)
    assert exc.value.status_code == 400


def test_allowlist_required_in_production():
    settings = Settings(debug=False, checkout_allowed_return_origins="")
    with pytest.raises(HTTPException) as exc:
        _assert_return_url("https://anywhere.example/ok", settings)
    assert exc.value.status_code == 503

"""Unit tests for Supabase JWKS JWT verification."""

from __future__ import annotations

import time
import uuid

import jwt
import pytest
from fastapi import HTTPException

from app.auth.supabase_jwks import clear_jwks_client_cache
from app.auth.supabase_jwt import verify_supabase_access_token
from app.config import get_settings
from tests.jwt_test_utils import (
    TEST_ISSUER,
    TEST_SUPABASE_URL,
    Es256TestKeys,
    generate_es256_test_keys,
    install_jwks_mock,
)


@pytest.fixture
def es256_keys() -> Es256TestKeys:
    return generate_es256_test_keys()


@pytest.fixture
def settings(monkeypatch, es256_keys: Es256TestKeys):
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("SUPABASE_URL", TEST_SUPABASE_URL)
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
    install_jwks_mock(monkeypatch, es256_keys)
    get_settings.cache_clear()
    clear_jwks_client_cache()
    return get_settings()


def test_verify_valid_token(settings, es256_keys: Es256TestKeys):
    user_id = str(uuid.uuid4())
    token = es256_keys.token(user_id)
    claims = verify_supabase_access_token(token, settings)
    assert claims["sub"] == user_id
    assert claims["aud"] == "authenticated"
    assert claims["iss"] == TEST_ISSUER


def test_verify_rejects_wrong_issuer(settings, es256_keys: Es256TestKeys):
    user_id = str(uuid.uuid4())
    token = jwt.encode(
        {
            "sub": user_id,
            "aud": "authenticated",
            "iss": "https://evil.example.com/auth/v1",
            "exp": int(time.time()) + 3600,
        },
        es256_keys.private_key,
        algorithm="ES256",
        headers={"kid": es256_keys.kid},
    )
    with pytest.raises(HTTPException) as exc:
        verify_supabase_access_token(token, settings)
    assert exc.value.status_code == 401


def test_verify_rejects_wrong_audience(settings, es256_keys: Es256TestKeys):
    user_id = str(uuid.uuid4())
    token = es256_keys.token(user_id, aud="service_role")
    with pytest.raises(HTTPException) as exc:
        verify_supabase_access_token(token, settings)
    assert exc.value.status_code == 401


def test_verify_rejects_expired_token(settings, es256_keys: Es256TestKeys):
    user_id = str(uuid.uuid4())
    token = es256_keys.token(user_id, exp_offset=-60)
    with pytest.raises(HTTPException) as exc:
        verify_supabase_access_token(token, settings)
    assert exc.value.status_code == 401


def test_verify_rejects_not_yet_valid_token(settings, es256_keys: Es256TestKeys):
    user_id = str(uuid.uuid4())
    token = es256_keys.token(user_id, nbf_offset=3600)
    with pytest.raises(HTTPException) as exc:
        verify_supabase_access_token(token, settings)
    assert exc.value.status_code == 401


def test_verify_rejects_hs256(settings, es256_keys: Es256TestKeys):
    user_id = str(uuid.uuid4())
    token = jwt.encode(
        {
            "sub": user_id,
            "aud": "authenticated",
            "iss": TEST_ISSUER,
            "exp": int(time.time()) + 3600,
        },
        "shared-secret",
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as exc:
        verify_supabase_access_token(token, settings)
    assert exc.value.status_code == 401

"""ES256 JWT helpers for backend auth tests (no network / no legacy HS256)."""

from __future__ import annotations

import time
from dataclasses import dataclass
from types import SimpleNamespace

import jwt
from cryptography.hazmat.primitives.asymmetric import ec


TEST_SUPABASE_URL = "https://test-project.supabase.co"
TEST_ISSUER = f"{TEST_SUPABASE_URL}/auth/v1"
TEST_KID = "test-es256-kid"


@dataclass(frozen=True)
class Es256TestKeys:
    private_key: ec.EllipticCurvePrivateKey
    kid: str = TEST_KID

    @property
    def issuer(self) -> str:
        return TEST_ISSUER

    def signing_key(self) -> SimpleNamespace:
        """PyJWK-compatible object returned by get_signing_key_from_token."""
        return SimpleNamespace(key=self.private_key.public_key())

    def token(
        self,
        sub: str,
        *,
        aud: str = "authenticated",
        exp_offset: int = 3600,
        nbf_offset: int | None = None,
    ) -> str:
        now = int(time.time())
        payload: dict[str, str | int] = {
            "sub": sub,
            "aud": aud,
            "iss": self.issuer,
            "iat": now,
            "exp": now + exp_offset,
        }
        if nbf_offset is not None:
            payload["nbf"] = now + nbf_offset
        return jwt.encode(
            payload,
            self.private_key,
            algorithm="ES256",
            headers={"kid": self.kid},
        )


def generate_es256_test_keys() -> Es256TestKeys:
    return Es256TestKeys(private_key=ec.generate_private_key(ec.SECP256R1()))


def install_jwks_mock(monkeypatch, keys: Es256TestKeys) -> None:
    """Bypass JWKS HTTP fetch; resolve signing keys from the test keypair."""

    def _get_signing_key_from_token(_settings, _token: str) -> SimpleNamespace:
        return keys.signing_key()

    for target in (
        "app.auth.supabase_jwks.get_signing_key_from_token",
        "app.auth.supabase_jwt.get_signing_key_from_token",
    ):
        monkeypatch.setattr(target, _get_signing_key_from_token)

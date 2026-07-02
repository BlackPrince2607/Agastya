"""Verify Supabase access tokens on protected routes (JWKS / ES256)."""

from __future__ import annotations

import logging
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException

from app.auth.supabase_jwks import (
    SUPABASE_JWT_ALGORITHMS,
    get_signing_key_from_token,
    supabase_jwt_issuer,
)
from app.config import Settings, get_settings

logger = logging.getLogger(__name__)


def _bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None


def _decode_options() -> dict:
    return {
        "verify_signature": True,
        "verify_exp": True,
        "verify_nbf": True,
        "verify_iat": True,
        "verify_aud": True,
        "verify_iss": True,
        "require": ["exp", "sub", "iss", "aud"],
    }


def verify_supabase_access_token(token: str, settings: Settings) -> dict:
    """Verify a Supabase user access token using the project's JWKS (ES256)."""
    if not settings.supabase_url:
        raise HTTPException(
            status_code=503,
            detail="SUPABASE_URL is required to verify auth tokens.",
        )

    issuer = supabase_jwt_issuer(settings.supabase_url)

    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid Supabase token") from exc

    alg = header.get("alg")
    if alg not in SUPABASE_JWT_ALGORITHMS:
        logger.debug("Rejected JWT with disallowed algorithm: %s", alg)
        raise HTTPException(status_code=401, detail="Invalid Supabase token")

    try:
        signing_key = get_signing_key_from_token(settings, token)
    except jwt.exceptions.PyJWKClientConnectionError as exc:
        raise HTTPException(
            status_code=503,
            detail="Unable to fetch Supabase signing keys",
        ) from exc
    except jwt.exceptions.PyJWKClientError as exc:
        raise HTTPException(status_code=401, detail="Invalid Supabase token") from exc

    try:
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=list(SUPABASE_JWT_ALGORITHMS),
            audience="authenticated",
            issuer=issuer,
            options=_decode_options(),
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid Supabase token") from exc

    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token missing subject")

    return claims


async def require_supabase_user(
    authorization: Annotated[str | None, Header()] = None,
    settings: Annotated[Settings, Depends(get_settings)] = ...,
) -> str:
    token = _bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Authorization bearer token required")
    claims = verify_supabase_access_token(token, settings)
    return str(claims["sub"])

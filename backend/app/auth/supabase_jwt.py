"""Verify Supabase access tokens on protected routes."""

from __future__ import annotations

from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException

from app.config import Settings, get_settings


def _bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None


def verify_supabase_access_token(token: str, settings: Settings) -> dict:
    secret = settings.supabase_jwt_secret
    if not secret:
        raise HTTPException(
            status_code=503,
            detail="SUPABASE_JWT_SECRET is required to verify auth tokens.",
        )
    try:
        return jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid Supabase token") from exc


async def require_supabase_user(
    authorization: Annotated[str | None, Header()] = None,
    settings: Annotated[Settings, Depends(get_settings)] = ...,
) -> str:
    token = _bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Authorization bearer token required")
    claims = verify_supabase_access_token(token, settings)
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token missing subject")
    return str(sub)

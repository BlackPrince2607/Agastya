"""Fetch and cache Supabase Auth JWKS for asymmetric JWT verification."""

from __future__ import annotations

import logging
import threading
from typing import TYPE_CHECKING

import jwt
from jwt import PyJWKClient

if TYPE_CHECKING:
    from app.config import Settings

logger = logging.getLogger(__name__)

# Supabase ECC P-256 signing keys use ES256. Pin algorithms to prevent confusion attacks.
SUPABASE_JWT_ALGORITHMS: tuple[str, ...] = ("ES256",)

_clients_lock = threading.Lock()
_clients: dict[str, PyJWKClient] = {}


def supabase_jwks_url(supabase_url: str) -> str:
    base = supabase_url.rstrip("/")
    return f"{base}/auth/v1/.well-known/jwks.json"


def supabase_jwt_issuer(supabase_url: str) -> str:
    base = supabase_url.rstrip("/")
    return f"{base}/auth/v1"


def get_pyjwk_client(settings: Settings) -> PyJWKClient:
    """Return a cached PyJWKClient for the project's JWKS endpoint."""
    if not settings.supabase_url:
        raise ValueError("SUPABASE_URL is required for JWKS verification")

    url = supabase_jwks_url(settings.supabase_url)
    cache_key = f"{url}:{settings.supabase_jwks_cache_seconds}"

    with _clients_lock:
        client = _clients.get(cache_key)
        if client is None:
            client = PyJWKClient(
                url,
                cache_keys=True,
                lifespan=settings.supabase_jwks_cache_seconds,
            )
            _clients[cache_key] = client
            logger.debug("Initialized Supabase JWKS client for %s", url)
        return client


def clear_jwks_client_cache() -> None:
    """Clear in-process JWKS clients (used in tests)."""
    with _clients_lock:
        _clients.clear()


def get_signing_key_from_token(settings: Settings, token: str):
    """Resolve the signing key for a JWT via JWKS (refetches on unknown kid)."""
    client = get_pyjwk_client(settings)
    try:
        return client.get_signing_key_from_jwt(token)
    except jwt.exceptions.PyJWKClientConnectionError as exc:
        logger.warning("Failed to fetch Supabase JWKS: %s", exc)
        raise
    except jwt.exceptions.PyJWKClientError as exc:
        logger.debug("JWKS lookup failed: %s", exc)
        raise

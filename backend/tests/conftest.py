"""Shared pytest fixtures for backend tests."""

from __future__ import annotations

import pytest

from app.auth.supabase_jwks import clear_jwks_client_cache
from app.config import get_settings


@pytest.fixture(autouse=True)
def _isolate_settings_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep tests independent of developer backend/.env and OS env pollution."""
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    get_settings.cache_clear()
    clear_jwks_client_cache()
    yield  # type: ignore[misc]
    get_settings.cache_clear()
    clear_jwks_client_cache()

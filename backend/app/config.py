"""
Central configuration loaded from environment variables.

Why this file exists:
- Keeps secrets and environment-specific values OUT of code (12-factor style).
- One place to validate types (e.g. URLs, booleans) at startup.
- FastAPI `Depends(get_settings)` can inject settings into routes later.

`pydantic-settings` reads a `.env` file for local dev and real env vars in production
(Railway, Fly, etc.) — same code path everywhere.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ directory (parent of app/)
_BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Application settings. Add fields as you integrate Supabase / AI."""

    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- App ---
    app_name: str = "Agastya API"
    debug: bool = False
    api_v1_prefix: str = "/v1"

    # --- CORS (Expo web / tunnel / dev clients) ---
    # Comma-separated origins — include LAN IP origins when testing Expo web from another device.
    cors_origins: str = (
        "http://localhost:8081,http://127.0.0.1:8081,"
        "http://localhost:8082,http://127.0.0.1:8082,"
        "http://localhost:19006,http://127.0.0.1:19006,"
        "http://localhost:19000,http://127.0.0.1:19000"
    )
    # Expo tunnel dev URLs (HTTPS) — matched by regex in addition to cors_origins.
    cors_origin_regex: str | None = Field(default=r"https://.*\.exp\.direct")

    # --- Palm: dummy | groq | hybrid (CV landmarks + Groq narrative) ---
    palm_analysis_mode: Literal["dummy", "groq", "hybrid"] = "groq"

    # --- Rate limiting (optional Redis / Upstash for multi-worker deploys) ---
    redis_url: str | None = None

    # --- Trusted hosts (comma-separated; empty = allow all) ---
    trusted_hosts: str = ""

    # --- Supabase (optional — enables session persistence + palm storage) ---
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_jwt_secret: str | None = None
    supabase_palm_bucket: str = "palms"

    # --- Groq (optional — deterministic fallbacks when unset) ---
    groq_api_key: str | None = None
    groq_chat_model: str = "llama-3.3-70b-versatile"
    groq_vision_model: str = "meta-llama/llama-4-scout-17b-16e-instruct"

    # --- RevenueCat webhook (optional — skips signature verification when absent) ---
    revenuecat_webhook_secret: str | None = None

    # --- Stripe (web billing) ---
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_price_monthly: str | None = None
    stripe_price_annual: str | None = None

    # --- Sentry (optional — error tracking) ---
    sentry_dsn: str | None = None
    sentry_environment: str = "production"

    @property
    def groq_enabled(self) -> bool:
        return bool(self.groq_api_key)

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def trusted_hosts_list(self) -> list[str]:
        return [h.strip() for h in self.trusted_hosts.split(",") if h.strip()]

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @field_validator("cors_origins")
    @classmethod
    def _strip_cors(cls, v: str) -> str:
        return v.strip()


def validate_production_settings(settings: Settings) -> None:
    """Fail fast when DEBUG=false and required production secrets are missing."""
    if settings.debug:
        return
    missing: list[str] = []
    if not settings.groq_api_key:
        missing.append("GROQ_API_KEY")
    if not settings.supabase_url:
        missing.append("SUPABASE_URL")
    if not settings.supabase_service_role_key:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if not settings.supabase_jwt_secret:
        missing.append("SUPABASE_JWT_SECRET")
    if not settings.revenuecat_webhook_secret:
        missing.append("REVENUECAT_WEBHOOK_SECRET")
    if missing:
        raise RuntimeError(
            f"Production startup blocked — set required env vars: {', '.join(missing)}"
        )
    origins = settings.cors_origins_list
    if not origins or "*" in origins:
        raise RuntimeError("Production CORS_ORIGINS must list explicit origins (no wildcard)")


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance — call `get_settings.cache_clear()` in tests if needed."""
    return Settings()

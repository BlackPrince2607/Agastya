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
import sys
from typing import Literal

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict

# backend/ directory (parent of app/)
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_REPO_ROOT = _BACKEND_ROOT.parent
_IN_PYTEST = "pytest" in sys.modules

# OpenRouter model slugs that accept image input (see https://openrouter.ai/models?input_modalities=image)
_OPENROUTER_VISION_ALIASES: dict[str, str] = {
    "openai/gpt-4o-vision": "openai/gpt-4o-mini",
    "gpt-4o-vision": "openai/gpt-4o-mini",
    "openai/gpt-4-vision-preview": "openai/gpt-4o",
    "gpt-4-vision-preview": "openai/gpt-4o",
}


def normalize_openrouter_vision_model(model: str) -> str:
    """Map legacy/invalid vision slugs to valid OpenRouter model IDs."""
    s = model.strip()
    key = s.lower()
    if key in _OPENROUTER_VISION_ALIASES:
        return _OPENROUTER_VISION_ALIASES[key]
    return s


def _env_files() -> tuple[str, ...] | None:
    if _IN_PYTEST:
        return None
    paths: list[Path] = []
    for candidate in (_REPO_ROOT / ".env", _BACKEND_ROOT / ".env"):
        if candidate.is_file():
            paths.append(candidate)
    return tuple(str(p) for p in paths) or None


class Settings(BaseSettings):
    """Application settings. Add fields as you integrate Supabase / AI."""

    model_config = SettingsConfigDict(
        env_file=_env_files(),
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

    # --- Palm: dummy | vision | hybrid (CV creases + vision narrative) ---
    palm_analysis_mode: Literal["dummy", "vision", "hybrid"] = "vision"
    # Debug only: invent overlays from knuckle geometry when crease CV fails.
    palm_crease_fallback_heuristic: bool = False

    # --- Rate limiting (optional Redis / Upstash for multi-worker deploys) ---
    redis_url: str | None = None

    # --- Trusted hosts (comma-separated; empty = allow all) ---
    trusted_hosts: str = ""

    # --- Supabase (optional — enables session persistence + palm storage) ---
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_jwt_secret: str | None = None
    # JWKS cache TTL (seconds). Supabase edge caches JWKS for ~10 minutes; keep in sync for rotation.
    supabase_jwks_cache_seconds: int = 600
    supabase_palm_bucket: str = "palms"

    # --- OpenRouter (optional — deterministic fallbacks when unset) ---
    # Key must be from https://openrouter.ai/keys (not platform.openai.com).
    openrouter_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OPENROUTER_API_KEY", "openrouter_api_key"),
    )
    openrouter_chat_model: str = "openai/gpt-4o-mini"
    # Same model handles vision on OpenRouter; do NOT use openai/gpt-4o-vision (invalid slug).
    openrouter_vision_model: str = "openai/gpt-4o-mini"
    openrouter_chat_timeout_seconds: float = 60.0
    openrouter_vision_timeout_seconds: float = 90.0
    openrouter_app_url: str = "https://agastya.app"
    openrouter_app_name: str = "Agastya"
    allow_llm_fallback: bool = True

    # --- RevenueCat webhook (optional — skips signature verification when absent) ---
    revenuecat_webhook_secret: str | None = None

    # --- Stripe (web billing) ---
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_price_monthly: str | None = None
    stripe_price_annual: str | None = None

    # Comma-separated emails that always receive is_premium (founder / testers).
    premium_email_allowlist: str = ""

    # --- Sentry (optional — error tracking) ---
    sentry_dsn: str | None = None
    sentry_environment: str = "production"

    @property
    def premium_email_allowlist_set(self) -> set[str]:
        return {
            e.strip().lower()
            for e in self.premium_email_allowlist.split(",")
            if e.strip()
        }

    @property
    def llm_enabled(self) -> bool:
        return bool(self.openrouter_api_key)

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

    @field_validator("palm_analysis_mode", mode="before")
    @classmethod
    def _migrate_palm_mode(cls, v: object) -> object:
        if isinstance(v, str) and v.strip().lower() == "groq":
            return "vision"
        return v

    @field_validator("openrouter_vision_model", mode="before")
    @classmethod
    def _normalize_vision_model(cls, v: object) -> object:
        if isinstance(v, str):
            return normalize_openrouter_vision_model(v)
        return v

    @field_validator("openrouter_api_key")
    @classmethod
    def _strip_openrouter_key(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        return stripped or None

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        # backend/.env wins over repo root .env and over stale OS-level empty vars.
        return init_settings, env_settings, dotenv_settings, file_secret_settings


def validate_production_settings(settings: Settings) -> None:
    """Fail fast when DEBUG=false and required production secrets are missing."""
    if settings.debug:
        return
    missing: list[str] = []
    if not settings.openrouter_api_key:
        missing.append("OPENROUTER_API_KEY")
    if not settings.supabase_url:
        missing.append("SUPABASE_URL")
    if not settings.supabase_service_role_key:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
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

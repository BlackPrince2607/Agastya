"""
FastAPI application entrypoint.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import Settings, get_settings, validate_production_settings
from app.middleware.security import MaxBodySizeMiddleware, SecurityHeadersMiddleware
from app.routes import agastya, auth, billing, health, webhooks


def _init_sentry(settings: Settings) -> None:
    if not settings.sentry_dsn:
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment,
        traces_sample_rate=0.1,
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
        ],
        send_default_pii=False,
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    import logging

    log = logging.getLogger("app.main")
    settings = get_settings()

    validate_production_settings(settings)
    _init_sentry(settings)

    if settings.sentry_dsn:
        log.info("Sentry error tracking enabled (env=%s)", settings.sentry_environment)

    if settings.supabase_enabled:
        log.info("Supabase session persistence enabled")

    if settings.groq_enabled:
        extras = []
        if settings.palm_analysis_mode in {"groq", "hybrid"}:
            extras.append(f"palm via {settings.palm_analysis_mode}/{settings.groq_vision_model}")
        extras.append(f"chat/reports/tasks via {settings.groq_chat_model}")
        log.info("Groq inference enabled — %s", "; ".join(extras))
    elif not settings.debug:
        log.warning("GROQ_API_KEY missing in production")
    else:
        log.warning(
            "GROQ_API_KEY missing — palm analysis falls back to hash motifs; "
            "chat, dossiers, and daily rituals use heuristic text",
        )

    if settings.redis_url:
        log.info("Redis rate limiting enabled")
    elif not settings.debug:
        log.warning("REDIS_URL not set — using in-process rate limits (single worker recommended)")

    yield


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
        lifespan=lifespan,
    )

    if settings.trusted_hosts_list:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts_list)

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(MaxBodySizeMiddleware)

    cors_kw: dict = {
        "allow_origins": settings.cors_origins_list,
        "allow_credentials": True,
        "allow_methods": ["GET", "POST", "PATCH", "OPTIONS"],
        "allow_headers": ["Authorization", "Content-Type", "Accept"],
    }
    regex_segments: list[str] = []
    if settings.debug:
        regex_segments.append(r"http://(localhost|127\.0\.0\.1):\d+")
        if settings.cors_origin_regex:
            regex_segments.append(f"({settings.cors_origin_regex})")
    if regex_segments:
        cors_kw["allow_origin_regex"] = "|".join(regex_segments)

    app.add_middleware(CORSMiddleware, **cors_kw)

    app.include_router(health.router, prefix=settings.api_v1_prefix)
    app.include_router(auth.router, prefix=settings.api_v1_prefix)
    app.include_router(agastya.router, prefix=settings.api_v1_prefix)
    app.include_router(billing.router, prefix=settings.api_v1_prefix)
    app.include_router(webhooks.router, prefix=settings.api_v1_prefix)

    return app


app = create_app()

"""
FastAPI application entrypoint.

Request flow (mental model):
1. HTTP request hits Uvicorn → ASGI server hands it to FastAPI.
2. FastAPI matches URL + method to a *route* function in `app/routes/`.
3. That function may call a *service* (business logic, DB, external APIs).
4. Return value is serialized (often via a Pydantic *schema*) into JSON.

Why `create_app()` factory:
- Easier testing: `client = TestClient(create_app())`.
- One place to attach middleware, routers, and lifespan hooks as you grow.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.routes import agastya, health, webhooks


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
    """Startup/shutdown hooks."""
    import logging

    log = logging.getLogger("app.main")
    settings = get_settings()

    _init_sentry(settings)
    if settings.sentry_dsn:
        log.info("Sentry error tracking enabled (env=%s)", settings.sentry_environment)

    if settings.supabase_url and settings.supabase_service_role_key:
        log.info("Supabase session persistence enabled")

    if settings.groq_enabled:
        extras = []
        if settings.palm_analysis_mode == "groq":
            extras.append(f"palm via {settings.groq_vision_model}")
        extras.append(f"chat/reports/tasks via {settings.groq_chat_model}")
        log.info("Groq inference enabled — %s", "; ".join(extras))
    else:
        log.warning(
            "GROQ_API_KEY missing — palm analysis falls back to hash motifs; chat, dossiers, and daily rituals use heuristic text",
        )

    yield


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
        lifespan=lifespan,
    )

    cors_kw: dict = {
        "allow_origins": settings.cors_origins_list,
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }
    regex_segments: list[str] = []
    if settings.debug:
        # Covers any localhost / loopback Expo web port during dev without enumerating each one.
        regex_segments.append(r"http://(localhost|127\.0\.0\.1):\d+")
    if settings.cors_origin_regex:
        regex_segments.append(f"({settings.cors_origin_regex})")
    if regex_segments:
        cors_kw["allow_origin_regex"] = "|".join(regex_segments)

    app.add_middleware(CORSMiddleware, **cors_kw)

    # Versioned API surface — Expo will call e.g. https://api.example.com/v1/...
    app.include_router(health.router, prefix=settings.api_v1_prefix)
    app.include_router(agastya.router, prefix=settings.api_v1_prefix)
    # Webhooks: not rate-limited, not behind session auth
    app.include_router(webhooks.router, prefix=settings.api_v1_prefix)

    return app


app = create_app()

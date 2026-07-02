"""
Health check route.

Why a dedicated route:
- Deploy platforms (Railway, Render, k8s) probe `/v1/health` to know the process is up.
- Keeps monitoring separate from business logic (no DB call required here).
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.schemas.health import HealthResponse
from app.services import session_repository
from app.services.groq_health import groq_is_live

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health(settings: Annotated[Settings, Depends(get_settings)]) -> HealthResponse:
    """Liveness: process running and settings loaded."""
    if settings.debug:
        groq_live = await groq_is_live(settings) if settings.groq_api_key else False
        return HealthResponse(
            status="ok",
            service=settings.app_name,
            supabase=session_repository.is_enabled(settings),
            groq=groq_live,
            palm_groq=groq_live and settings.palm_analysis_mode in {"groq", "hybrid"},
        )
    return HealthResponse(status="ok", service=settings.app_name)

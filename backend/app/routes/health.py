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
from app.services.llm_health import llm_is_live

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health(settings: Annotated[Settings, Depends(get_settings)]) -> HealthResponse:
    """Liveness: process running and settings loaded."""
    if settings.debug:
        llm_live = await llm_is_live(settings) if settings.openrouter_api_key else False
        palm_vision = llm_live and settings.palm_analysis_mode in {"vision", "hybrid"}
        return HealthResponse(
            status="ok",
            service=settings.app_name,
            supabase=session_repository.is_enabled(settings),
            llm=llm_live,
            palm_vision=palm_vision,
            chat_model=settings.openrouter_chat_model if settings.openrouter_api_key else None,
            vision_model=settings.openrouter_vision_model if settings.openrouter_api_key else None,
        )
    return HealthResponse(status="ok", service=settings.app_name)

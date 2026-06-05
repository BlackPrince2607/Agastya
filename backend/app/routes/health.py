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

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health(settings: Annotated[Settings, Depends(get_settings)]) -> HealthResponse:
    """Liveness: process running and settings loaded."""
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        supabase=session_repository.is_enabled(settings),
        groq=settings.groq_enabled,
        palm_groq=settings.groq_enabled and settings.palm_analysis_mode == "groq",
    )

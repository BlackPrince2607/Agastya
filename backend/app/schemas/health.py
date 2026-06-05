"""Response shape for liveness / readiness checks."""

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """What clients (and load balancers) expect from a health endpoint."""

    status: str = Field(examples=["ok"])
    service: str = Field(examples=["agastya-api"])
    supabase: bool = False
    groq: bool = False
    palm_groq: bool = Field(
        default=False,
        description="True when palm vision path may run (Groq key + palm_analysis_mode groq)",
    )

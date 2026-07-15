"""Response shape for liveness / readiness checks."""

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """What clients (and load balancers) expect from a health endpoint."""

    status: str = Field(examples=["ok"])
    service: str = Field(examples=["agastya-api"])
    supabase: bool = False
    llm: bool = Field(
        default=False,
        description="True when OpenRouter chat completions are reachable",
    )
    palm_vision: bool = Field(
        default=False,
        description="True when palm vision path may run (OpenRouter key + palm_analysis_mode vision)",
    )
    chat_model: str | None = Field(
        default=None,
        description="OpenRouter chat model slug (e.g. openai/gpt-4o-mini)",
    )
    vision_model: str | None = Field(
        default=None,
        description="OpenRouter vision model slug for palm photos",
    )

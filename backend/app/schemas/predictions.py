"""Period predictions payloads shared with the Expo client."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.palm import PalmAnalysis
from app.utils.validators import _parse_uuid, validate_device_install_id

PredictionPeriod = Literal["month", "3month", "year"]
PredictionCategory = Literal["career", "love", "money", "growth"]


class PredictionItem(BaseModel):
    category: PredictionCategory
    headline: str
    detail: str
    score: int  # 0-100


class PredictionsResponse(BaseModel):
    period: PredictionPeriod
    items: list[PredictionItem]
    generated_at: str = Field(alias="generatedAt")
    source: Literal["llm", "fallback"] = "llm"

    model_config = {"populate_by_name": True}


class PredictionsGenerateBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    device_install_id: str = Field(alias="deviceInstallId")
    seed: str = ""
    period: PredictionPeriod = "month"
    palm_analysis: PalmAnalysis | None = Field(default=None, alias="palmAnalysis")
    focus_topics: list[str] = Field(default_factory=list, alias="focusTopics")
    is_premium: bool = Field(default=False, alias="isPremium")

    model_config = {"populate_by_name": True}

    @field_validator("session_id")
    @classmethod
    def _session_uuid(cls, v: str) -> str:
        return _parse_uuid(v)

    @field_validator("device_install_id")
    @classmethod
    def _device_id(cls, v: str) -> str:
        out = validate_device_install_id(v)
        if out is None:
            raise ValueError("deviceInstallId required")
        return out

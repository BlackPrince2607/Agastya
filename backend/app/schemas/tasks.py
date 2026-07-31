"""Daily ritual tasks."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.palm import PalmAnalysis
from app.utils.validators import _parse_uuid, validate_device_install_id


class Task(BaseModel):
    id: str
    text: str
    description: str
    category: Literal["love", "career", "money", "growth"]
    estimated_minutes: int = Field(default=10, alias="estimatedMinutes")
    difficulty: Literal["easy", "medium", "hard"] = "easy"
    examples: list[str] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class DailyTasksBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    device_install_id: str = Field(alias="deviceInstallId")
    palm_analysis: PalmAnalysis = Field(alias="palmAnalysis")
    is_premium: bool = Field(default=False, alias="isPremium")
    focus_topics: list[str] = Field(default_factory=list, alias="focusTopics")
    streak: int | None = None

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


class DailyTasksResponse(BaseModel):
    tasks: list[Task]
    variant: str
    focus_theme: str | None = Field(default=None, alias="focusTheme")
    source: Literal["llm", "fallback"] = "llm"

    model_config = {"populate_by_name": True}

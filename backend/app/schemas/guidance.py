"""Today's Guidance request/response DTOs."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.palm import PalmAnalysis
from app.utils.validators import _parse_uuid, validate_device_install_id


class DailyGuidanceBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    device_install_id: str = Field(alias="deviceInstallId")
    palm_analysis: PalmAnalysis | None = Field(default=None, alias="palmAnalysis")
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


class DailyGuidanceResponse(BaseModel):
    title: str
    body: str
    focus_theme: str | None = Field(default=None, alias="focusTheme")
    cached: bool = False
    date: str | None = None
    continue_hint: str | None = Field(default=None, alias="continueHint")
    consistency_note: str | None = Field(default=None, alias="consistencyNote")
    source: Literal["llm", "fallback"] = "llm"

    model_config = {"populate_by_name": True}


class DailyReflectBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    device_install_id: str = Field(alias="deviceInstallId")
    note: str | None = None

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


class DailyReflectResponse(BaseModel):
    ok: bool
    persisted: bool = False


class WeeklySummaryBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    device_install_id: str = Field(alias="deviceInstallId")
    palm_analysis: PalmAnalysis | None = Field(default=None, alias="palmAnalysis")
    focus_topics: list[str] = Field(default_factory=list, alias="focusTopics")
    streak: int | None = None
    rituals_completed_total: int | None = Field(default=None, alias="ritualsCompletedTotal")

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


class WeeklySummaryResponse(BaseModel):
    title: str
    body: str
    week_key: str = Field(alias="weekKey")
    cached: bool = False
    top_theme: str | None = Field(default=None, alias="topTheme")
    consistency_note: str | None = Field(default=None, alias="consistencyNote")
    current_chapter: str | None = Field(default=None, alias="currentChapter")
    source: Literal["llm", "fallback"] = "llm"

    model_config = {"populate_by_name": True}


class JourneyTimelineBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    device_install_id: str = Field(alias="deviceInstallId")
    streak: int | None = None
    rituals_completed_total: int | None = Field(default=None, alias="ritualsCompletedTotal")

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


class JourneyTimelineItem(BaseModel):
    id: str
    label: str
    detail: str
    at: str | None = None

    model_config = {"populate_by_name": True}


class JourneyTimelineResponse(BaseModel):
    items: list[JourneyTimelineItem]

    model_config = {"populate_by_name": True}


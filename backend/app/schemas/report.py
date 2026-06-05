"""Report payloads shared with the Expo client."""

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.palm import PalmAnalysis


class InsightSection(BaseModel):
    id: str
    title: str
    body: str
    tone: str | None = None


class AuraProfile(BaseModel):
    label: str
    gradient: list[str]


class LifeMetrics(BaseModel):
    love: int
    career: int
    money: int
    growth: int


class FullReport(BaseModel):
    blueprint_title: str = Field(alias="blueprintTitle")
    visionary_title: str = Field(alias="visionaryTitle")
    visionary_subtitle: str = Field(alias="visionarySubtitle")
    archetype_line: str = Field(alias="archetypeLine")
    headline: str
    sections: list[InsightSection]
    bold_prediction: str = Field(alias="boldPrediction")
    metrics: LifeMetrics
    aura: AuraProfile
    palm_analysis: PalmAnalysis | None = Field(default=None, alias="palmAnalysis")

    model_config = {"populate_by_name": True}


class GenerateReportBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    seed: str
    palm_analysis: PalmAnalysis | None = Field(default=None, alias="palmAnalysis")
    focus_topics: list[str] = Field(alias="focusTopics")
    mode: Literal["preview", "full"] = "full"
    display_name: str | None = Field(default=None, alias="displayName")
    gender: str | None = None

    model_config = {"populate_by_name": True}

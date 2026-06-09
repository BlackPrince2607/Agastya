"""Period predictions payloads shared with the Expo client."""

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.palm import PalmAnalysis

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

    model_config = {"populate_by_name": True}


class PredictionsGenerateBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    seed: str = ""
    period: PredictionPeriod = "month"
    palm_analysis: PalmAnalysis | None = Field(default=None, alias="palmAnalysis")
    focus_topics: list[str] = Field(default_factory=list, alias="focusTopics")
    is_premium: bool = Field(default=False, alias="isPremium")

    model_config = {"populate_by_name": True}

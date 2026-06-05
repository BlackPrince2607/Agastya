"""Daily ritual tasks."""

from pydantic import BaseModel, Field

from app.schemas.palm import PalmAnalysis


class DailyTasksBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    palm_analysis: PalmAnalysis = Field(alias="palmAnalysis")
    is_premium: bool = Field(alias="isPremium")

    model_config = {"populate_by_name": True}


class DailyTasksResponse(BaseModel):
    tasks: list[str]
    variant: str

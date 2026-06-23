"""Daily ritual tasks."""

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.palm import PalmAnalysis


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
    palm_analysis: PalmAnalysis = Field(alias="palmAnalysis")
    is_premium: bool = Field(default=False, alias="isPremium")

    model_config = {"populate_by_name": True}


class DailyTasksResponse(BaseModel):
    tasks: list[Task]
    variant: str

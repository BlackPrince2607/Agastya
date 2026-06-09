"""Chat turns."""

from pydantic import BaseModel, Field

from app.schemas.palm import PalmAnalysis


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    session_id: str = Field(alias="sessionId")
    messages: list[ChatTurn]
    palm_analysis: PalmAnalysis = Field(alias="palmAnalysis")
    profile_summary: str = Field(alias="profileSummary")
    is_premium: bool = Field(alias="isPremium")

    model_config = {"populate_by_name": True}


class ChatResponse(BaseModel):
    reply: str
    suggestions: list[str] = Field(default_factory=list)

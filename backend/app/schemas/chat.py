"""Chat turns."""

from pydantic import BaseModel, Field, field_validator

from app.schemas.palm import PalmAnalysis
from app.utils.validators import _parse_uuid, validate_device_install_id


class ChatTurn(BaseModel):
    role: str = Field(max_length=32)
    content: str = Field(max_length=4_000)


class ChatRequest(BaseModel):
    session_id: str = Field(alias="sessionId")
    device_install_id: str = Field(alias="deviceInstallId")
    messages: list[ChatTurn] = Field(max_length=40)
    palm_analysis: PalmAnalysis = Field(alias="palmAnalysis")
    profile_summary: str = Field(alias="profileSummary", max_length=2_000)
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


class ChatResponse(BaseModel):
    reply: str
    suggestions: list[str] = Field(default_factory=list)
    memory_changed: bool = Field(default=False, alias="memoryChanged")

    model_config = {"populate_by_name": True}

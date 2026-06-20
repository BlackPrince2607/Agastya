"""Anonymous session registration and bootstrap."""

from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.utils.validators import _parse_uuid, validate_device_install_id, validate_session_id


class SessionRegisterBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    device_install_id: str = Field(alias="deviceInstallId")
    display_name: str | None = Field(default=None, alias="displayName", max_length=64)
    gender: str | None = Field(default=None, max_length=32)
    focus_topics: list[str] | None = Field(default=None, alias="focusTopics")

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


class SessionProfilePatchBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    device_install_id: str = Field(alias="deviceInstallId")
    display_name: str | None = Field(default=None, alias="displayName", max_length=64)
    gender: str | None = Field(default=None, max_length=32)
    focus_topics: list[str] | None = Field(default=None, alias="focusTopics")

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


class SessionRegisterResponse(BaseModel):
    ok: bool = True


class SessionProfileResponse(BaseModel):
    session_id: str = Field(alias="sessionId")
    device_install_id: str | None = Field(default=None, alias="deviceInstallId")
    display_name: str | None = Field(default=None, alias="displayName")
    gender: str | None = None
    focus_topics: list[str] = Field(default_factory=list, alias="focusTopics")
    supabase_user_id: str | None = Field(default=None, alias="supabaseUserId")
    palm_storage_path: str | None = Field(default=None, alias="palmStoragePath")

    model_config = {"populate_by_name": True}


class SessionMergeBody(BaseModel):
    anonymous_session_id: str = Field(alias="anonymousSessionId")
    supabase_user_id: str = Field(alias="supabaseUserId")

    model_config = {"populate_by_name": True}

    @field_validator("anonymous_session_id", "supabase_user_id")
    @classmethod
    def _uuid_fields(cls, v: str) -> str:
        return _parse_uuid(v)


class SessionMergeResponse(BaseModel):
    ok: bool = True
    linked: bool = False


class SessionBootstrapResponse(BaseModel):
    """Full session snapshot for client restore after reinstall or API restart."""

    session_id: str = Field(alias="sessionId")
    device_install_id: str | None = Field(default=None, alias="deviceInstallId")
    display_name: str | None = Field(default=None, alias="displayName")
    gender: str | None = None
    focus_topics: list[str] = Field(default_factory=list, alias="focusTopics")
    supabase_user_id: str | None = Field(default=None, alias="supabaseUserId")
    palm_storage_path: str | None = Field(default=None, alias="palmStoragePath")
    palm_analysis: dict[str, Any] | None = Field(default=None, alias="palmAnalysis")
    preview_report: dict[str, Any] | None = Field(default=None, alias="previewReport")
    full_report: dict[str, Any] | None = Field(default=None, alias="fullReport")
    is_premium: bool = Field(default=False, alias="isPremium")

    model_config = {"populate_by_name": True}

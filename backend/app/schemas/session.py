"""Anonymous session registration and bootstrap."""

from typing import Any

from pydantic import BaseModel, Field


class SessionRegisterBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    device_install_id: str = Field(alias="deviceInstallId")
    display_name: str | None = Field(default=None, alias="displayName")
    gender: str | None = None
    focus_topics: list[str] | None = Field(default=None, alias="focusTopics")

    model_config = {"populate_by_name": True}


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

    model_config = {"populate_by_name": True}

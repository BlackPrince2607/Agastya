"""Push notification request/response schemas."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.utils.validators import _parse_uuid, validate_device_install_id


class RegisterPushTokenBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    device_install_id: str = Field(alias="deviceInstallId")
    expo_push_token: str = Field(alias="expoPushToken")
    platform: Literal["ios", "android"] | None = None
    timezone_offset_minutes: int | None = Field(default=None, alias="timezoneOffsetMinutes")

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

    @field_validator("expo_push_token")
    @classmethod
    def _token(cls, v: str) -> str:
        t = (v or "").strip()
        if not t or len(t) > 256:
            raise ValueError("expoPushToken invalid")
        return t


class UnregisterPushTokenBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    device_install_id: str = Field(alias="deviceInstallId")
    expo_push_token: str | None = Field(default=None, alias="expoPushToken")

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


class PushHeartbeatBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    device_install_id: str = Field(alias="deviceInstallId")
    expo_push_token: str | None = Field(default=None, alias="expoPushToken")
    timezone_offset_minutes: int | None = Field(default=None, alias="timezoneOffsetMinutes")

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


class PushEventBody(BaseModel):
    """Client-triggered product event (compatibility ready, payment pending, etc.)."""

    session_id: str = Field(alias="sessionId")
    device_install_id: str = Field(alias="deviceInstallId")
    event: Literal[
        "compatibility_ready",
        "payment_pending",
        "reading_ready",
        "full_report_ready",
        "premium_unlocked",
    ]
    event_key: str | None = Field(default=None, alias="eventKey")
    expo_push_token: str | None = Field(default=None, alias="expoPushToken")

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


class OkResponse(BaseModel):
    ok: bool = True
    sent: int | None = None

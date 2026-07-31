"""Palm analyze request."""

from pydantic import BaseModel, Field, field_validator

from app.utils.validators import _parse_uuid, normalize_gender, validate_device_install_id


class PalmAnalyzeBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    seed: str = Field(max_length=512)
    image_base64: str | None = Field(default=None, alias="imageBase64", max_length=6_000_000)
    device_install_id: str = Field(alias="deviceInstallId")
    dominant_hand: str | None = Field(default=None, alias="dominantHand")
    gender: str | None = Field(default=None, max_length=32)
    landmarks: list[list[float]] | None = Field(default=None, max_length=21)
    landmarks_source: str | None = Field(default=None, alias="landmarksSource")

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

    @field_validator("dominant_hand")
    @classmethod
    def _hand(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip().lower()
        if s in {"left", "right", "unknown"}:
            return s
        return "unknown"

    @field_validator("gender")
    @classmethod
    def _gender(cls, v: str | None) -> str | None:
        return normalize_gender(v)

    @field_validator("landmarks_source")
    @classmethod
    def _landmarks_source(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip().lower()
        return s if s in {"mediapipe", "roi_estimate"} else None

    @field_validator("landmarks")
    @classmethod
    def _landmarks(cls, v: list[list[float]] | None) -> list[list[float]] | None:
        if v is None:
            return None
        cleaned: list[list[float]] = []
        for pt in v[:21]:
            if len(pt) >= 2:
                cleaned.append([float(pt[0]), float(pt[1])])
        return cleaned or None

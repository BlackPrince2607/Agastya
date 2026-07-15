"""Palm landmark detection request/response."""

from pydantic import BaseModel, Field, field_validator


class PalmLandmarksBody(BaseModel):
    image_base64: str = Field(alias="imageBase64", max_length=6_000_000)
    dominant_hand: str | None = Field(default="right", alias="dominantHand")

    model_config = {"populate_by_name": True}

    @field_validator("dominant_hand")
    @classmethod
    def _hand(cls, v: str | None) -> str:
        if v is None:
            return "right"
        s = v.strip().lower()
        return s if s in {"left", "right"} else "right"


class PalmLandmarksResponse(BaseModel):
    landmarks: list[list[float]] | None = None
    source: str = "unavailable"

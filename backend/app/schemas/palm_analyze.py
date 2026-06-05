"""Palm analyze request."""

from pydantic import BaseModel, Field


class PalmAnalyzeBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    seed: str
    image_base64: str | None = Field(default=None, alias="imageBase64")

    model_config = {"populate_by_name": True}

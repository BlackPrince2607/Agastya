"""Palm analysis payload — matches PRD structured JSON."""

from typing import Literal

from pydantic import BaseModel, Field

LifeStrength = Literal["strong", "moderate", "subtle"]
LineCurve = Literal["straight", "curved", "broken"]
HeadLength = Literal["short", "medium", "long"]


class PalmAnalysis(BaseModel):
    life_line: LifeStrength | str = Field(description="Major arc motif")
    heart_line: LineCurve | str = Field(description="Attachment motif")
    head_line: HeadLength | str = Field(description="Intellect motif")
    personality: str = Field(description="Primary archetype label")
    traits: list[str] = Field(default_factory=list, min_length=1)

"""Palm analysis payload — matches PRD structured JSON."""

from typing import Any, Literal

from pydantic import BaseModel, Field

LifeStrength = Literal["strong", "moderate", "subtle"]
LineCurve = Literal["straight", "curved", "broken"]
HeadLength = Literal["short", "medium", "long"]
HandShape = Literal["earth", "air", "fire", "water", "mixed"]
ImageQuality = Literal["good", "acceptable", "poor", "no_hand"]
AnalysisSource = Literal["groq_vision", "hybrid", "dummy", "fallback"]
DominantHand = Literal["left", "right", "unknown"]
MountLevel = Literal["prominent", "moderate", "flat"]
FateLine = Literal["present", "absent", "partial"]


class LineDetail(BaseModel):
    length: str = "medium"
    depth: str = "moderate"
    breaks: int = 0
    notes: str = ""


class LineGeometryPoint(BaseModel):
    x: float
    y: float


class LineGeometry(BaseModel):
    name: str
    points: list[LineGeometryPoint] = Field(default_factory=list)


class MountsDetail(BaseModel):
    venus: MountLevel | str = "moderate"
    jupiter: MountLevel | str = "moderate"
    saturn: MountLevel | str = "moderate"
    sun: MountLevel | str = "moderate"
    mercury: MountLevel | str = "moderate"


class PalmAnalysis(BaseModel):
    life_line: LifeStrength | str = Field(description="Major arc motif")
    heart_line: LineCurve | str = Field(description="Attachment motif")
    head_line: HeadLength | str = Field(description="Intellect motif")
    personality: str = Field(description="Primary archetype label")
    traits: list[str] = Field(default_factory=list, min_length=1)
    dominant_hand: DominantHand | str = "unknown"
    hand_shape: HandShape | str = "mixed"
    image_quality: ImageQuality | str = "acceptable"
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    analysis_source: AnalysisSource | str = "dummy"
    quality_warnings: list[str] = Field(default_factory=list)
    line_details: dict[str, Any] | None = None
    mounts: dict[str, Any] | None = None
    fate_line: FateLine | str | None = None
    line_geometry: list[dict[str, Any]] | None = None

    model_config = {"extra": "ignore"}

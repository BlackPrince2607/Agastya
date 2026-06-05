"""Palm analysis pipeline — delegate here so routes stay thin.

Dummy mode ignores images and emits deterministic motifs from entropy.
Groq mode calls a vision language model when `GROQ_API_KEY` is set and a
base64 capture is supplied; otherwise it falls back to the dummy path.
"""

from app.config import Settings
from app.schemas.palm import PalmAnalysis
from app.schemas.palm_analyze import PalmAnalyzeBody
from app.services.palm_ai import palm_analysis_from_groq
from app.services.palm_dummy import dummy_palm_analysis


def _entropy_from_body(body: PalmAnalyzeBody) -> str:
    entropy = body.seed
    if body.image_base64:
        entropy = f"{body.seed}:{body.image_base64[-48:]}"
    return entropy


async def analyze_palm(settings: Settings, body: PalmAnalyzeBody) -> PalmAnalysis:
    entropy = _entropy_from_body(body)
    if settings.palm_analysis_mode == "dummy":
        return dummy_palm_analysis(entropy)
    img = body.image_base64
    if settings.groq_enabled and isinstance(img, str) and img.strip():
        inferred = await palm_analysis_from_groq(settings, image_base64=img.strip(), seed=body.seed)
        if inferred is not None:
            return inferred
    return dummy_palm_analysis(entropy)

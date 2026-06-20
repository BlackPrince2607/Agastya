"""Deterministic palm JSON — PRD v1 skips CV."""

import hashlib

from app.schemas.palm import PalmAnalysis


def dummy_palm_analysis(seed: str) -> PalmAnalysis:
    digest = hashlib.sha256(seed.encode()).hexdigest()
    life_opts = ["strong", "moderate", "subtle"]
    heart_opts = ["straight", "curved", "broken"]
    head_opts = ["short", "medium", "long"]
    personalities = ["quiet visionary", "magnetic empath", "strategic dreamer", "restless builder"]

    return PalmAnalysis(
        life_line=life_opts[int(digest[0:2], 16) % 3],
        heart_line=heart_opts[int(digest[2:4], 16) % 3],
        head_line=head_opts[int(digest[4:6], 16) % 3],
        personality=personalities[int(digest[6:8], 16) % len(personalities)],
        traits=["thoughtful", "resilient", "curious"],
        analysis_source="dummy",
        confidence=0.35,
        image_quality="acceptable",
    )

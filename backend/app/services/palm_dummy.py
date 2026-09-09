"""Deterministic palm JSON — PRD v1 skips CV."""

import hashlib

from app.schemas.palm import PalmAnalysis


def dummy_palm_analysis(seed: str) -> PalmAnalysis:
    digest = hashlib.sha256(seed.encode()).hexdigest()
    life_opts = ["strong", "moderate", "subtle"]
    heart_opts = ["straight", "curved", "broken"]
    head_opts = ["short", "medium", "long"]
    fate_opts = ["strong", "moderate", "faint", "broken", "absent"]
    sun_opts = ["strong", "moderate", "faint", "absent", "not_clearly_visible"]
    marriage_opts = ["clear", "multiple", "faint", "absent", "not_clearly_visible"]
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
        fate_line=fate_opts[int(digest[8:10], 16) % len(fate_opts)],
        sun_line=sun_opts[int(digest[10:12], 16) % len(sun_opts)],
        marriage_line=marriage_opts[int(digest[12:14], 16) % len(marriage_opts)],
        mounts={
            "venus": ["prominent", "moderate", "flat"][int(digest[14:16], 16) % 3],
            "jupiter": ["prominent", "moderate", "flat"][int(digest[16:18], 16) % 3],
            "saturn": "moderate",
            "sun": ["prominent", "moderate", "flat"][int(digest[18:20], 16) % 3],
            "mercury": "moderate",
        },
    )

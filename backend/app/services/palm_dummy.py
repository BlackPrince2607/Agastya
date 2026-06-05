"""Deterministic palm JSON — PRD v1 skips CV."""

import hashlib

from app.schemas.palm import PalmAnalysis


def dummy_palm_analysis(seed: str) -> PalmAnalysis:
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    life_opts = ["strong", "moderate", "subtle"]
    heart_opts = ["straight", "curved", "broken"]
    head_opts = ["short", "medium", "long"]
    personalities = ["visionary", "strategist", "empath", "alchemist"]
    trait_pool = [
        "independent",
        "overthinker",
        "loyal",
        "restless",
        "intuitive",
        "disciplined",
        "soft-hearted",
        "ambitious",
    ]

    def byte(i: int) -> int:
        return digest[i % len(digest)]

    traits: list[str] = []
    for idx in (1, 3, 7):
        traits.append(trait_pool[byte(idx) % len(trait_pool)])
    traits = list(dict.fromkeys(traits))
    while len(traits) < 2:
        traits.append(trait_pool[(byte(len(traits)) + 2) % len(trait_pool)])
        traits = list(dict.fromkeys(traits))

    return PalmAnalysis(
        life_line=life_opts[byte(0) % len(life_opts)],
        heart_line=heart_opts[byte(2) % len(heart_opts)],
        head_line=head_opts[byte(4) % len(head_opts)],
        personality=personalities[byte(5) % len(personalities)],
        traits=traits,
    )

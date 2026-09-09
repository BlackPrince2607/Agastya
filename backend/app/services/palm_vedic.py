"""Hasta Samudrika / bilingual Rekha catalog + interpretation dossier.

Builds structured evidence for report, predictions, and rituals so LLM copy
stays grounded in observed palm motifs (no invented marks).
"""

from __future__ import annotations

from typing import Any

from app.schemas.palm import PalmAnalysis

# English + Rekha labels (display / prompt)
REKHA_CATALOG: dict[str, dict[str, str]] = {
    "life_line": {
        "english": "Life Line",
        "rekha": "Jeevan Rekha",
        "bilingual": "Life Line · Jeevan Rekha",
        "pillar": "growth",
    },
    "heart_line": {
        "english": "Heart Line",
        "rekha": "Hridaya Rekha",
        "bilingual": "Heart Line · Hridaya Rekha",
        "pillar": "love",
    },
    "head_line": {
        "english": "Head Line",
        "rekha": "Mastishka Rekha",
        "bilingual": "Head Line · Mastishka Rekha",
        "pillar": "personality",
    },
    "fate_line": {
        "english": "Fate Line",
        "rekha": "Bhagya Rekha",
        "bilingual": "Fate Line · Bhagya Rekha",
        "pillar": "career",
    },
    "sun_line": {
        "english": "Sun Line",
        "rekha": "Surya Rekha",
        "bilingual": "Sun Line · Surya Rekha",
        "pillar": "money",
    },
    "marriage_line": {
        "english": "Marriage Line",
        "rekha": "Vivah Rekha",
        "bilingual": "Marriage Line · Vivah Rekha",
        "pillar": "love",
    },
}

MOUNT_DUAL: dict[str, str] = {
    "venus": "Venus · Shukra",
    "jupiter": "Jupiter · Guru",
    "saturn": "Saturn · Shani",
    "sun": "Sun · Surya",
    "mercury": "Mercury · Budh",
}

_UNCLEAR = {"not_clearly_visible", "unclear", "unknown", ""}

_LIFE_SNIPPETS = {
    "strong": "Traditionally associated with steady vitality and resilience through change.",
    "moderate": "Traditionally associated with balanced energy and paced renewal.",
    "subtle": "Traditionally associated with sensitivity and adaptive pacing.",
}
_HEART_SNIPPETS = {
    "curved": "Traditionally associated with warm, expressive emotional giving.",
    "straight": "Traditionally associated with clear, measured affection and honesty.",
    "broken": "Traditionally associated with layered emotional history and hard-won depth.",
}
_HEAD_SNIPPETS = {
    "long": "Traditionally associated with reflective, far-seeing thought.",
    "medium": "Traditionally associated with balancing logic and intuition.",
    "short": "Traditionally associated with decisive, focused judgment.",
}
_FATE_SNIPPETS = {
    "strong": "Traditionally associated with a clear sense of path and vocation.",
    "moderate": "Traditionally associated with a career path shaped by both effort and timing.",
    "faint": "Traditionally associated with a path that clarifies through experience rather than early certainty.",
    "broken": "Traditionally associated with chapters of redirection in work and purpose.",
    "present": "Traditionally associated with an active career/destiny thread.",
    "partial": "Traditionally associated with a destiny thread that strengthens over time.",
    "absent": "Not a fixed absence of purpose — traditionally read as a self-authored path.",
}
_SUN_SNIPPETS = {
    "strong": "Traditionally associated with recognition through skill and creative presence.",
    "moderate": "Traditionally associated with gradual visibility and earned regard.",
    "faint": "Traditionally associated with quieter success that grows with consistency.",
    "broken": "Traditionally associated with uneven recognition — effort may precede applause.",
    "present": "Traditionally associated with a thread of recognition and creative return.",
    "partial": "Traditionally associated with emerging recognition still taking shape.",
    "absent": "Traditionally read less as lack of talent and more as recognition arriving through persistence.",
}
_MARRIAGE_SNIPPETS = {
    "clear": "Traditionally associated with a clear partnership orientation when ready.",
    "multiple": "Traditionally associated with more than one significant bond chapter across life.",
    "faint": "Traditionally associated with selective, carefully paced intimacy.",
    "absent": "Traditionally read as partnership that may prioritize independence or arrive later — not a verdict.",
}


def _norm(value: object) -> str:
    return str(value or "").strip().lower()


def _is_unclear(value: object) -> bool:
    return _norm(value) in _UNCLEAR


def _is_absent_like(value: object) -> bool:
    return _norm(value) in {"absent", "not_clearly_visible"}


def _snippet_for(key: str, motif: str) -> str:
    tables = {
        "life_line": _LIFE_SNIPPETS,
        "heart_line": _HEART_SNIPPETS,
        "head_line": _HEAD_SNIPPETS,
        "fate_line": _FATE_SNIPPETS,
        "sun_line": _SUN_SNIPPETS,
        "marriage_line": _MARRIAGE_SNIPPETS,
    }
    table = tables.get(key, {})
    if _is_unclear(motif):
        return "Not clearly visible in the provided scan — do not invent features for this line."
    return table.get(_norm(motif), "Observed on the scan; interpret only from the stated motif.")


def _line_entry(key: str, motif: object, palm: PalmAnalysis) -> dict[str, Any]:
    meta = REKHA_CATALOG[key]
    motif_s = _norm(motif) or "not_clearly_visible"
    details = (palm.line_details or {}).get(key) if isinstance(palm.line_details, dict) else None
    features = (palm.line_features or {}).get(key) if isinstance(palm.line_features, dict) else None
    has_geom = False
    if palm.line_geometry:
        for item in palm.line_geometry:
            if isinstance(item, dict):
                name = str(item.get("name", "")).lower()
            else:
                name = str(getattr(item, "name", "")).lower()
            if name == key:
                has_geom = True
                break
    visible = (not _is_unclear(motif_s) and motif_s != "absent") or has_geom
    locked = has_geom or (visible and not _is_unclear(motif_s) and motif_s != "absent")
    return {
        "key": key,
        "english": meta["english"],
        "rekha": meta["rekha"],
        "label": meta["bilingual"],
        "motif": motif_s,
        "pillar": meta["pillar"],
        "visible": visible,
        "unclear": _is_unclear(motif_s) and not has_geom,
        "hasGeometry": has_geom,
        "locked": locked,
        "insight": _snippet_for(key, motif_s if locked else "not_clearly_visible"),
        "details": details if isinstance(details, dict) else None,
        "features": features if isinstance(features, dict) else None,
    }


def _mount_entries(palm: PalmAnalysis) -> list[dict[str, str]]:
    mounts = palm.mounts if isinstance(palm.mounts, dict) else {}
    out: list[dict[str, str]] = []
    for key, dual in MOUNT_DUAL.items():
        level = _norm(mounts.get(key))
        if not level:
            continue
        out.append({"key": key, "label": dual, "level": level})
    return out


def _hand_note(palm: PalmAnalysis, gender: str | None = None) -> str | None:
    hand = _norm(palm.dominant_hand)
    g = _norm(gender)
    if hand in {"left", "right"}:
        base = f"Reading from the {hand} palm."
        if g == "male" and hand == "right":
            return f"{base} Traditional male readings often use the right (active) hand."
        if g == "female" and hand == "left":
            return f"{base} Traditional female readings often use the left (receptive) hand."
        return base
    if g == "male":
        return "Traditional palmistry often emphasizes the right (active) hand for male readings."
    if g == "female":
        return "Traditional palmistry often emphasizes the left (receptive) hand for female readings."
    return None


def _pattern_themes(lines: dict[str, dict[str, Any]]) -> list[str]:
    """Synthesize 1–3 tensions from combined signals — story fuel, not line dumps."""
    themes: list[str] = []
    head = lines.get("head_line", {}).get("motif", "")
    heart = lines.get("heart_line", {}).get("motif", "")
    fate = lines.get("fate_line", {}).get("motif", "")
    life = lines.get("life_line", {}).get("motif", "")
    marriage = lines.get("marriage_line", {}).get("motif", "")
    sun = lines.get("sun_line", {}).get("motif", "")

    if head in {"long", "medium"} and heart in {"straight", "broken"}:
        themes.append("thinking vs emotional openness")
    if head == "short" and fate in {"strong", "moderate", "present"}:
        themes.append("decisive action vs the long arc of vocation")
    if heart == "curved" and marriage in {"faint", "absent", "not_clearly_visible"}:
        themes.append("warm feeling vs carefully paced commitment")
    if fate in {"broken", "faint", "absent", "not_clearly_visible"} and sun in {"strong", "moderate", "present"}:
        themes.append("self-authored path vs desire for recognition")
    if life == "strong" and head == "long":
        themes.append("endurance vs the need to stop reconsidering")
    if life == "subtle" and fate in {"strong", "present"}:
        themes.append("sensitive pacing vs ambitious direction")
    if not themes:
        themes.append("independence vs closeness")
    return themes[:3]


def _pillar_hints(lines: dict[str, dict[str, Any]]) -> dict[str, list[str]]:
    hints: dict[str, list[str]] = {
        "personality": [],
        "love": [],
        "career": [],
        "money": [],
        "growth": [],
    }
    for key, entry in lines.items():
        if not entry.get("locked"):
            continue
        if entry.get("unclear") or _is_absent_like(entry.get("motif")):
            # Still allow absent fate/sun as soft career/money hints when explicitly absent
            if key == "fate_line" and _norm(entry.get("motif")) == "absent":
                hints["career"].append(entry["label"])
            elif key == "sun_line" and _norm(entry.get("motif")) == "absent":
                hints["money"].append(entry["label"])
            continue
        pillar = entry.get("pillar")
        if pillar in hints:
            hints[pillar].append(entry["label"])
    # Cross-links
    if lines.get("head_line") and not lines["head_line"].get("unclear"):
        if "Head Line · Mastishka Rekha" not in hints["career"]:
            hints["career"].append(lines["head_line"]["label"])
    return hints


def build_palm_dossier(palm: PalmAnalysis, *, gender: str | None = None) -> dict[str, Any]:
    """Structured interpretive evidence for LLM grounding and offline fallbacks."""
    motifs = {
        "life_line": palm.life_line,
        "heart_line": palm.heart_line,
        "head_line": palm.head_line,
        "fate_line": palm.fate_line if palm.fate_line is not None else "not_clearly_visible",
        "sun_line": palm.sun_line if palm.sun_line is not None else "not_clearly_visible",
        "marriage_line": palm.marriage_line if palm.marriage_line is not None else "not_clearly_visible",
    }
    lines = {key: _line_entry(key, motif, palm) for key, motif in motifs.items()}
    mounts = _mount_entries(palm)
    return {
        "tradition": "bilingual_vedic_samudrik",
        "handNote": _hand_note(palm, gender),
        "handShape": _norm(palm.hand_shape) or "mixed",
        "personality": (palm.personality or "").strip(),
        "traits": list(palm.traits or [])[:5],
        "confidence": float(palm.confidence or 0.5),
        "geometrySource": palm.geometry_source,
        "lines": lines,
        "mounts": mounts,
        "patternThemes": _pattern_themes(lines),
        "pillarHints": _pillar_hints(lines),
        "lockedLines": [key for key, entry in lines.items() if entry.get("locked")],
        "disclaimer": (
            "Palmistry is a traditional cultural interpretation system, not scientifically validated "
            "prediction. Speak in tendencies and traditional associations — never as medical or "
            "guaranteed prophecy."
        ),
    }

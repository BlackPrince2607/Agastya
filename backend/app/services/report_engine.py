"""Deterministic + optional OpenRouter enrichment for dossier payloads."""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Literal

from app.config import Settings
from app.services.llm_client import llm_chat_completion
from app.prompts.templates import REPORT_SYSTEM
from app.schemas.palm import PalmAnalysis
from app.schemas.report import AuraProfile, FullReport, InsightSection, LifeMetrics
from app.services.palm_vedic import build_palm_dossier
from app.utils.ai_errors import log_ai_fallback
from app.utils.json_repair import loads_llm_json

logger = logging.getLogger(__name__)

PERSONALITY_MOTIFS = {
    "visionary": "visionary clarity",
    "seeker": "quiet seeking",
    "guardian": "steady protection",
    "empath": "warm intuition",
    "strategist": "measured insight",
    "healer": "gentle resilience",
    "builder": "grounded ambition",
}

LINE_MOTIFS = {
    "strong": "steady resilience",
    "moderate": "quiet balance",
    "subtle": "gentle adaptability",
    "curved": "warm intuition",
    "straight": "clear conviction",
    "broken": "layered depth",
    "long": "thoughtful vision",
    "medium": "balanced insight",
    "short": "decisive focus",
}

VISIONARY_SUBTITLES = {
    "visionary": "Architect of Quiet Intensity",
    "seeker": "Reader of Hidden Signs",
    "guardian": "Keeper of Steady Ground",
    "empath": "Voice of Warm Conviction",
    "strategist": "Mind That Maps the Quiet Path",
    "healer": "Gentle Force Behind the Surface",
    "builder": "Builder of Lasting Momentum",
}

LINE_DESCRIPTOR = {
    "life_line": {
        "strong": "strong & deep",
        "moderate": "steady",
        "subtle": "gentle",
    },
    "heart_line": {
        "curved": "warm",
        "straight": "clear",
        "broken": "complex",
    },
    "head_line": {
        "long": "thoughtful",
        "medium": "balanced",
        "short": "focused",
    },
}


def _palm_motif(palm: PalmAnalysis) -> str:
    persona = (palm.personality or "").strip().lower()
    if persona in PERSONALITY_MOTIFS:
        return PERSONALITY_MOTIFS[persona]
    heart = (palm.heart_line or "").strip().lower()
    life = (palm.life_line or "").strip().lower()
    head = (palm.head_line or "").strip().lower()
    return LINE_MOTIFS.get(heart) or LINE_MOTIFS.get(life) or LINE_MOTIFS.get(head) or "quiet purpose"


def _visionary_title(palm: PalmAnalysis) -> str:
    persona = (palm.personality or "seeker").strip().title() or "Seeker"
    return f"The {persona}"


def _visionary_subtitle(palm: PalmAnalysis) -> str:
    persona = (palm.personality or "").strip().lower()
    return VISIONARY_SUBTITLES.get(persona, "Reader of Your Inner Lines")


def _archetype_line(palm: PalmAnalysis, gender_frag: str, dossier: dict | None = None) -> str:
    life_desc = LINE_DESCRIPTOR["life_line"].get((palm.life_line or "").lower(), "steady")
    heart_desc = LINE_DESCRIPTOR["heart_line"].get((palm.heart_line or "").lower(), "warm")
    traits = " and ".join(palm.traits[:2]) if palm.traits else "depth and intuition"
    hand = (palm.dominant_hand or "").lower()
    hand_frag = f"Read from your {hand} palm, " if hand in {"left", "right"} else ""
    feat = palm.line_features or {}
    feature_frag = ""
    if feat:
        bits = []
        life_f = feat.get("life_line") if isinstance(feat.get("life_line"), dict) else None
        heart_f = feat.get("heart_line") if isinstance(feat.get("heart_line"), dict) else None
        if life_f and life_f.get("depth"):
            bits.append(f"{life_f['depth']} life crease (Jeevan Rekha)")
        if heart_f and heart_f.get("breaks", 0):
            bits.append("interrupted heart crease (Hridaya Rekha)")
        if bits:
            feature_frag = f" Measured on your scan: {', '.join(bits)}. "
    themes = (dossier or {}).get("patternThemes") or []
    theme_frag = ""
    if themes:
        theme_frag = f" The strongest tension in your palm is {themes[0]}."
    return (
        f"{gender_frag}{hand_frag}your {life_desc} Life Line · Jeevan Rekha and {heart_desc} "
        f"Heart Line · Hridaya Rekha suggest someone {traits}.{feature_frag}"
        f"{theme_frag} You take things in quietly and speak up only when it truly matters."
    )


def _section_from_dossier(
    section_id: str,
    title: str,
    palm: PalmAnalysis,
    dossier: dict,
    name_hint: str,
) -> InsightSection:
    lines = dossier.get("lines") or {}
    themes = dossier.get("patternThemes") or ["independence vs closeness"]
    theme = themes[0]
    hints = (dossier.get("pillarHints") or {}).get(
        "personality" if section_id == "personality" else section_id, []
    )
    hint_frag = ", ".join(hints[:2]) if hints else "your major creases"

    if section_id == "personality":
        head = lines.get("head_line") or {}
        life = lines.get("life_line") or {}
        body = (
            f"{name_hint}, what stands out first is not a single crease but the relationship between "
            f"your {head.get('label', 'Head Line · Mastishka Rekha')} ({head.get('motif', 'medium')}) "
            f"and your {life.get('label', 'Life Line · Jeevan Rekha')} ({life.get('motif', 'moderate')}). "
            f"{head.get('insight', '')} {life.get('insight', '')}\n\n"
            f"The pattern of {theme} keeps showing up in how you think and how you pace yourself. "
            f"Your challenge may not be lacking direction — it may be wanting certainty before you allow yourself to move."
        )
    elif section_id == "love":
        heart = lines.get("heart_line") or {}
        marriage = lines.get("marriage_line") or {}
        marriage_bit = ""
        if marriage.get("unclear") or marriage.get("motif") in {"not_clearly_visible", "absent"}:
            marriage_bit = (
                "Your Marriage Line · Vivah Rekha is not clearly marked in this scan — "
                "traditional palmistry would not invent a partnership timeline here."
            )
        else:
            marriage_bit = (
                f"Your {marriage.get('label', 'Marriage Line')} reads {marriage.get('motif')}. "
                f"{marriage.get('insight', '')}"
            )
        body = (
            f"Affection in your palm is told through {heart.get('label', 'Heart Line · Hridaya Rekha')} "
            f"({heart.get('motif', 'curved')}). {heart.get('insight', '')} "
            f"You may not give trust quickly, but once someone has earned it, you tend to take the bond seriously.\n\n"
            f"{marriage_bit} The emotional thread of {theme} can make closeness feel both necessary and carefully paced."
        )
    elif section_id == "career":
        head = lines.get("head_line") or {}
        fate = lines.get("fate_line") or {}
        fate_bit = fate.get("insight", "")
        body = (
            f"Your professional story sits between {head.get('label', 'Head Line · Mastishka Rekha')} "
            f"({head.get('motif', 'medium')}) and {fate.get('label', 'Fate Line · Bhagya Rekha')} "
            f"({fate.get('motif', 'not_clearly_visible')}). {fate_bit} "
            f"Traditional palmistry would read this less as a single job title and more as the kind of environment "
            f"where you thrive — ownership, clarity, and work that feels like it belongs to you.\n\n"
            f"What could hold you back is the same pattern of {theme}: waiting for perfect certainty "
            f"before claiming the path you're already walking."
        )
    else:  # money
        sun = lines.get("sun_line") or {}
        body = (
            f"Material life in your palm leans on {sun.get('label', 'Sun Line · Surya Rekha')} "
            f"({sun.get('motif', 'not_clearly_visible')}) and the mounts that support recognition. "
            f"{sun.get('insight', '')} Your palm is traditionally more compatible with wealth built through "
            f"skill and persistence than sudden luck.\n\n"
            f"Signals from {hint_frag} suggest naming fear early and letting small discipline compound — "
            f"not chasing dramatic windfalls."
        )

    return InsightSection(id=section_id, title=title, body=body.strip(), tone="grounded")


def _digits(seed: str) -> list[int]:
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    return list(digest)


def _span(n: int, lo: int, hi: int) -> int:
    return lo + (n % (hi - lo + 1))


def _clamp_metric(n: float | int, key: str | None = None) -> int:
    """Affirming band with per-pillar floors so scores stay visually distinct."""
    bands = {
        "love": (54, 94),
        "career": (58, 97),
        "money": (48, 88),
        "growth": (56, 95),
    }
    lo, hi = bands.get(key or "", (48, 97))
    try:
        value = float(n)
    except (TypeError, ValueError):
        value = 72.0
    if 0 < value <= 1:
        value *= 100
    return max(lo, min(hi, int(round(value))))


def _differentiate_metrics(data: dict[str, int]) -> dict[str, int]:
    """Stretch flat score sets and avoid identical percentages across pillars."""
    keys = ["love", "career", "money", "growth"]
    values = [data[k] for k in keys]
    lo, hi = min(values), max(values)
    spread = hi - lo
    centers = {"love": 74, "career": 86, "money": 62, "growth": 80}
    out = dict(data)
    if spread < 16:
        mean = sum(values) / len(values) if values else 72.0
        scale = 16 / max(spread, 1)
        for key in keys:
            relative = (data[key] - mean) * scale
            toward = (centers[key] - mean) * 0.35
            out[key] = _clamp_metric(mean + relative + toward, key)

    used: set[int] = set()
    for key in keys:
        v = out[key]
        guard = 0
        while v in used and guard < 12:
            step = (guard // 2) + 1
            v = v + (step if guard % 2 == 0 else -step)
            v = _clamp_metric(v, key)
            guard += 1
        used.add(v)
        out[key] = v
    return out


def _metrics(seed: str, topics: list[str]) -> LifeMetrics:
    digs = _digits(seed)
    # Distinct centers: career tends high, money more moderate — reads as a real profile.
    base = LifeMetrics(
        love=_span(digs[0], 54, 94),
        career=_span(digs[1], 58, 97),
        money=_span(digs[2], 48, 88),
        growth=_span(digs[3], 56, 95),
    )
    topic_map = {
        "love": "love",
        "career": "career",
        "money": "money",
        "growth": "growth",
        "matching": "love",
    }
    data = base.model_dump()
    for topic in topics:
        key = topic_map.get(topic)
        if key:
            data[key] = min(97, data[key] + 9)
    data = _differentiate_metrics({k: _clamp_metric(v, k) for k, v in data.items()})
    return LifeMetrics(**data)


def _aura_palette(seed: str) -> AuraProfile:
    digs = _digits(seed)
    palettes = [
        ["#7c3aed", "#a855f7", "#06b6d4", "#2dd4bf"],
        ["#db2777", "#9333ea", "#38bdf8", "#818cf8"],
        ["#0891b2", "#6366f1", "#e879f9", "#fde047"],
    ]
    names = ["Crystalline Violet", "Nebula Rose", "Aurora Meridian"]
    idx = _span(digs[4], 0, len(palettes) - 1)
    return AuraProfile(label=names[idx], gradient=palettes[idx])


def deterministic_report(
    *,
    seed: str,
    palm: PalmAnalysis,
    topics: list[str],
    mode: Literal["preview", "full"],
    display_name: str | None,
    gender: str | None,
) -> FullReport:
    dossier = build_palm_dossier(palm, gender=gender)
    motif = _palm_motif(palm)
    name_hint = display_name or "friend"
    themes = dossier.get("patternThemes") or [motif]
    theme = themes[0]

    sections_all = [
        _section_from_dossier("personality", "Personality", palm, dossier, name_hint),
        _section_from_dossier("love", "Love", palm, dossier, name_hint),
        _section_from_dossier("career", "Career", palm, dossier, name_hint),
        _section_from_dossier("money", "Money", palm, dossier, name_hint),
    ]
    sections = sections_all[:2] if mode == "preview" else sections_all

    metrics = _metrics(seed, topics)
    aura = _aura_palette(seed)

    gender_frag = ""
    if gender == "male":
        gender_frag = "Read for a masculine presence. "
    elif gender == "female":
        gender_frag = "Read for a feminine presence. "

    return FullReport(
        blueprint_title="Your Life Blueprint",
        visionary_title=_visionary_title(palm),
        visionary_subtitle=_visionary_subtitle(palm),
        archetype_line=_archetype_line(palm, gender_frag, dossier),
        headline=f"There is an interesting tension running through your palm — {theme}.",
        sections=sections,
        bold_prediction=(
            f"The coming chapter appears more favorable for noticing where {theme} shows up in real choices "
            f"than for waiting until every answer is certain. You don't need the whole map — "
            f"your palm suggests your biggest shifts come from choosing a direction and following it."
        ),
        metrics=metrics,
        aura=aura,
        palm_analysis=palm,
        source="fallback",
    )


async def build_report_payload(
    settings: Settings,
    *,
    seed: str,
    palm: PalmAnalysis,
    topics: list[str],
    mode: Literal["preview", "full"],
    display_name: str | None,
    gender: str | None,
    life_journey: list[str] | None = None,
    temporary_context: list[str] | None = None,
    recent_chapters: list[dict] | None = None,
    current_chapter: str | None = None,
) -> FullReport:
    """Return enriched report JSON, falling back if OpenRouter unavailable or errors."""
    fallback = deterministic_report(
        seed=seed, palm=palm, topics=topics, mode=mode, display_name=display_name, gender=gender
    )
    if not settings.llm_enabled:
        return fallback
    dossier = build_palm_dossier(palm, gender=gender)
    payload: dict = {
        "seed": seed,
        "mode": mode,
        "displayName": display_name,
        "gender": gender,
        "focusTopics": topics,
        "palm": palm.model_dump(),
        "palmDossier": dossier,
    }
    if life_journey:
        payload["lifeJourney"] = life_journey[:5]
    if temporary_context:
        payload["temporaryContext"] = temporary_context[:6]
    if recent_chapters:
        payload["recentChapters"] = recent_chapters[:4]
    if current_chapter:
        payload["currentChapter"] = current_chapter
    try:
        completion = await llm_chat_completion(
            settings,
            model=settings.openrouter_chat_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": REPORT_SYSTEM},
                {"role": "user", "content": json.dumps(payload)},
            ],
            temperature=0.6,
            max_tokens=2800 if mode == "full" else 1400,
            feature="report",
        )
        if completion is None:
            log_ai_fallback("report", "no_completion", llm_enabled=settings.llm_enabled)
            return fallback
        raw = completion.choices[0].message.content or ""
        data = loads_llm_json(raw, feature="report")
        report = FullReport.model_validate(data)
        # Normalize LLM metrics into distinct per-pillar bands (fractions / flat sets).
        m = report.metrics
        differentiated = _differentiate_metrics(
            {
                "love": _clamp_metric(m.love, "love"),
                "career": _clamp_metric(m.career, "career"),
                "money": _clamp_metric(m.money, "money"),
                "growth": _clamp_metric(m.growth, "growth"),
            }
        )
        report = report.model_copy(update={"metrics": LifeMetrics(**differentiated)})
        if mode == "preview":
            report = report.model_copy(update={"sections": report.sections[:2]})
        # ensure palm echoes request
        report = report.model_copy(update={"palm_analysis": palm, "source": "llm"})
        return report
    except Exception as exc:
        log_ai_fallback("report", "parse_error", error_type=type(exc).__name__)
        return fallback

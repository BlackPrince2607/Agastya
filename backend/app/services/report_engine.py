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


def _archetype_line(palm: PalmAnalysis, gender_frag: str) -> str:
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
            bits.append(f"{life_f['depth']} life crease")
        if heart_f and heart_f.get("breaks", 0):
            bits.append("interrupted heart crease")
        if bits:
            feature_frag = f" Measured on your scan: {', '.join(bits)}. "
    return (
        f"{gender_frag}{hand_frag}your {life_desc} life line and {heart_desc} heart line suggest someone "
        f"{traits}.{feature_frag} You take things in quietly and speak up only when it truly matters."
    )


def _self_section_body(palm: PalmAnalysis) -> str:
    motif = _palm_motif(palm)
    head_desc = LINE_DESCRIPTOR["head_line"].get((palm.head_line or "").lower(), "balanced")
    return (
        "You turn overwhelm into plans. Sometimes that protects you; sometimes it keeps people at arm's length. "
        f"Your {head_desc} mind and the pattern of {motif} keep surfacing whenever you put off being direct."
    )


def _digits(seed: str) -> list[int]:
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    return list(digest)


def _span(n: int, lo: int, hi: int) -> int:
    return lo + (n % (hi - lo + 1))


def _clamp_metric(n: float | int) -> int:
    """Keep life scores in an affirming mid–high band (handles LLM 0–1 quirks)."""
    try:
        value = float(n)
    except (TypeError, ValueError):
        value = 72.0
    if 0 < value <= 1:
        value *= 100
    return max(58, min(96, int(round(value))))


def _metrics(seed: str, topics: list[str]) -> LifeMetrics:
    digs = _digits(seed)
    base = LifeMetrics(
        love=_span(digs[0], 64, 90),
        career=_span(digs[1], 66, 93),
        money=_span(digs[2], 60, 88),
        growth=_span(digs[3], 65, 92),
    )
    topic_map = {"love": "love", "career": "career", "money": "money", "growth": "growth", "matching": "love"}
    data = base.model_dump()
    for topic in topics:
        key = topic_map.get(topic)
        if key:
            data[key] = min(96, round(data[key] * 1.06))
    return LifeMetrics(**{k: _clamp_metric(v) for k, v in data.items()})


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
    motif = _palm_motif(palm)
    traits_join = ", ".join(palm.traits)
    name_hint = display_name or "traveler"

    sections_all = [
        InsightSection(
            id="personality",
            title="Personality",
            body=(
                f"{name_hint}, your palm reads like {palm.personality} energy—traits "
                f"({traits_join}) braid discipline with longing. "
                f"The pattern of {motif} surfaces whenever you dodge naming desire aloud."
            ),
        ),
        InsightSection(
            id="love",
            title="Love",
            body=(
                "Attachment learns your choreography early—you signal affection Sideways "
                "until evidence piles up; someone patient earns the backstage version."
            ),
        ),
        InsightSection(
            id="career",
            title="Career",
            body=(
                "Momentum arrives when stakes feel mythic, not merely productive. "
                "Ambition hides behind refinement until deadlines sharpen."
            ),
        ),
        InsightSection(
            id="money",
            title="Money",
            body=(
                "Resources trade between spreadsheets and phantom bills. "
                "Naming the fear collapses half the tension—action handles the rest."
            ),
        ),
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
        archetype_line=_archetype_line(palm, gender_frag),
        headline=f'The pattern "{motif}" runs quietly through the way you move.',
        sections=sections,
        bold_prediction=(
            "Within forty quiet turns, a signal you shrugged off as coincidence knocks louder—"
            "until you redraw one boundary you pretended was permanent."
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
    payload: dict = {
        "seed": seed,
        "mode": mode,
        "displayName": display_name,
        "gender": gender,
        "focusTopics": topics,
        "palm": palm.model_dump(),
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
            max_tokens=1200,
            feature="report",
        )
        if completion is None:
            log_ai_fallback("report", "no_completion", llm_enabled=settings.llm_enabled)
            return fallback
        raw = completion.choices[0].message.content or ""
        data = loads_llm_json(raw, feature="report")
        report = FullReport.model_validate(data)
        # Normalize LLM metrics into the display band (fractions / tiny scores → 58–96).
        m = report.metrics
        report = report.model_copy(
            update={
                "metrics": LifeMetrics(
                    love=_clamp_metric(m.love),
                    career=_clamp_metric(m.career),
                    money=_clamp_metric(m.money),
                    growth=_clamp_metric(m.growth),
                )
            }
        )
        if mode == "preview":
            report = report.model_copy(update={"sections": report.sections[:2]})
        # ensure palm echoes request
        report = report.model_copy(update={"palm_analysis": palm, "source": "llm"})
        return report
    except Exception as exc:
        log_ai_fallback("report", "parse_error", error_type=type(exc).__name__)
        return fallback

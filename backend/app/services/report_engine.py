"""Deterministic + optional Groq enrichment for dossier payloads."""

from __future__ import annotations

import hashlib
import json
from typing import Literal

from app.config import Settings
from app.services.llm_client import groq_client
from app.prompts.templates import REPORT_SYSTEM
from app.schemas.palm import PalmAnalysis
from app.schemas.report import AuraProfile, FullReport, InsightSection, LifeMetrics


def _digits(seed: str) -> list[int]:
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    return list(digest)


def _span(n: int, lo: int, hi: int) -> int:
    return lo + (n % (hi - lo + 1))


def _metrics(seed: str, topics: list[str]) -> LifeMetrics:
    digs = _digits(seed)
    base = LifeMetrics(
        love=_span(digs[0], 52, 86),
        career=_span(digs[1], 58, 92),
        money=_span(digs[2], 40, 78),
        growth=_span(digs[3], 55, 90),
    )
    topic_map = {"love": "love", "career": "career", "money": "money", "growth": "growth"}
    data = base.model_dump()
    for topic in topics:
        key = topic_map.get(topic)
        if key:
            data[key] = min(95, round(data[key] * 1.08))
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
    condensed = seed[:32].strip() or "stillness"
    traits_join = ", ".join(palm.traits)
    name_hint = display_name or "traveler"

    sections_all = [
        InsightSection(
            id="personality",
            title="Personality",
            body=(
                f"{name_hint}, your palm reads like {palm.personality} voltage—traits "
                f"({traits_join}) braid discipline with longing. "
                f"The motif “{condensed}” surfaces whenever you dodge naming desire aloud."
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

    gender_frag = f"Identity note: {gender}. " if gender else ""

    return FullReport(
        blueprint_title="Your Life Blueprint",
        visionary_title=palm.personality.title() if palm.personality else "The Seeker",
        visionary_subtitle="Architect of Quiet Intensity",
        archetype_line=(
            f"{gender_frag}Lines say {palm.life_line} life, {palm.heart_line} heart, "
            f"{palm.head_line} head—a triad tuned to decisive reinvention."
        ),
        headline=f"The constellation “{condensed}” hums beside your pacing.",
        sections=sections,
        bold_prediction=(
            "Within forty quiet turns, a signal you shrugged off as coincidence knocks louder—"
            "until you redraw one boundary you pretended was permanent."
        ),
        metrics=metrics,
        aura=aura,
        palm_analysis=palm,
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
) -> FullReport:
    """Return enriched report JSON, falling back if Groq unavailable or errors."""
    fallback = deterministic_report(
        seed=seed, palm=palm, topics=topics, mode=mode, display_name=display_name, gender=gender
    )
    client = groq_client(settings)
    if client is None:
        return fallback
    payload = {
        "seed": seed,
        "mode": mode,
        "displayName": display_name,
        "gender": gender,
        "focusTopics": topics,
        "palm": palm.model_dump(),
    }
    try:
        completion = await client.chat.completions.create(
            model=settings.groq_chat_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": REPORT_SYSTEM},
                {
                    "role": "user",
                    "content": json.dumps(payload),
                },
            ],
            temperature=0.85,
        )
        raw = completion.choices[0].message.content or ""
        data = json.loads(raw)
        report = FullReport.model_validate(data)
        if mode == "preview":
            report = report.model_copy(update={"sections": report.sections[:2]})
        # ensure palm echoes request
        report = report.model_copy(update={"palm_analysis": palm})
        return report
    except Exception:
        return fallback

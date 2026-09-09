"""Deterministic + optional OpenRouter enrichment for period predictions."""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone

from app.config import Settings
from app.prompts.templates import PREDICTIONS_SYSTEM
from app.schemas.palm import PalmAnalysis
from app.schemas.predictions import PredictionBeat, PredictionItem, PredictionsResponse
from app.services.llm_client import llm_chat_completion
from app.services.palm_vedic import build_palm_dossier
from app.utils.ai_errors import log_ai_fallback
from app.utils.json_repair import loads_llm_json

logger = logging.getLogger(__name__)

_PERIOD_WINDOW = {
    "month": "this month",
    "3month": "the next three months",
    "year": "the year ahead",
}

_CATEGORIES = ["career", "love", "money", "growth"]


def _digits(seed: str) -> list[int]:
    return list(hashlib.sha256(seed.encode("utf-8")).digest())


def _span(n: int, lo: int, hi: int) -> int:
    return lo + (n % (hi - lo + 1))


def _line_motif(dossier: dict, key: str) -> tuple[str, str]:
    entry = (dossier.get("lines") or {}).get(key) or {}
    label = str(entry.get("label") or key)
    motif = str(entry.get("motif") or "not_clearly_visible")
    return label, motif


_PERIOD_BEATS = {
    "month": ("This week", "Mid-month", "Closing days"),
    "3month": ("Weeks 1–4", "Weeks 5–8", "Weeks 9–12"),
    "year": ("Q1", "Q2", "Q3", "Q4"),
}


def _line_locked(dossier: dict, key: str) -> bool:
    entry = (dossier.get("lines") or {}).get(key) or {}
    return bool(entry.get("locked") or entry.get("hasGeometry"))


def _cite_or_theme(dossier: dict, key: str, theme: str) -> str:
    if _line_locked(dossier, key):
        label, motif = _line_motif(dossier, key)
        return f"your {label} ({motif})"
    return f"the pattern of {theme}"


def deterministic_predictions(
    *,
    seed: str,
    period: str,
    palm: PalmAnalysis | None = None,
) -> PredictionsResponse:
    window = _PERIOD_WINDOW.get(period, "soon")
    digs = _digits(f"{seed}:{period}")
    dossier = build_palm_dossier(palm) if palm else {"patternThemes": ["independence vs closeness"], "lines": {}}
    themes = dossier.get("patternThemes") or ["independence vs closeness"]
    theme = themes[0]
    career_cite = _cite_or_theme(dossier, "fate_line", theme)
    love_cite = _cite_or_theme(dossier, "heart_line", theme)
    money_cite = _cite_or_theme(dossier, "sun_line", theme)
    growth_cite = _cite_or_theme(dossier, "life_line", theme)
    beat_labels = _PERIOD_BEATS.get(period, _PERIOD_BEATS["month"])

    templates = {
        "career": (
            "Path comes into focus",
            f"{window.capitalize()}, {career_cite} asks for ownership over waiting. "
            f"The pattern of {theme} may show up as a choice between certainty and momentum — "
            f"pick one lane before you need a perfect map. Progress will feel quieter than dramatic, "
            f"but more durable if you claim it.",
            f"Work wants a clearer claim {window}. {career_cite.capitalize()} traditionally favors "
            f"choosing a direction before every answer is certain — not rushing, but stopping the stall. "
            f"Notice where {theme} makes you wait for permission you already have. "
            f"One visible commitment beats three half-started plans; name the next concrete step and protect time for it. "
            f"If doubt arrives mid-period, treat it as a signal to simplify scope, not abandon the path. "
            f"Talk to one person who can unblock you rather than rehearsing the whole plan alone. "
            f"Keep a short weekly check: what moved, what stalled, what you will try once. "
            f"The palm tone here is steady ambition — paced, not performative.",
        ),
        "love": (
            "Honesty softens the edge",
            f"Clarity in connection matters {window}. {love_cite.capitalize()} suggests "
            f"saying what you mean without forcing a timeline. Warmth lands better when it is specific — "
            f"one true sentence over a performance of certainty. The period favors repair and naming over guessing.",
            f"Closeness {window} is less about a grand gesture and more about one honest sentence. "
            f"{love_cite.capitalize()} traditionally reads as paced trust — warmth that does not rush a verdict. "
            f"Where {theme} appears, name it instead of withdrawing. Ask one clear question, listen without rewriting their answer, "
            f"and notice whether your body softens or braces. Repair is often quieter than romance — "
            f"a check-in, an apology, a boundary spoken kindly. If you feel the urge to test someone, pause and state the need underneath the test. "
            f"Give the connection room to respond without scoring it as a final answer. Soft honesty is the skill this window is teaching.",
        ),
        "money": (
            "Skill over sudden luck",
            f"Finances find rhythm {window}. {money_cite.capitalize()} traditionally favors "
            f"persistence and visible craft more than windfalls. Small discipline compounds faster than a dramatic reset. "
            f"Treat money as a craft you can practice, not a mood.",
            f"Material life {window} compounds through one visible skill, not a lucky break. "
            f"{money_cite.capitalize()} is traditionally more compatible with craft you can point to — "
            f"a deliverable, a rate you can defend, a habit that shows up weekly. "
            f"Let small discipline sit next to {theme} instead of chasing a dramatic reset. "
            f"Track one inflow and one outflow with honesty; trim the noise that pretends to be strategy. "
            f"Abundance here looks like steadiness you can feel in your calendar, not a lottery ticket. "
            f"If envy flares, translate it into one skill gap you can practice. "
            f"Protect a quiet money hour each week — review, adjust, then stop.",
        ),
        "growth": (
            "A pattern becomes visible",
            f"You may notice {theme} more clearly {window}. {growth_cite.capitalize()} "
            f"supports pacing change without abandoning yourself. Watch the pattern without turning it into a verdict. "
            f"Growth arrives as accuracy, not intensity.",
            f"{window.capitalize()} is a good window to watch {theme} without turning it into a verdict. "
            f"{growth_cite.capitalize()} traditionally supports change that keeps your pacing intact. "
            f"One honest adjustment beats a total reinvention: a bedtime, a boundary, a practice you return to when the mind races. "
            f"When old habits flare, treat them as data — what were you protecting? "
            f"Growth here is not louder effort; it is kinder accuracy about what actually restores you. "
            f"Write one sentence about the pattern when it appears, then choose a 2% response. "
            f"Ask for support in one specific way instead of carrying the whole shift alone. "
            f"Let the period teach you steadiness more than spectacle.",
        ),
    }

    beat_copy = {
        "career": (
            lambda label: f"{label}: choose one ownership move in work — a decision, a send, or a calendar block — "
            "and complete it before expanding scope. Notice where waiting for certainty is costing momentum."
        ),
        "love": (
            lambda label: f"{label}: offer one clear sentence of honesty. Listen for the reply without planning "
            "the next three moves, and notice if your body softens or braces."
        ),
        "money": (
            lambda label: f"{label}: advance one visible craft or money habit — a rate, a deliverable, "
            "or a simple tracking check. Keep it small enough to finish the same day."
        ),
        "growth": (
            lambda label: f"{label}: notice {theme} once without fixing it. Then make one small adjustment "
            "that protects your pacing, and write what you learned in a single line."
        ),
    }

    items: list[PredictionItem] = []
    for i, category in enumerate(_CATEGORIES):
        headline, detail, insight = templates[category]
        beats = [
            PredictionBeat(
                label=label,
                text=beat_copy[category](label),
            )
            for label in beat_labels
        ]
        items.append(
            PredictionItem(
                category=category,  # type: ignore[arg-type]
                headline=headline,
                detail=detail,
                insight=insight,
                beats=beats,
                score=_span(digs[i], 68, 94),
            )
        )
    return PredictionsResponse(
        period=period,  # type: ignore[arg-type]
        items=items,
        generated_at=datetime.now(timezone.utc).isoformat(),
        source="fallback",
    )


async def build_predictions_payload(
    settings: Settings,
    *,
    seed: str,
    period: str,
    palm: PalmAnalysis,
    topics: list[str],
) -> PredictionsResponse:
    fallback = deterministic_predictions(seed=seed, period=period, palm=palm)
    dossier = build_palm_dossier(palm)

    payload = {
        "period": period,
        "focusTopics": topics,
        "palm": palm.model_dump(),
        "palmDossier": dossier,
    }
    try:
        completion = await llm_chat_completion(
            settings,
            model=settings.openrouter_chat_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": PREDICTIONS_SYSTEM},
                {"role": "user", "content": json.dumps(payload)},
            ],
            temperature=0.65,
            max_tokens=3600,
            feature="predictions",
        )
        if completion is None:
            log_ai_fallback("predictions", "no_completion", llm_enabled=settings.llm_enabled)
            return fallback
        raw = completion.choices[0].message.content or "{}"
        data = loads_llm_json(raw, feature="predictions")
        items_raw = data.get("items") or []
        if len(items_raw) < 4:
            log_ai_fallback("predictions", "insufficient_count")
            return fallback
        items = [PredictionItem.model_validate(it) for it in items_raw[:4]]
        if not all(it.insight for it in items):
            for idx, it in enumerate(items):
                if not it.insight:
                    items[idx] = it.model_copy(update={"insight": fallback.items[idx].insight})
                if not it.beats:
                    items[idx] = items[idx].model_copy(update={"beats": fallback.items[idx].beats})
        return PredictionsResponse(
            period=period,  # type: ignore[arg-type]
            items=items,
            generated_at=datetime.now(timezone.utc).isoformat(),
            source="llm",
        )
    except Exception as exc:
        log_ai_fallback("predictions", "parse_error", error_type=type(exc).__name__)
        return fallback

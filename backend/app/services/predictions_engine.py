"""Deterministic + optional Groq enrichment for period predictions."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from app.config import Settings
from app.prompts.templates import PREDICTIONS_SYSTEM
from app.schemas.palm import PalmAnalysis
from app.schemas.predictions import PredictionItem, PredictionsResponse

_PERIOD_WINDOW = {
    "month": "this month",
    "3month": "the next three months",
    "year": "the year ahead",
}

_CATEGORIES = ["career", "love", "money", "growth"]

_TEMPLATES: dict[str, tuple[str, str]] = {
    "career": ("An unexpected opening", "A door you didn't plan for opens {w}. Say yes before you feel fully ready."),
    "love": ("A meaningful conversation", "Clarity comes through honesty {w}. The right words land softer than expected."),
    "money": ("Steady abundance", "Your finances find rhythm {w}. A small discipline compounds into real ease."),
    "growth": ("A pattern breaks", "You outgrow an old loop {w}. Notice what no longer fits and let it go."),
}


def _digits(seed: str) -> list[int]:
    return list(hashlib.sha256(seed.encode("utf-8")).digest())


def _span(n: int, lo: int, hi: int) -> int:
    return lo + (n % (hi - lo + 1))


def deterministic_predictions(*, seed: str, period: str) -> PredictionsResponse:
    window = _PERIOD_WINDOW.get(period, "soon")
    digs = _digits(f"{seed}:{period}")
    items: list[PredictionItem] = []
    for i, category in enumerate(_CATEGORIES):
        headline, detail = _TEMPLATES[category]
        items.append(
            PredictionItem(
                category=category,  # type: ignore[arg-type]
                headline=headline,
                detail=detail.format(w=window),
                score=_span(digs[i], 68, 94),
            )
        )
    return PredictionsResponse(
        period=period,  # type: ignore[arg-type]
        items=items,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


async def build_predictions_payload(
    settings: Settings,
    *,
    seed: str,
    period: str,
    palm: PalmAnalysis,
    topics: list[str],
) -> PredictionsResponse:
    from app.services.llm_client import groq_client

    fallback = deterministic_predictions(seed=seed, period=period)
    client = groq_client(settings)
    if client is None:
        return fallback

    payload = {
        "period": period,
        "focusTopics": topics,
        "palm": palm.model_dump(),
    }
    try:
        completion = await client.chat.completions.create(
            model=settings.groq_chat_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": PREDICTIONS_SYSTEM},
                {"role": "user", "content": json.dumps(payload)},
            ],
            temperature=0.85,
        )
        raw = completion.choices[0].message.content or "{}"
        data = json.loads(raw)
        items_raw = data.get("items") or []
        if len(items_raw) < 4:
            return fallback
        items = [PredictionItem.model_validate(it) for it in items_raw[:4]]
        return PredictionsResponse(
            period=period,  # type: ignore[arg-type]
            items=items,
            generated_at=datetime.now(timezone.utc).isoformat(),
        )
    except Exception:
        return fallback

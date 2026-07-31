"""Weekly Journey Summary — one grounded chapter per ISO week."""

from __future__ import annotations

import json
import logging
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

import sentry_sdk

from app.config import Settings
from app.prompts.templates import WEEKLY_GUIDANCE_SYSTEM
from app.schemas.guidance import WeeklySummaryBody, WeeklySummaryResponse
from app.schemas.palm import PalmAnalysis
from app.services.bucket_store import SessionBucket, normalize_user_memory
from app.services.day_context import (
    chapter_entry_from_context,
    chapters_in_week,
    deterministic_current_chapter,
    focus_label,
    get_recent_chapters,
    merge_recent_chapters,
    resolve_today_focus_theme,
    utc_week_key,
)
from app.services.llm_client import llm_chat_completion
from app.services.user_memory import prune_user_memory, prompt_memory_snippets
from app.utils.ai_errors import log_ai_fallback
from app.utils.json_repair import loads_llm_json

logger = logging.getLogger(__name__)

# Soft retry after deterministic fallback — avoid locking a transient LLM outage for the week.
_FALLBACK_RETRY_AFTER = timedelta(minutes=15)
_MAX_FALLBACK_ATTEMPTS = 2


def _parse_iso(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


def _week_signal_bundle(bkt: SessionBucket) -> dict[str, Any]:
    """Compact lived-week evidence for the weekly prompt (low token cost)."""
    chapters = get_recent_chapters(bkt.daily_context)
    prev = bkt.daily_context if isinstance(bkt.daily_context, dict) else None
    if prev and prev.get("date"):
        archived = chapter_entry_from_context(prev)
        if archived:
            chapters = merge_recent_chapters(chapters, [archived])

    week = utc_week_key()
    week_chapters = chapters_in_week(chapters, week_key=week)
    # Fall back to all recent if ISO week filter is empty mid-migration.
    sourced = week_chapters or chapters[-7:]

    themes = [str(c.get("focusTheme") or "") for c in sourced if c.get("focusTheme")]
    reflections = [
        str(c.get("reflectionSummary") or "").strip()
        for c in sourced
        if str(c.get("reflectionSummary") or "").strip()
    ]
    slim_chapters = [
        {
            "date": c.get("date"),
            "title": c.get("title"),
            "focusTheme": c.get("focusTheme"),
            "reflectionSummary": c.get("reflectionSummary"),
        }
        for c in sourced
    ]
    top_from_chapters = None
    if themes:
        top_from_chapters = Counter(themes).most_common(1)[0][0]
    return {
        "recentChapters": slim_chapters,
        "recentThemes": themes,
        "reflections": reflections[:7],
        "inferredTopTheme": top_from_chapters,
    }


def _deterministic_weekly(
    palm: PalmAnalysis,
    focus_topics: list[str],
    streak: int | None,
    *,
    top_theme: str | None,
) -> WeeklySummaryResponse:
    traits = palm.traits[:2] if palm.traits else ["depth"]
    trait_text = " and ".join(t.replace("_", " ") for t in traits)
    theme = top_theme or (focus_topics[0] if focus_topics else "growth")
    streak_bit = f" You stayed consistent for {streak} days." if streak and streak >= 2 else ""
    body = (
        f"This week, your {palm.personality} Blueprint kept pointing to {trait_text}. "
        f"Your {focus_label(theme)} thread was the through-line — one honest step each day is enough."
        f"{streak_bit} Next week, keep {focus_label(theme).lower()} close while noticing what wants to shift."
    )
    current = deterministic_current_chapter(theme, palm.personality)
    return WeeklySummaryResponse(
        title="Your week in motion",
        body=body[:480],
        week_key=utc_week_key(),
        cached=False,
        top_theme=theme,
        current_chapter=current,
        source="fallback",
    )


def cached_weekly_if_current(bkt: SessionBucket) -> WeeklySummaryResponse | None:
    """
    Return locked weekly summary when safe to serve without regenerating.

    LLM-backed entries are permanent for the ISO week.
    Fallback entries are served while a soft retry window has not elapsed / attempts exhausted.
    """
    ctx = bkt.weekly_context
    week = utc_week_key()
    if not isinstance(ctx, dict) or ctx.get("weekKey") != week:
        return None
    title = str(ctx.get("title") or "").strip()
    body = str(ctx.get("body") or "").strip()
    if not title or not body:
        return None

    raw_source = str(ctx.get("source") or "llm")
    source = "fallback" if raw_source == "fallback" else "llm"

    payload = WeeklySummaryResponse(
        title=title,
        body=body,
        week_key=week,
        cached=True,
        top_theme=str(ctx.get("topTheme") or "") or None,
        consistency_note=str(ctx.get("consistencyNote") or "") or None,
        current_chapter=str(ctx.get("currentChapter") or "") or None,
        source=source,  # type: ignore[arg-type]
    )

    if source != "fallback":
        return payload

    attempts = int(ctx.get("fallbackAttempts") or 1)
    if attempts >= _MAX_FALLBACK_ATTEMPTS:
        return payload

    last = _parse_iso(str(ctx.get("lastAttemptAt") or ctx.get("generated_at") or ""))
    now = datetime.now(timezone.utc)
    if last is not None and now - last < _FALLBACK_RETRY_AFTER:
        return payload

    # Soft retry window open — caller may regenerate.
    return None


def store_weekly_context(
    bkt: SessionBucket,
    *,
    title: str,
    body: str,
    top_theme: str | None = None,
    consistency_note: str | None = None,
    current_chapter: str | None = None,
    source: str = "llm",
    fallback_attempts: int | None = None,
) -> None:
    week = utc_week_key()
    prev = bkt.weekly_context if isinstance(bkt.weekly_context, dict) else {}
    payload: dict[str, Any] = {
        "weekKey": week,
        "title": title,
        "body": body,
        "topTheme": top_theme,
        "consistencyNote": consistency_note,
        "currentChapter": current_chapter,
        "source": source,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "lastAttemptAt": datetime.now(timezone.utc).isoformat(),
    }
    if source == "fallback":
        prev_attempts = int(prev.get("fallbackAttempts") or 0) if prev.get("weekKey") == week else 0
        payload["fallbackAttempts"] = (
            fallback_attempts if fallback_attempts is not None else prev_attempts + 1
        )
    else:
        payload["fallbackAttempts"] = 0
    bkt.weekly_context = payload


async def generate_weekly_summary(
    settings: Settings,
    body: WeeklySummaryBody,
    bkt: SessionBucket,
) -> tuple[WeeklySummaryResponse, bool]:
    cached = cached_weekly_if_current(bkt)
    if cached is not None:
        return cached, False

    palm = body.palm_analysis or bkt.palm
    if palm is None:
        raise ValueError("palm_required")

    focus_topics = body.focus_topics
    if not focus_topics:
        raw = bkt.meta.get("focusTopics") or []
        focus_topics = [str(t) for t in raw] if isinstance(raw, list) else []

    bkt.user_memory = prune_user_memory(bkt.user_memory)
    mem = normalize_user_memory(bkt.user_memory)
    journey, temporary = prompt_memory_snippets(bkt)
    streak = body.streak
    signals = _week_signal_bundle(bkt)

    consistency_note = None
    if streak is not None and streak >= 2:
        consistency_note = f"You maintained a {streak}-day consistency streak this week."

    today_theme = resolve_today_focus_theme(bkt.daily_context, focus_topics, mem.get("temporary"))
    top_theme = (
        signals.get("inferredTopTheme")
        or today_theme
        or (focus_topics[0] if focus_topics else "growth")
    )

    prev_weekly = bkt.weekly_context if isinstance(bkt.weekly_context, dict) else {}
    prev_title = None
    prev_chapter = None
    if prev_weekly.get("weekKey") and prev_weekly.get("weekKey") != utc_week_key():
        prev_title = str(prev_weekly.get("title") or "") or None
        prev_chapter = str(prev_weekly.get("currentChapter") or "") or None

    payload = {
        "weekKey": utc_week_key(),
        "personality": palm.personality,
        "traits": palm.traits,
        "focusTopics": focus_topics,
        "lifeJourney": journey,
        "temporaryContext": temporary,
        "streak": streak,
        "ritualsCompletedTotal": body.rituals_completed_total,
        "recentChapters": signals["recentChapters"],
        "recentThemes": signals["recentThemes"],
        "reflections": signals["reflections"],
        "todayFocusTheme": today_theme,
        "previousWeekTitle": prev_title,
        "previousCurrentChapter": prev_chapter,
    }

    fallback = _deterministic_weekly(palm, focus_topics, streak, top_theme=str(top_theme))
    fallback = fallback.model_copy(
        update={"top_theme": top_theme, "consistency_note": consistency_note}
    )

    completion = await llm_chat_completion(
        settings,
        model=settings.openrouter_chat_model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": WEEKLY_GUIDANCE_SYSTEM},
            {"role": "user", "content": json.dumps(payload)},
        ],
        temperature=0.65,
        max_tokens=360,
        timeout_seconds=12.0,
        feature="weekly_summary",
    )
    if completion is None:
        log_ai_fallback("weekly_summary", "no_completion")
        store_weekly_context(
            bkt,
            title=fallback.title,
            body=fallback.body,
            top_theme=top_theme,
            consistency_note=consistency_note,
            current_chapter=fallback.current_chapter,
            source="fallback",
        )
        return fallback, True

    try:
        raw = completion.choices[0].message.content or "{}"
        data = loads_llm_json(raw, feature="weekly_summary")
        title = str(data.get("title") or "").strip() or fallback.title
        body_text = str(data.get("body") or "").strip() or fallback.body
        current = str(data.get("currentChapter") or "").strip() or fallback.current_chapter
        result = WeeklySummaryResponse(
            title=title[:80],
            body=body_text[:480],
            week_key=utc_week_key(),
            cached=False,
            top_theme=top_theme,
            consistency_note=consistency_note,
            current_chapter=(current[:160] if current else None),
            source="llm",
        )
        store_weekly_context(
            bkt,
            title=result.title,
            body=result.body,
            top_theme=top_theme,
            consistency_note=consistency_note,
            current_chapter=result.current_chapter,
            source="llm",
        )
        return result, True
    except Exception as exc:
        logger.exception("Weekly summary parse failed: %s", exc)
        sentry_sdk.capture_exception(exc)
        log_ai_fallback("weekly_summary", "parse_error", error_type=type(exc).__name__)
        store_weekly_context(
            bkt,
            title=fallback.title,
            body=fallback.body,
            top_theme=top_theme,
            consistency_note=consistency_note,
            current_chapter=fallback.current_chapter,
            source="fallback",
        )
        return fallback, True

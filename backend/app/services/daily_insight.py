"""Daily guidance (Today's Guidance) grounded in the Life Blueprint."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import sentry_sdk

from app.config import Settings
from app.prompts.templates import GUIDANCE_SYSTEM
from app.schemas.guidance import DailyGuidanceBody, DailyGuidanceResponse
from app.schemas.palm import PalmAnalysis
from app.services.bucket_store import SessionBucket, normalize_user_memory
from app.services.day_context import (
    FOCUS_THEMES,
    chapter_entry_from_context,
    get_recent_chapters,
    is_complete_daily_context,
    merge_recent_chapters,
    resolve_today_focus_theme,
    utc_today_iso,
)
from app.services.llm_client import llm_chat_completion
from app.services.user_memory import continue_hint_from_memory, prune_user_memory, prompt_memory_snippets

logger = logging.getLogger(__name__)

# Soft retry after deterministic fallback — avoid locking a transient LLM outage for the day.
_FALLBACK_RETRY_AFTER = timedelta(minutes=15)
_MAX_FALLBACK_ATTEMPTS = 2


def _parse_iso(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


def _deterministic_guidance(
    palm: PalmAnalysis,
    focus_topics: list[str],
    focus_theme: str,
) -> DailyGuidanceResponse:
    traits = palm.traits[:2] if palm.traits else []
    trait_text = " and ".join(t.replace("_", " ") for t in traits) if traits else "curiosity and depth"
    title = (palm.personality or "Visionary").strip().title() or "Visionary"
    focus_hint = f" Today’s focus is {focus_theme}."
    if focus_topics:
        focus_hint = f" Keep your {focus_topics[0]} thread close — today’s focus is {focus_theme}."
    body = (
        f"Your Life Blueprint points to {trait_text}. "
        f"Take one honest step that matches who you already are.{focus_hint}"
    )
    return DailyGuidanceResponse(
        title=title,
        body=body[:420],
        focus_theme=focus_theme,
        cached=False,
        date=utc_today_iso(),
    )


def _guidance_payload_from_ctx(ctx: dict[str, Any], bkt: SessionBucket, streak: int | None = None) -> DailyGuidanceResponse:
    guidance = ctx["guidance"]
    theme = str(ctx.get("focusTheme") or guidance.get("focusTheme") or "").strip().lower()
    return enrich_guidance_response(
        DailyGuidanceResponse(
            title=str(guidance["title"]).strip(),
            body=str(guidance["body"]).strip(),
            focus_theme=theme if theme in FOCUS_THEMES else None,
            cached=True,
            date=str(ctx.get("date")),
        ),
        bkt,
        streak=streak,
    )


def enrich_guidance_response(
    result: DailyGuidanceResponse,
    bkt: SessionBucket,
    *,
    streak: int | None = None,
) -> DailyGuidanceResponse:
    """Attach Home continuity fields without mutating stored guidance text."""
    bkt.user_memory = prune_user_memory(bkt.user_memory)
    note = None
    if streak is not None and streak >= 2:
        note = f"You've stayed consistent for {streak} days."
    return result.model_copy(
        update={
            "continue_hint": continue_hint_from_memory(bkt),
            "consistency_note": note,
        }
    )


def cached_guidance_if_today(
    bkt: SessionBucket,
    *,
    streak: int | None = None,
) -> DailyGuidanceResponse | None:
    """
    Return locked guidance for today when safe to serve without regenerating.

    LLM-backed entries are permanent for the UTC day.
    Fallback entries are served while a soft retry window has not elapsed / attempts exhausted.
    """
    ctx = bkt.daily_context
    today = utc_today_iso()
    if not is_complete_daily_context(ctx, today):
        return None
    assert isinstance(ctx, dict)

    source = str(ctx.get("source") or "llm")
    if source != "fallback":
        return _guidance_payload_from_ctx(ctx, bkt, streak)

    attempts = int(ctx.get("fallbackAttempts") or 1)
    if attempts >= _MAX_FALLBACK_ATTEMPTS:
        return _guidance_payload_from_ctx(ctx, bkt, streak)

    last = _parse_iso(str(ctx.get("lastAttemptAt") or ctx.get("generated_at") or ""))
    now = datetime.now(timezone.utc)
    if last is not None and now - last < _FALLBACK_RETRY_AFTER:
        return _guidance_payload_from_ctx(ctx, bkt, streak)

    # Soft retry window open — caller may regenerate.
    return None


def store_daily_context(
    bkt: SessionBucket,
    *,
    title: str,
    body: str,
    focus_theme: str,
    source: str = "llm",
    fallback_attempts: int | None = None,
) -> None:
    """Write a complete daily_context chapter only (never date/guidance null placeholders)."""
    today = utc_today_iso()
    prev = bkt.daily_context if isinstance(bkt.daily_context, dict) else {}
    reflection = prev.get("reflection") if prev.get("date") == today else None
    tasks_cache = prev.get("tasksCache") if prev.get("date") == today else None

    recent = get_recent_chapters(prev)
    prev_day = str(prev.get("date") or "")
    if prev_day and prev_day != today:
        archived = chapter_entry_from_context(prev)
        if archived:
            recent = merge_recent_chapters(recent, [archived])

    payload: dict[str, Any] = {
        "date": today,
        "guidance": {"title": title, "body": body},
        "focusTheme": focus_theme,
        "reflection": reflection,
        "source": source,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "lastAttemptAt": datetime.now(timezone.utc).isoformat(),
        "recentChapters": recent,
    }
    if tasks_cache is not None:
        payload["tasksCache"] = tasks_cache
    if source == "fallback":
        prev_attempts = int(prev.get("fallbackAttempts") or 0) if prev.get("date") == today else 0
        payload["fallbackAttempts"] = (
            fallback_attempts if fallback_attempts is not None else prev_attempts + 1
        )
    else:
        payload["fallbackAttempts"] = 0
    bkt.daily_context = payload


def _anti_repeat_from_chapters(chapters: list[dict[str, Any]]) -> dict[str, Any]:
    """Compact anti-repetition signals for the guidance prompt (keep tokens low)."""
    recent = chapters[-4:]
    titles = [str(c.get("title") or "").strip() for c in recent if c.get("title")]
    themes = [str(c.get("focusTheme") or "").strip() for c in recent if c.get("focusTheme")]
    # Truncated bodies act as metaphor / action memory without a separate extractor.
    bodies = [str(c.get("body") or "").strip()[:120] for c in recent if c.get("body")]
    return {
        "recentTitles": titles,
        "recentThemes": themes,
        "recentMetaphorsAndActions": bodies,
        "yesterdayTitle": titles[-1] if titles else None,
    }


async def generate_daily_guidance(
    settings: Settings,
    body: DailyGuidanceBody,
    bkt: SessionBucket,
) -> tuple[DailyGuidanceResponse, bool]:
    """
    Generate or return Today's Guidance.

    Returns (response, changed) where ``changed`` means daily_context was mutated and
    should be persisted. Cache hits never mutate.
    """
    cached = cached_guidance_if_today(bkt, streak=body.streak)
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
    journey, temporary_texts = prompt_memory_snippets(bkt)
    focus_theme = resolve_today_focus_theme(bkt.daily_context, focus_topics, mem.get("temporary"))

    recent_chapters = get_recent_chapters(bkt.daily_context)
    # If yesterday still sits in daily_context (pre-rollover archive), include it.
    prev = bkt.daily_context if isinstance(bkt.daily_context, dict) else None
    if prev and prev.get("date") and prev.get("date") != utc_today_iso():
        archived = chapter_entry_from_context(prev)
        if archived:
            recent_chapters = merge_recent_chapters(recent_chapters, [archived])

    anti = _anti_repeat_from_chapters(recent_chapters)

    payload = {
        "date": utc_today_iso(),
        "personality": palm.personality,
        "traits": palm.traits,
        "life_line": palm.life_line,
        "heart_line": palm.heart_line,
        "head_line": palm.head_line,
        "focusTopics": focus_topics,
        "lifeJourney": journey,
        "temporaryContext": temporary_texts,
        "streak": body.streak,
        "focusTheme": focus_theme,
        "yesterdayTitle": anti.get("yesterdayTitle"),
        "recentTitles": anti.get("recentTitles"),
        "recentThemes": anti.get("recentThemes"),
        "recentMetaphorsAndActions": anti.get("recentMetaphorsAndActions"),
    }

    fallback = _deterministic_guidance(palm, focus_topics, focus_theme)

    # Keep Home snappy: short LLM budget, then deterministic fallback (client waits ~45s).
    completion = await llm_chat_completion(
        settings,
        model=settings.openrouter_chat_model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": GUIDANCE_SYSTEM},
            {"role": "user", "content": json.dumps(payload)},
        ],
        temperature=0.7,
        max_tokens=280,
        timeout_seconds=12.0,
    )
    if completion is None:
        logger.warning("llm_fallback_reason=daily_guidance")
        store_daily_context(
            bkt,
            title=fallback.title,
            body=fallback.body,
            focus_theme=focus_theme,
            source="fallback",
        )
        return enrich_guidance_response(fallback, bkt, streak=body.streak), True

    try:
        raw = completion.choices[0].message.content or "{}"
        data = json.loads(raw)
        title = str(data.get("title") or "").strip() or fallback.title
        body_text = str(data.get("body") or "").strip() or fallback.body
        # focusTheme is locked server-side — never take LLM overrides.
        result = DailyGuidanceResponse(
            title=title[:80],
            body=body_text[:420],
            focus_theme=focus_theme,
            cached=False,
            date=utc_today_iso(),
        )
        store_daily_context(
            bkt,
            title=result.title,
            body=result.body,
            focus_theme=focus_theme,
            source="llm",
        )
        return enrich_guidance_response(result, bkt, streak=body.streak), True
    except Exception as exc:
        logger.exception("Daily guidance parse failed: %s", exc)
        sentry_sdk.capture_exception(exc)
        store_daily_context(
            bkt,
            title=fallback.title,
            body=fallback.body,
            focus_theme=focus_theme,
            source="fallback",
        )
        return enrich_guidance_response(fallback, bkt, streak=body.streak), True

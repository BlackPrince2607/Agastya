"""Canonical calendar-day helpers for guidance, rituals, and daily_context."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

FOCUS_THEMES = ("career", "love", "money", "growth")

_TOPIC_TO_THEME = {
    "career": "career",
    "money": "money",
    "love": "love",
    "matching": "love",
    "growth": "growth",
    "learning": "growth",
}

_RECENT_CHAPTERS_CAP = 7

_FOCUS_LABELS = {
    "career": "Career Growth",
    "love": "Relationships",
    "money": "Money Clarity",
    "growth": "Personal Growth",
}


def utc_today_iso() -> str:
    """Canonical 'today' for Agastya engagement — UTC calendar date (YYYY-MM-DD)."""
    return datetime.now(timezone.utc).date().isoformat()


def utc_week_key(day: date | None = None) -> str:
    """ISO week bucket e.g. 2026-W28 — shared by weekly summary cache."""
    d = day or parse_utc_today()
    iso = d.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def parse_utc_today() -> date:
    return datetime.now(timezone.utc).date()


def parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def themes_from_focus_topics(focus_topics: list[str] | None) -> list[str]:
    """Unique focus themes from onboarding topics, order preserved."""
    themes: list[str] = []
    for raw in focus_topics or []:
        mapped = _TOPIC_TO_THEME.get(str(raw).lower().strip())
        if mapped and mapped not in themes:
            themes.append(mapped)
    return themes


def temporary_theme_override(temporary: list[dict[str, Any]] | None) -> str | None:
    """Highest-priority theme from active Temporary Context keywords."""
    for fact in temporary or []:
        text = str(fact.get("text", "")).lower()
        if any(k in text for k in ("interview", "job", "career", "work", "placement")):
            return "career"
        if any(k in text for k in ("exam", "study", "learn")):
            return "growth"
        if any(k in text for k in ("relationship", "partner", "love", "date")):
            return "love"
        if any(k in text for k in ("money", "save", "finance", "budget")):
            return "money"
    return None


def pick_focus_theme(
    focus_topics: list[str] | None,
    temporary: list[dict[str, Any]] | None = None,
    *,
    day: date | None = None,
) -> str:
    """
    Deterministic Today's Focus.

    Priority:
    1. Temporary Context keyword override
    2. Rotate among the user's onboarding themes by UTC day
    3. Rotate across all FOCUS_THEMES when no topics map
    """
    override = temporary_theme_override(temporary)
    if override:
        return override

    d = day or parse_utc_today()
    themes = themes_from_focus_topics(focus_topics)
    if themes:
        return themes[d.toordinal() % len(themes)]
    return FOCUS_THEMES[d.toordinal() % len(FOCUS_THEMES)]


def is_complete_daily_context(ctx: Any, today: str | None = None) -> bool:
    """True when daily_context is a full today's chapter (date + guidance + focusTheme)."""
    if not isinstance(ctx, dict):
        return False
    day = today or utc_today_iso()
    if ctx.get("date") != day:
        return False
    guidance = ctx.get("guidance")
    if not isinstance(guidance, dict):
        return False
    if not str(guidance.get("title") or "").strip():
        return False
    if not str(guidance.get("body") or "").strip():
        return False
    theme = ctx.get("focusTheme") or guidance.get("focusTheme")
    return str(theme or "").strip().lower() in FOCUS_THEMES


def resolve_today_focus_theme(
    daily_context: Any,
    focus_topics: list[str] | None,
    temporary: list[dict[str, Any]] | None = None,
) -> str:
    """
    Single source of truth for Today's Focus.

    Prefer focusTheme locked into today's complete daily_context (from Today's Guidance).
    Otherwise derive deterministically so Tasks-before-Guidance still aligns once Guidance runs
    with the same inputs.
    """
    today = utc_today_iso()
    if is_complete_daily_context(daily_context, today):
        theme = str(
            (daily_context or {}).get("focusTheme")
            or ((daily_context or {}).get("guidance") or {}).get("focusTheme")
            or ""
        ).strip().lower()
        if theme in FOCUS_THEMES:
            return theme
    return pick_focus_theme(focus_topics, temporary, day=parse_utc_today())


def chapter_entry_from_context(ctx: dict[str, Any]) -> dict[str, Any] | None:
    """Build a recentChapters entry from a stored daily_context chapter."""
    day = str(ctx.get("date") or "").strip()
    guidance = ctx.get("guidance") if isinstance(ctx.get("guidance"), dict) else {}
    title = str(guidance.get("title") or "").strip()
    body = str(guidance.get("body") or "").strip()
    theme = str(ctx.get("focusTheme") or guidance.get("focusTheme") or "").strip().lower()
    if not day or not title or not body or theme not in FOCUS_THEMES:
        return None
    entry: dict[str, Any] = {
        "date": day,
        "title": title[:80],
        "body": body[:420],
        "focusTheme": theme,
    }
    reflection = ctx.get("reflection")
    if isinstance(reflection, dict) and reflection.get("completed"):
        note = str(reflection.get("note") or "").strip()
        summary = note[:280] if note else "Evening reflection completed"
        entry["reflectionSummary"] = summary
    return entry


def normalize_recent_chapters(raw: Any) -> list[dict[str, Any]]:
    """Cap and sanitize recentChapters (max 7)."""
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    seen_dates: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        day = str(item.get("date") or "").strip()
        title = str(item.get("title") or "").strip()
        body = str(item.get("body") or "").strip()
        theme = str(item.get("focusTheme") or "").strip().lower()
        if not day or not title or not body or theme not in FOCUS_THEMES:
            continue
        if day in seen_dates:
            continue
        seen_dates.add(day)
        entry: dict[str, Any] = {
            "date": day,
            "title": title[:80],
            "body": body[:420],
            "focusTheme": theme,
        }
        summary = str(item.get("reflectionSummary") or "").strip()
        if summary:
            entry["reflectionSummary"] = summary[:280]
        out.append(entry)
    out.sort(key=lambda c: str(c.get("date") or ""))
    return out[-_RECENT_CHAPTERS_CAP:]


def merge_recent_chapters(*lists: Any) -> list[dict[str, Any]]:
    """Union chapter lists by date (newer body wins), capped at 7."""
    by_date: dict[str, dict[str, Any]] = {}
    for raw in lists:
        for entry in normalize_recent_chapters(raw):
            by_date[str(entry["date"])] = entry
    merged = [by_date[k] for k in sorted(by_date.keys())]
    return merged[-_RECENT_CHAPTERS_CAP:]


def get_recent_chapters(daily_context: Any) -> list[dict[str, Any]]:
    if not isinstance(daily_context, dict):
        return []
    return normalize_recent_chapters(daily_context.get("recentChapters"))


def chapters_in_week(
    chapters: list[dict[str, Any]],
    *,
    week_key: str | None = None,
) -> list[dict[str, Any]]:
    """Filter recent chapters belonging to the given ISO week."""
    target = week_key or utc_week_key()
    out: list[dict[str, Any]] = []
    for chapter in chapters:
        d = parse_iso_date(str(chapter.get("date") or ""))
        if d is None:
            continue
        if utc_week_key(d) == target:
            out.append(chapter)
    return out


def focus_label(theme: str | None) -> str:
    key = str(theme or "").strip().lower()
    return _FOCUS_LABELS.get(key, "Growth")


def deterministic_current_chapter(theme: str | None, personality: str | None = None) -> str:
    label = focus_label(theme)
    identity = (personality or "").strip()
    if identity:
        return f"This week your {identity} Blueprint is expressing itself through {label}."
    return f"This week your Blueprint is expressing itself through {label}."

"""Layered user memory — Life Journey (slow) + Temporary Context (expiring)."""

from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from app.config import Settings
from app.prompts.templates import MEMORY_EXTRACT_SYSTEM
from app.services.bucket_store import SessionBucket, normalize_user_memory
from app.services.day_context import utc_today_iso
from app.services.llm_client import llm_chat_completion
from app.utils.ai_errors import log_ai_fallback
from app.utils.json_repair import loads_llm_json

logger = logging.getLogger(__name__)

_JOURNEY_CAP = 20
_TEMPORARY_CAP = 15
_FACT_MAX_LEN = 120

# Cheap gate — skip LLM extract for greetings / fluff.
_FACTFUL = re.compile(
    r"\b("
    r"interview|exam|exams|test|deadline|placement|placements|wedding|vacation|trip|"
    r"stressed|anxious|worried|depressed|lonely|"
    r"trying to|want to|goal|goals|focusing on|working on|"
    r"job|career|salary|money|budget|save|saving|"
    r"relationship|partner|girlfriend|boyfriend|married|"
    r"weight|fitness|gym|health|sleep|insomnia|"
    r"tomorrow|next week|this week|monday|friday"
    r")\b",
    re.IGNORECASE,
)

_REFLECTION_SPAM = re.compile(r"^completed evening reflection\b", re.IGNORECASE)

# Keyword families used to archive superseded temporary facts.
_TEMP_FAMILIES: tuple[tuple[str, ...], ...] = (
    ("interview", "job", "career", "work", "placement"),
    ("exam", "study", "learn", "test"),
    ("relationship", "partner", "love", "date"),
    ("money", "save", "finance", "budget"),
)


def memory_looks_factful(text: str) -> bool:
    cleaned = (text or "").strip()
    if len(cleaned) < 18:
        return False
    return bool(_FACTFUL.search(cleaned))


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


def _is_reflection_spam(text: str) -> bool:
    return bool(_REFLECTION_SPAM.search((text or "").strip()))


def _family_for_text(text: str) -> tuple[str, ...] | None:
    lowered = text.lower()
    for family in _TEMP_FAMILIES:
        if any(k in lowered for k in family):
            return family
    return None


def prune_user_memory(raw: Any) -> dict[str, list[Any]]:
    """Drop expired / archived temporary facts, strip reflection spam, enforce caps."""
    mem = normalize_user_memory(raw)
    now = _now()
    journey: list[dict[str, Any]] = []
    for item in mem.get("journey") or []:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or "").strip()
        if not text or _is_reflection_spam(text):
            continue
        journey.append(item)
    temporary: list[dict[str, Any]] = []
    for item in mem.get("temporary") or []:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or "").strip()
        if not text:
            continue
        status = str(item.get("status") or "active")
        if status == "archived":
            continue
        expires = _parse_iso(str(item.get("expires_at") or "") or None)
        if expires is not None and expires <= now:
            continue
        temporary.append(item)
    return {
        "journey": journey[-_JOURNEY_CAP:],
        "temporary": temporary[-_TEMPORARY_CAP:],
    }


def active_temporary_texts(bkt: SessionBucket, *, limit: int = 5) -> list[str]:
    """Newest-first temporary facts (then reversed for chronological prompt order)."""
    mem = prune_user_memory(bkt.user_memory)
    out: list[str] = []
    for item in reversed(mem.get("temporary") or []):
        text = str(item.get("text") or "").strip()
        if text:
            out.append(text)
        if len(out) >= limit:
            break
    return list(reversed(out))


def journey_texts(bkt: SessionBucket, *, limit: int = 8) -> list[str]:
    """Prefer newest meaningful journey facts for prompts."""
    mem = prune_user_memory(bkt.user_memory)
    out: list[str] = []
    for item in reversed(mem.get("journey") or []):
        text = str(item.get("text") or "").strip()
        if not text or _is_reflection_spam(text):
            continue
        out.append(text)
        if len(out) >= limit:
            break
    return list(reversed(out))


def prompt_memory_snippets(bkt: SessionBucket) -> tuple[list[str], list[str]]:
    """
    Memory selection for guidance / rituals / weekly prompts.

    Prefer newest journey goals + active temporary context; skip stale spam.
    """
    journey = journey_texts(bkt, limit=5)
    temporary = active_temporary_texts(bkt, limit=6)
    return journey, temporary


def continue_hint_from_memory(bkt: SessionBucket) -> str | None:
    """Prefer a temporary fact for Home ContinueConversation."""
    temps = active_temporary_texts(bkt, limit=1)
    if not temps:
        return None
    text = temps[-1]
    if len(text) > 72:
        return f"{text[:69]}…"
    return text


def format_memory_block(bkt: SessionBucket) -> str:
    """Prompt fragment for chat / other LLM contexts."""
    bkt.user_memory = prune_user_memory(bkt.user_memory)
    journey = journey_texts(bkt, limit=5)
    temporary = active_temporary_texts(bkt, limit=6)
    if not journey and not temporary:
        return ""
    parts = ["MEMORY (do not invent facts beyond this):"]
    if journey:
        parts.append("LIFE_JOURNEY:\n- " + "\n- ".join(journey))
    if temporary:
        parts.append("TEMPORARY_CONTEXT:\n- " + "\n- ".join(temporary))
    return "\n\n".join(parts)


def _normalize_fact_text(text: str) -> str:
    cleaned = " ".join(str(text).split()).strip()
    if len(cleaned) > _FACT_MAX_LEN:
        cleaned = cleaned[: _FACT_MAX_LEN - 1].rstrip() + "…"
    return cleaned


def _fact_key(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def _archive_superseded_temporary(
    temporary: list[dict[str, Any]],
    new_text: str,
) -> list[dict[str, Any]]:
    """Archive older temporary facts in the same keyword family as the new fact."""
    family = _family_for_text(new_text)
    if not family:
        return temporary
    out: list[dict[str, Any]] = []
    for item in temporary:
        text = str(item.get("text") or "")
        if any(k in text.lower() for k in family):
            archived = dict(item)
            archived["status"] = "archived"
            # Drop from active list (prune already skips archived).
            continue
        out.append(item)
    return out


def merge_extracted_facts(
    bkt: SessionBucket,
    facts: list[dict[str, Any]],
) -> bool:
    """Merge extracted facts into the bucket. Returns True if memory changed."""
    if not facts:
        return False
    mem = prune_user_memory(bkt.user_memory)
    journey = list(mem.get("journey") or [])
    temporary = list(mem.get("temporary") or [])
    existing = {_fact_key(str(f.get("text") or "")) for f in journey + temporary}
    changed = False
    now = _now()

    for raw in facts:
        if not isinstance(raw, dict):
            continue
        text = _normalize_fact_text(str(raw.get("text") or ""))
        if len(text) < 8 or _is_reflection_spam(text):
            continue
        key = _fact_key(text)
        if not key or key in existing:
            continue
        layer = str(raw.get("layer") or "temporary").strip().lower()
        if layer not in {"journey", "temporary"}:
            layer = "temporary"
        entry: dict[str, Any] = {
            "id": str(uuid.uuid4()),
            "text": text,
            "layer": layer,
            "source": "chat",
            "created_at": now.isoformat(),
            "status": "active",
        }
        if layer == "temporary":
            days = raw.get("expiresInDays", raw.get("expires_in_days"))
            try:
                days_i = int(days) if days is not None else 7
            except (TypeError, ValueError):
                days_i = 7
            days_i = max(1, min(days_i, 30))
            entry["expires_at"] = (now + timedelta(days=days_i)).isoformat()
            temporary = _archive_superseded_temporary(temporary, text)
            temporary.append(entry)
        else:
            journey.append(entry)
        existing.add(key)
        changed = True

    if not changed:
        return False
    bkt.user_memory = {
        "journey": journey[-_JOURNEY_CAP:],
        "temporary": temporary[-_TEMPORARY_CAP:],
    }
    return True


async def maybe_extract_and_merge_memory(
    settings: Settings,
    bkt: SessionBucket,
    user_text: str,
) -> bool:
    """
    Optionally extract layered memory from a user chat turn.

    Returns True when user_memory mutated (caller should persist).
    """
    bkt.user_memory = prune_user_memory(bkt.user_memory)
    if not memory_looks_factful(user_text):
        return False

    completion = await llm_chat_completion(
        settings,
        model=settings.openrouter_chat_model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": MEMORY_EXTRACT_SYSTEM},
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "today": utc_today_iso(),
                        "message": user_text.strip()[:600],
                    }
                ),
            },
        ],
        temperature=0.2,
        max_tokens=180,
        feature="memory_extract",
    )
    if completion is None:
        log_ai_fallback("memory_extract", "no_completion")
        return False
    try:
        raw = completion.choices[0].message.content or "{}"
        data = loads_llm_json(raw, feature="memory_extract")
        facts = data.get("facts") if isinstance(data, dict) else None
        if not isinstance(facts, list):
            return False
        return merge_extracted_facts(bkt, facts[:2])
    except Exception:
        logger.exception("memory extract parse failed")
        log_ai_fallback("memory_extract", "parse_error")
        return False


def stamp_reflection_completed(bkt: SessionBucket, note: str | None = None) -> bool:
    """Stamp evening reflection for today on daily_context only (not journey memory)."""
    today = utc_today_iso()
    prev = bkt.daily_context if isinstance(bkt.daily_context, dict) else {}
    same_day = prev.get("date") == today
    base: dict[str, Any] = dict(prev) if same_day else {"date": today}
    base["date"] = today

    reflection: dict[str, Any] = {
        "completed": True,
        "completedAt": _now().isoformat(),
        "focusTheme": base.get("focusTheme"),
    }
    if note and str(note).strip():
        reflection["note"] = str(note).strip()[:280]
    # Preserve recentChapters when creating a sparse day stub.
    if "recentChapters" not in base and same_day:
        pass
    bkt.daily_context = {**base, "reflection": reflection}
    return True

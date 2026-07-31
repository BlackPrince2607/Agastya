"""OpenRouter-backed conversational guide + deterministic safety nets."""

from __future__ import annotations

import json
import logging
import re

import sentry_sdk

from app.config import Settings
from app.services.llm_client import llm_chat_completion
from app.prompts.templates import CHAT_SYSTEM, TASK_SYSTEM
from app.schemas.chat import ChatRequest
from app.schemas.palm import PalmAnalysis
from app.schemas.tasks import DailyTasksBody, Task
from app.services.bucket_store import SessionBucket, normalize_user_memory
from app.services.day_context import resolve_today_focus_theme
from app.services.reflection_task import EVENING_REFLECTION, ensure_reflection_task
from app.utils.ai_errors import log_ai_fallback
from app.utils.json_repair import loads_llm_json

_SUGGESTION_LINE = re.compile(r"^\s*SUGGESTIONS:\s*(\[.*\])\s*$", re.IGNORECASE | re.MULTILINE)
logger = logging.getLogger(__name__)

_FALLBACK_SUGGESTIONS = [
    "What should I focus on today?",
    "Help me think this through",
    "Remind me what my Blueprint says",
]


class GuideLlmUnavailableError(Exception):
    """OpenRouter is configured but the completion request failed."""


def _split_suggestions(text: str) -> tuple[str, list[str]]:
    """Strip a trailing ``SUGGESTIONS: [...]`` line and parse the chips."""
    match = _SUGGESTION_LINE.search(text)
    if not match:
        return text.strip(), []
    suggestions: list[str] = []
    try:
        parsed = loads_llm_json(match.group(1), feature="chat_suggestions")
        if isinstance(parsed, list):
            suggestions = [str(s).strip() for s in parsed if str(s).strip()][:3]
    except Exception:
        suggestions = []
    reply = text[: match.start()].strip()
    return reply, suggestions


def _heuristic_chat(body: ChatRequest) -> str:
    return "I couldn't reach the guide just now — try again in a moment."


def _chat_fallback(settings: Settings, body: ChatRequest, *, reason: str) -> tuple[str, list[str]]:
    if settings.llm_enabled and not settings.allow_llm_fallback:
        raise GuideLlmUnavailableError("OpenRouter chat unavailable")
    log_ai_fallback("chat", reason, llm_enabled=settings.llm_enabled)
    return _heuristic_chat(body), list(_FALLBACK_SUGGESTIONS)


async def generate_chat_reply(
    settings: Settings,
    body: ChatRequest,
    server_is_premium: bool = False,
    prior_chat_tail: list[dict[str, str]] | None = None,
    bkt: SessionBucket | None = None,
) -> tuple[str, list[str]]:
    # Use server-authoritative premium flag only.
    is_premium = server_is_premium
    tail = prior_chat_tail or []
    body_user_count = sum(1 for m in body.messages if m.role in {"user", "you"})
    tail_user_count = sum(1 for t in tail if t.get("role") in {"user", "you"})
    if body_user_count <= 1 and tail_user_count > 0:
        effective_user_count = tail_user_count + 1
    else:
        effective_user_count = body_user_count

    if not is_premium and effective_user_count > 5:
        return (
            "You've hit the free chat limit for now. Unlock Pro to keep talking with Agastya about your Blueprint.",
            ["Show me upgrade options", "What do I get with Pro?"],
        )

    palm_json = json.dumps(body.palm_analysis.model_dump())
    memory_block = ""
    today_focus = ""
    if bkt is not None:
        from app.services.user_memory import format_memory_block

        memory_block = format_memory_block(bkt)
        ctx = bkt.daily_context or {}
        theme = ctx.get("focusTheme")
        if isinstance(theme, str) and theme.strip():
            today_focus = f"TODAY_FOCUS:\n{theme.strip()}\n\n"
        weekly = bkt.weekly_context or {}
        chapter = weekly.get("currentChapter")
        if isinstance(chapter, str) and chapter.strip():
            today_focus += f"CURRENT_CHAPTER:\n{chapter.strip()}\n\n"
    context = (
        f"USER_PROFILE:\n{body.profile_summary}\n\n"
        f"PALM_JSON:\n{palm_json}\n\n"
        + (f"{memory_block}\n\n" if memory_block else "")
        + today_focus
        + "Answer as Agastya."
    )

    msgs = [{"role": "system", "content": f"{CHAT_SYSTEM}\n\n{context}"}]
    for turn in body.messages:
        role = turn.role
        if role == "guide":
            role = "assistant"
        elif role == "you":
            role = "user"
        elif role == "system":
            # Never accept client-supplied system turns (prompt injection).
            role = "user"
        if role not in {"user", "assistant"}:
            role = "user"
        msgs.append({"role": role, "content": turn.content})

    completion = await llm_chat_completion(
        settings,
        model=settings.openrouter_chat_model,
        messages=msgs,
        temperature=0.5,
        max_tokens=220,
        feature="chat",
    )
    if completion is None:
        return _chat_fallback(settings, body, reason="no_completion")

    try:
        text = completion.choices[0].message.content or ""
        reply, suggestions = _split_suggestions(text)
        if not reply:
            return _chat_fallback(settings, body, reason="empty_reply")
        return reply, suggestions or list(_FALLBACK_SUGGESTIONS)
    except Exception as exc:
        logger.exception("Chat reply parse failed: %s", exc)
        sentry_sdk.capture_exception(exc)
        return _chat_fallback(settings, body, reason="parse_error")


def _deterministic_tasks(
    palm: PalmAnalysis,
    premium: bool,
    focus_theme: str,
) -> tuple[list[Task], str, str]:
    variant = f"focus:{focus_theme}" if focus_theme else ("premium_predictions" if premium else "standard")
    themed = {
        "career": [
            Task(
                id="career-clarity",
                text="Clarify one career move",
                description=f"Name one next step that honors your {palm.personality} drive — even a small one.",
                category="career",
                estimatedMinutes=10,
                difficulty="medium",
                examples=["Update one bullet on your resume", "Message a mentor", "Block 25 minutes for deep work"],
            ),
            Task(
                id="career-signal",
                text="Send a professional signal",
                description="Reach out once today in a way that advances your path — ask, share, or follow up.",
                category="career",
                estimatedMinutes=15,
                difficulty="medium",
                examples=["Reply to a recruiter", "Share a useful note with a colleague", "Apply to one role"],
            ),
            EVENING_REFLECTION,
        ],
        "love": [
            Task(
                id="love-presence",
                text="Offer undivided presence",
                description="Give someone ten uninterrupted minutes — no phone, no half-listening.",
                category="love",
                estimatedMinutes=10,
                difficulty="easy",
                examples=["A partner", "A friend", "A family member"],
            ),
            Task(
                id="honest-message",
                text="Send an honest message",
                description="Reach out to someone you've been quietly avoiding — one honest sentence.",
                category="love",
                estimatedMinutes=10,
                difficulty="easy",
                examples=["Check in on a friend", "Say thank you", "Express how you feel"],
            ),
            EVENING_REFLECTION,
        ],
        "money": [
            Task(
                id="money-check",
                text="Face one money fact",
                description="Look at one account or bill without judgment — clarity beats avoidance.",
                category="money",
                estimatedMinutes=10,
                difficulty="easy",
                examples=["Check balance", "Open that bill email", "Note upcoming dues"],
            ),
            Task(
                id="money-move",
                text="Make one money move",
                description="Take a single action that aligns spending or saving with who you're becoming.",
                category="money",
                estimatedMinutes=15,
                difficulty="medium",
                examples=["Move a small amount to savings", "Cancel one unused sub", "Price a skill you'd sell"],
            ),
            EVENING_REFLECTION,
        ],
        "growth": [
            Task(
                id="gratitude",
                text="Practice gratitude",
                description="Write down three things you are grateful for today.",
                category="growth",
                estimatedMinutes=5,
                difficulty="easy",
                examples=["A person who helped you", "A small win", "Something you overlook"],
            ),
            Task(
                id="bold-step",
                text="Take a bold step",
                description=f"Do one thing that honors your {palm.personality} pulse and scares you a little.",
                category="growth",
                estimatedMinutes=15,
                difficulty="medium",
                examples=["Start that conversation", "Share your idea", "Begin a draft"],
            ),
            EVENING_REFLECTION,
        ],
    }
    tasks = themed.get(focus_theme) or themed["growth"]
    return ensure_reflection_task(tasks), variant, focus_theme


async def generate_daily_tasks(
    settings: Settings,
    body: DailyTasksBody,
    bkt: SessionBucket | None = None,
) -> tuple[list[Task], str, str, bool, str]:
    """Return tasks, variant, focusTheme, whether daily_context mutated, and source."""
    from app.services.day_context import utc_today_iso

    palm = body.palm_analysis
    premium = body.is_premium
    focus_topics = list(body.focus_topics)
    temporary: list[dict] = []
    journey: list[str] = []
    temporary_texts: list[str] = []
    if bkt is not None:
        if not focus_topics:
            raw = bkt.meta.get("focusTopics") or []
            focus_topics = [str(t) for t in raw] if isinstance(raw, list) else []
        from app.services.user_memory import prompt_memory_snippets

        mem = normalize_user_memory(bkt.user_memory)
        temporary = list(mem.get("temporary") or [])
        journey, temporary_texts = prompt_memory_snippets(bkt)
        suggested = resolve_today_focus_theme(bkt.daily_context, focus_topics, temporary)
    else:
        suggested = resolve_today_focus_theme(None, focus_topics, None)

    today = utc_today_iso()
    if bkt is not None:
        ctx = bkt.daily_context if isinstance(bkt.daily_context, dict) else {}
        cache = ctx.get("tasksCache") if ctx.get("date") == today else None
        if (
            isinstance(cache, dict)
            and cache.get("focusTheme") == suggested
            and isinstance(cache.get("tasks"), list)
        ):
            try:
                cached_tasks = [Task.model_validate(t) for t in cache["tasks"][:3]]
                if len(cached_tasks) >= 3:
                    variant = str(cache.get("variant") or f"focus:{suggested}")
                    cached_source = str(cache.get("source") or "llm")
                    source = "fallback" if cached_source == "fallback" else "llm"
                    return ensure_reflection_task(cached_tasks), variant, suggested, False, source
            except Exception:
                pass

    fallback = _deterministic_tasks(palm, premium, suggested)

    payload = {
        "traits": palm.traits,
        "personality": palm.personality,
        "life_line": palm.life_line,
        "heart_line": palm.heart_line,
        "head_line": palm.head_line,
        "premium": premium,
        "focusTopics": focus_topics,
        "lifeJourney": journey,
        "temporaryContext": temporary_texts,
        "streak": body.streak,
        "focusTheme": suggested,
    }
    completion = await llm_chat_completion(
        settings,
        model=settings.openrouter_chat_model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": TASK_SYSTEM},
            {"role": "user", "content": json.dumps(payload)},
        ],
        temperature=0.65,
        max_tokens=600,
        feature="daily_tasks",
    )
    if completion is None:
        log_ai_fallback("daily_tasks", "no_completion", llm_enabled=settings.llm_enabled)
        return fallback[0], fallback[1], fallback[2], False, "fallback"
    try:
        raw = completion.choices[0].message.content or "{}"
        data = loads_llm_json(raw, feature="daily_tasks")
        raw_tasks = data.get("tasks") or []
        if len(raw_tasks) < 3:
            log_ai_fallback("daily_tasks", "insufficient_count")
            return fallback[0], fallback[1], fallback[2], False, "fallback"
        try:
            tasks = [Task.model_validate(t) for t in raw_tasks[:3]]
        except Exception:
            log_ai_fallback("daily_tasks", "validation")
            return fallback[0], fallback[1], fallback[2], False, "fallback"
        # focusTheme is locked via resolve_today_focus_theme — ignore LLM overrides.
        variant = f"focus:{suggested}"
        tasks_out = ensure_reflection_task(tasks)
        if bkt is not None:
            from app.services.day_context import (
                chapter_entry_from_context,
                get_recent_chapters,
                merge_recent_chapters,
            )

            prev = bkt.daily_context if isinstance(bkt.daily_context, dict) else {}
            base = dict(prev) if prev.get("date") == today else {"date": today}
            base["date"] = today
            recent = get_recent_chapters(prev)
            prev_day = str(prev.get("date") or "")
            if prev_day and prev_day != today:
                archived = chapter_entry_from_context(prev)
                if archived:
                    recent = merge_recent_chapters(recent, [archived])
            if recent:
                base["recentChapters"] = recent
            base["tasksCache"] = {
                "focusTheme": suggested,
                "variant": variant,
                "source": "llm",
                "tasks": [t.model_dump(by_alias=True) for t in tasks_out],
            }
            bkt.daily_context = base
            return tasks_out, variant, suggested, True, "llm"
        return tasks_out, variant, suggested, False, "llm"
    except Exception as exc:
        logger.exception("Daily tasks generation failed: %s", exc)
        sentry_sdk.capture_exception(exc)
        log_ai_fallback("daily_tasks", "parse_error", error_type=type(exc).__name__)
        return fallback[0], fallback[1], fallback[2], False, "fallback"

"""Groq-backed conversational guide + deterministic safety nets."""

from __future__ import annotations

import json
import re

from app.config import Settings
from app.services.llm_client import groq_client
from app.prompts.templates import CHAT_SYSTEM, TASK_SYSTEM
from app.schemas.chat import ChatRequest
from app.schemas.palm import PalmAnalysis
from app.schemas.tasks import DailyTasksBody, Task

_SUGGESTION_LINE = re.compile(r"^\s*SUGGESTIONS:\s*(\[.*\])\s*$", re.IGNORECASE | re.MULTILINE)

_FALLBACK_SUGGESTIONS = [
    "Tell me more about my future",
    "What should I focus on?",
    "How can I grow from here?",
]


def _split_suggestions(text: str) -> tuple[str, list[str]]:
    """Strip a trailing ``SUGGESTIONS: [...]`` line and parse the chips."""
    match = _SUGGESTION_LINE.search(text)
    if not match:
        return text.strip(), []
    suggestions: list[str] = []
    try:
        parsed = json.loads(match.group(1))
        if isinstance(parsed, list):
            suggestions = [str(s).strip() for s in parsed if str(s).strip()][:3]
    except Exception:
        suggestions = []
    reply = text[: match.start()].strip()
    return reply, suggestions


def _heuristic_chat(body: ChatRequest) -> str:
    last_user = next((m.content for m in reversed(body.messages) if m.role == "user"), "")
    if len(last_user.strip()) < 12:
        return (
            "You hide uncertainty behind precision more often than you admit. "
            "Say the sentence you keep editing out — Agastya answers from there."
        )
    return (
        "Quiet conviction arrives before language catches up. "
        "Let one vulnerable detail surface; I'll mirror the pattern underneath."
    )


async def generate_chat_reply(
    settings: Settings,
    body: ChatRequest,
    server_is_premium: bool = False,
) -> tuple[str, list[str]]:
    # Use server-authoritative premium flag (from DB/webhook) when available;
    # fall back to client claim only when Supabase is not configured.
    is_premium = server_is_premium or body.is_premium
    if not is_premium and len(body.messages) > 10:
        return (
            "You've reached the luminous preview ceiling—unlock unlimited guide transmissions "
            "to continue this thread without interruption.",
            ["Show me upgrade options", "What do I get with premium?"],
        )

    palm_json = json.dumps(body.palm_analysis.model_dump())
    context = (
        f"USER_PROFILE:\n{body.profile_summary}\n\n"
        f"PALM_JSON:\n{palm_json}\n\n"
        "Answer as Agastya."
    )

    client = groq_client(settings)
    if client is None:
        return _heuristic_chat(body), list(_FALLBACK_SUGGESTIONS)
    try:
        msgs = [{"role": "system", "content": f"{CHAT_SYSTEM}\n\n{context}"}]
        for turn in body.messages:
            role = turn.role
            if role == "guide":
                role = "assistant"
            elif role == "you":
                role = "user"
            if role not in {"user", "assistant", "system"}:
                role = "user"
            msgs.append({"role": role, "content": turn.content})

        completion = await client.chat.completions.create(
            model=settings.groq_chat_model,
            messages=msgs,
            temperature=0.9,
            max_tokens=480,
        )
        text = completion.choices[0].message.content or ""
        reply, suggestions = _split_suggestions(text)
        if not reply:
            return _heuristic_chat(body), list(_FALLBACK_SUGGESTIONS)
        return reply, suggestions or list(_FALLBACK_SUGGESTIONS)
    except Exception:
        return _heuristic_chat(body), list(_FALLBACK_SUGGESTIONS)


def _deterministic_tasks(palm: PalmAnalysis, premium: bool) -> tuple[list[Task], str]:
    variant = "premium_predictions" if premium else "standard"
    tasks = [
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
            category="career",
            estimatedMinutes=15,
            difficulty="medium",
            examples=["Start that conversation", "Apply for that role", "Share your idea"],
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
    ]
    return tasks, variant


async def generate_daily_tasks(settings: Settings, body: DailyTasksBody) -> tuple[list[Task], str]:
    palm = body.palm_analysis
    premium = body.is_premium
    fallback = _deterministic_tasks(palm, premium)

    client = groq_client(settings)
    if client is None:
        return fallback
    payload = {
        "traits": palm.traits,
        "personality": palm.personality,
        "life_line": palm.life_line,
        "heart_line": palm.heart_line,
        "head_line": palm.head_line,
        "premium": premium,
    }
    try:
        completion = await client.chat.completions.create(
            model=settings.groq_chat_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": TASK_SYSTEM},
                {"role": "user", "content": json.dumps(payload)},
            ],
            temperature=0.85,
        )
        raw = completion.choices[0].message.content or "{}"
        data = json.loads(raw)
        raw_tasks = data.get("tasks") or []
        if len(raw_tasks) < 3:
            return fallback
        try:
            tasks = [Task.model_validate(t) for t in raw_tasks[:3]]
        except Exception:
            return fallback
        variant = "premium_predictions" if premium else "standard"
        return tasks, variant
    except Exception:
        return fallback

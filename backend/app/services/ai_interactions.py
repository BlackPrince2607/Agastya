"""Groq-backed conversational guide + deterministic safety nets."""

from __future__ import annotations

import json

from app.config import Settings
from app.services.llm_client import groq_client
from app.prompts.templates import CHAT_SYSTEM, TASK_SYSTEM
from app.schemas.chat import ChatRequest
from app.schemas.palm import PalmAnalysis
from app.schemas.tasks import DailyTasksBody


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


async def generate_chat_reply(settings: Settings, body: ChatRequest) -> str:
    if not body.is_premium and len(body.messages) > 10:
        return (
            "You've reached the luminous preview ceiling—unlock unlimited guide transmissions "
            "to continue this thread without interruption."
        )

    palm_json = json.dumps(body.palm_analysis.model_dump())
    context = (
        f"USER_PROFILE:\n{body.profile_summary}\n\n"
        f"PALM_JSON:\n{palm_json}\n\n"
        "Answer as Agastya."
    )

    client = groq_client(settings)
    if client is None:
        return _heuristic_chat(body)
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
            max_tokens=420,
        )
        text = completion.choices[0].message.content or ""
        return text.strip() or _heuristic_chat(body)
    except Exception:
        return _heuristic_chat(body)


def _deterministic_tasks(palm: PalmAnalysis, premium: bool) -> tuple[list[str], str]:
    traits = ", ".join(palm.traits)
    variant = "premium_predictions" if premium else "standard"
    if premium:
        tasks = [
            f"Take one luminous risk today that aligns with your {palm.personality} motif ({traits}).",
            "Reach out to someone you've been quietly avoiding — send one honest sentence.",
            (
                "Synchronicity sweep: before dusk, jot two 'impossible coincidences' that nudged you—"
                "Agastya reads the pattern tomorrow."
            ),
        ]
    else:
        tasks = [
            f"Take one uncomfortable action today that honors your {palm.personality} pulse.",
            "Reach out to someone you've been quietly avoiding — send one honest sentence.",
            "Rename one fear aloud so your nervous system stops negotiating alone.",
        ]
    return tasks, variant


async def generate_daily_tasks(settings: Settings, body: DailyTasksBody) -> tuple[list[str], str]:
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
        tasks = data.get("tasks") or []
        if len(tasks) < 3:
            return fallback
        variant = "premium_predictions" if premium else "standard"
        return tasks[:3], variant
    except Exception:
        return fallback

"""AI interaction fallback behavior tests."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.config import get_settings
from app.schemas.chat import ChatRequest, ChatTurn
from app.schemas.palm import PalmAnalysis
from app.services.ai_interactions import generate_chat_reply, generate_daily_tasks
from app.schemas.tasks import DailyTasksBody


def _palm() -> PalmAnalysis:
    return PalmAnalysis(
        life_line="strong",
        heart_line="curved",
        head_line="long",
        personality="seeker",
        traits=["thoughtful", "resilient"],
    )


def _chat_body() -> ChatRequest:
    return ChatRequest(
        session_id="00000000-0000-4000-8000-000000000001",
        device_install_id="device-test",
        messages=[ChatTurn(role="user", content="What does my heart line mean?")],
        palm_analysis=_palm(),
        profile_summary="Name: Test",
    )


def test_chat_uses_llm_when_available(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    get_settings.cache_clear()
    settings = get_settings()

    completion = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    content='Your heart line arcs with warmth.\nSUGGESTIONS: ["More?"]'
                )
            )
        ]
    )

    async def run():
        with patch(
            "app.services.ai_interactions.llm_chat_completion",
            new_callable=AsyncMock,
            return_value=completion,
        ):
            return await generate_chat_reply(settings, _chat_body(), server_is_premium=True)

    reply, suggestions = asyncio.run(run())
    assert "heart line" in reply.lower()
    assert suggestions == ["More?"]


def test_chat_falls_back_when_llm_unavailable(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    get_settings.cache_clear()
    settings = get_settings()

    async def run():
        with patch(
            "app.services.ai_interactions.llm_chat_completion",
            new_callable=AsyncMock,
            return_value=None,
        ):
            return await generate_chat_reply(settings, _chat_body(), server_is_premium=True)

    reply, suggestions = asyncio.run(run())
    assert len(reply) > 10
    assert len(suggestions) >= 1


def test_daily_tasks_fall_back_when_llm_unavailable(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    get_settings.cache_clear()
    settings = get_settings()
    body = DailyTasksBody(
        session_id="00000000-0000-4000-8000-000000000001",
        device_install_id="device-test",
        palm_analysis=_palm(),
        is_premium=False,
    )

    async def run():
        with patch(
            "app.services.ai_interactions.llm_chat_completion",
            new_callable=AsyncMock,
            return_value=None,
        ):
            return await generate_daily_tasks(settings, body)

    tasks, variant, focus_theme, _changed = asyncio.run(run())
    assert len(tasks) == 3
    assert focus_theme in {"career", "love", "money", "growth"}
    assert variant.startswith("focus:")

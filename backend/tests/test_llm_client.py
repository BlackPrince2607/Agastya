"""OpenRouter LLM client tests."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.config import get_settings
from app.services.llm_client import llm_chat_completion


def test_llm_chat_completion_returns_none_without_key(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    get_settings.cache_clear()
    settings = get_settings()
    result = asyncio.run(
        llm_chat_completion(
            settings,
            model="openai/gpt-4o-mini",
            messages=[{"role": "user", "content": "hi"}],
        )
    )
    assert result is None


def test_llm_chat_completion_retries_then_succeeds(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    get_settings.cache_clear()
    settings = get_settings()

    mock_client = MagicMock()
    fail_exc = Exception("rate limit")
    fail_exc.status_code = 429
    ok_response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="hello"))]
    )

    mock_create = AsyncMock(side_effect=[fail_exc, ok_response])
    mock_client.chat.completions.create = mock_create

    async def run() -> object:
        with patch("app.services.llm_client.openrouter_client", return_value=mock_client):
            with patch("app.services.llm_client.asyncio.sleep", new_callable=AsyncMock):
                return await llm_chat_completion(
                    settings,
                    model="openai/gpt-4o-mini",
                    messages=[{"role": "user", "content": "hi"}],
                )

    result = asyncio.run(run())
    assert result is ok_response
    assert mock_create.await_count == 2


def test_llm_chat_completion_does_not_retry_none_status(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    get_settings.cache_clear()
    settings = get_settings()

    mock_client = MagicMock()
    fail_exc = Exception("sdk bug")
    # no status_code attribute
    mock_create = AsyncMock(side_effect=fail_exc)
    mock_client.chat.completions.create = mock_create

    async def run() -> object:
        with patch("app.services.llm_client.openrouter_client", return_value=mock_client):
            with patch("app.services.llm_client.asyncio.sleep", new_callable=AsyncMock) as sleep:
                result = await llm_chat_completion(
                    settings,
                    model="openai/gpt-4o-mini",
                    messages=[{"role": "user", "content": "hi"}],
                )
                sleep.assert_not_awaited()
                return result

    assert asyncio.run(run()) is None
    assert mock_create.await_count == 1


def test_llm_chat_completion_does_not_retry_timeout(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    get_settings.cache_clear()
    settings = get_settings()

    mock_client = MagicMock()
    mock_create = AsyncMock(side_effect=TimeoutError())
    mock_client.chat.completions.create = mock_create

    async def run() -> object:
        with patch("app.services.llm_client.openrouter_client", return_value=mock_client):
            with patch("app.services.llm_client.asyncio.sleep", new_callable=AsyncMock) as sleep:
                result = await llm_chat_completion(
                    settings,
                    model="openai/gpt-4o-mini",
                    messages=[{"role": "user", "content": "hi"}],
                    timeout_seconds=1.0,
                )
                sleep.assert_not_awaited()
                return result

    assert asyncio.run(run()) is None
    assert mock_create.await_count == 1

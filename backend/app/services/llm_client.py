"""Groq chat completions via OpenAI-compatible API."""

from __future__ import annotations

from openai import AsyncOpenAI

from app.config import Settings

GROQ_BASE_URL = "https://api.groq.com/openai/v1"


def groq_client(settings: Settings) -> AsyncOpenAI | None:
    if not settings.groq_api_key:
        return None
    return AsyncOpenAI(
        api_key=settings.groq_api_key,
        base_url=GROQ_BASE_URL,
    )

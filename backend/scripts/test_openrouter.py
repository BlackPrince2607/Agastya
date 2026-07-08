"""Smoke test OpenRouter text + vision — run from backend/: python scripts/test_openrouter.py"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Allow `python scripts/test_openrouter.py` from backend/
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings
from app.services.llm_client import llm_chat_completion

# 1x1 red PNG
_TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


async def main() -> int:
    get_settings.cache_clear()
    settings = get_settings()
    if not settings.llm_enabled:
        print("FAIL: OPENROUTER_API_KEY not set")
        return 1

    print("llm_enabled", settings.llm_enabled)
    print("chat_model", settings.openrouter_chat_model)
    print("vision_model", settings.openrouter_vision_model)

    completion = await llm_chat_completion(
        settings,
        model=settings.openrouter_chat_model,
        messages=[{"role": "user", "content": "Say hi in 3 words"}],
        max_tokens=20,
    )
    if completion is None:
        print("FAIL: text completion returned None")
        return 1
    print("text OK:", (completion.choices[0].message.content or "").strip())

    vision = await llm_chat_completion(
        settings,
        model=settings.openrouter_vision_model,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe this image in one word."},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{_TINY_PNG_B64}"},
                    },
                ],
            }
        ],
        max_tokens=20,
        timeout_seconds=settings.openrouter_vision_timeout_seconds,
    )
    if vision is None:
        print("FAIL: vision completion returned None")
        print("Tip: set OPENROUTER_VISION_MODEL=openai/gpt-4o-mini in backend/.env")
        print("      (openai/gpt-4o-vision is NOT a valid OpenRouter model ID)")
        return 1
    print("vision OK:", (vision.choices[0].message.content or "").strip())
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

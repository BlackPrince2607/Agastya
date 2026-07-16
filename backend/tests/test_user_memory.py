"""User memory extraction and merge tests."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.config import get_settings
from app.services.bucket_store import SessionBucket
from app.services.user_memory import (
    continue_hint_from_memory,
    maybe_extract_and_merge_memory,
    memory_looks_factful,
    merge_extracted_facts,
    prune_user_memory,
    stamp_reflection_completed,
)
from app.services.daily_insight import store_daily_context
from app.services.day_context import utc_today_iso


def test_memory_looks_factful_gates_fluff():
    assert memory_looks_factful("hi") is False
    assert memory_looks_factful("I have an interview tomorrow about a new role") is True


def test_merge_and_continue_hint():
    bkt = SessionBucket()
    changed = merge_extracted_facts(
        bkt,
        [{"text": "Has an interview tomorrow", "layer": "temporary", "expiresInDays": 2}],
    )
    assert changed is True
    assert continue_hint_from_memory(bkt) == "Has an interview tomorrow"
    # Dedupe
    assert merge_extracted_facts(
        bkt,
        [{"text": "Has an interview tomorrow", "layer": "temporary", "expiresInDays": 2}],
    ) is False


def test_prune_expired_temporary():
    bkt = SessionBucket(
        user_memory={
            "journey": [],
            "temporary": [
                {
                    "id": "1",
                    "text": "Old exam stress",
                    "expires_at": "2020-01-01T00:00:00+00:00",
                    "status": "active",
                }
            ],
        }
    )
    pruned = prune_user_memory(bkt.user_memory)
    assert pruned["temporary"] == []


def test_extract_merges_via_llm(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    get_settings.cache_clear()
    settings = get_settings()
    bkt = SessionBucket()
    completion = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    content='{"facts":[{"text":"Preparing for campus placements","layer":"temporary","expiresInDays":10}]}'
                )
            )
        ]
    )

    async def run():
        with patch(
            "app.services.user_memory.llm_chat_completion",
            new_callable=AsyncMock,
            return_value=completion,
        ):
            return await maybe_extract_and_merge_memory(
                settings, bkt, "I am busy with placements this month"
            )

    assert asyncio.run(run()) is True
    assert "placements" in (continue_hint_from_memory(bkt) or "").lower()


def test_stamp_reflection_works_without_complete_guidance():
    bkt = SessionBucket()
    assert stamp_reflection_completed(bkt) is True
    assert bkt.daily_context["reflection"]["completed"] is True
    assert bkt.daily_context["date"] == utc_today_iso()
    # Reflection must not pollute journey memory.
    assert prune_user_memory(bkt.user_memory)["journey"] == []


def test_stamp_reflection_preserves_complete_chapter():
    bkt = SessionBucket()
    store_daily_context(
        bkt,
        title="T",
        body="B",
        focus_theme="growth",
        source="llm",
    )
    assert stamp_reflection_completed(bkt, note="mood steady") is True
    assert bkt.daily_context["reflection"]["completed"] is True
    assert bkt.daily_context["guidance"]["title"] == "T"
    assert bkt.daily_context["date"] == utc_today_iso()
    assert bkt.daily_context["reflection"]["note"] == "mood steady"
    assert prune_user_memory(bkt.user_memory)["journey"] == []


def test_prune_strips_reflection_spam_from_journey():
    bkt = SessionBucket(
        user_memory={
            "journey": [
                {"id": "1", "text": "Completed evening reflection on 2026-07-01"},
                {"id": "2", "text": "Building a long-term career in design"},
            ],
            "temporary": [],
        }
    )
    pruned = prune_user_memory(bkt.user_memory)
    assert len(pruned["journey"]) == 1
    assert "career" in pruned["journey"][0]["text"].lower()


def test_temporary_supersede_archives_same_family():
    bkt = SessionBucket()
    merge_extracted_facts(
        bkt,
        [{"text": "Interview at Acme on Monday", "layer": "temporary", "expiresInDays": 10}],
    )
    merge_extracted_facts(
        bkt,
        [{"text": "Interview loop moved to Friday", "layer": "temporary", "expiresInDays": 5}],
    )
    temps = prune_user_memory(bkt.user_memory)["temporary"]
    assert len(temps) == 1
    assert "Friday" in temps[0]["text"]

"""Focus theme rotation, temporary override, and guidance/ritual alignment."""

import asyncio
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.config import get_settings
from app.schemas.palm import PalmAnalysis
from app.schemas.tasks import DailyTasksBody
from app.services.ai_interactions import generate_daily_tasks
from app.services.bucket_store import SessionBucket
from app.services.daily_insight import store_daily_context
from app.services.day_context import pick_focus_theme, resolve_today_focus_theme, utc_today_iso


def _palm() -> PalmAnalysis:
    return PalmAnalysis(
        life_line="strong",
        heart_line="curved",
        head_line="long",
        personality="seeker",
        traits=["thoughtful", "resilient"],
    )


def test_temporary_override_beats_topic_rotation():
    theme = pick_focus_theme(
        ["love", "career", "growth"],
        [{"text": "Interview tomorrow for a new role"}],
        day=date(2026, 7, 16),
    )
    assert theme == "career"


def test_rotates_among_onboarding_themes_by_day():
    topics = ["career", "love", "growth"]
    seen = {
        pick_focus_theme(topics, [], day=date(2026, 7, 13)),
        pick_focus_theme(topics, [], day=date(2026, 7, 14)),
        pick_focus_theme(topics, [], day=date(2026, 7, 15)),
    }
    assert seen == {"career", "love", "growth"}


def test_single_topic_stays_stable_without_temporary():
    assert pick_focus_theme(["money"], [], day=date(2026, 7, 16)) == "money"
    assert pick_focus_theme(["money"], [], day=date(2026, 7, 17)) == "money"


def test_resolve_theme_prefers_complete_daily_context():
    ctx = {
        "date": utc_today_iso(),
        "guidance": {"title": "T", "body": "B"},
        "focusTheme": "money",
        "source": "llm",
    }
    assert resolve_today_focus_theme(ctx, ["career", "love"], []) == "money"


def test_tasks_reuse_guidance_locked_theme(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    get_settings.cache_clear()
    settings = get_settings()
    bkt = SessionBucket(palm=_palm(), meta={"focusTopics": ["career"]})
    store_daily_context(
        bkt,
        title="Money Day",
        body="Blueprint money thread.",
        focus_theme="money",
        source="llm",
    )
    body = DailyTasksBody(
        session_id="00000000-0000-4000-8000-000000000001",
        device_install_id="device-test",
        palm_analysis=_palm(),
        focus_topics=["career"],
        is_premium=True,
    )

    completion = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    content='{"focusTheme":"career","tasks":[{"id":"a","text":"A","description":"d","category":"money","estimatedMinutes":5,"difficulty":"easy","examples":["x"]},{"id":"b","text":"B","description":"d","category":"money","estimatedMinutes":5,"difficulty":"easy","examples":["x"]},{"id":"c","text":"C","description":"d","category":"growth","estimatedMinutes":5,"difficulty":"easy","examples":["x"]}]}'
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
            return await generate_daily_tasks(settings, body, bkt)

    tasks, variant, theme, changed = asyncio.run(run())
    assert theme == "money"
    assert variant == "focus:money"
    assert len(tasks) == 3
    assert changed is True

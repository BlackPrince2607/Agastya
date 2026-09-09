"""Today's Guidance caching, soft retry, and focusTheme lock tests."""

import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.config import get_settings
from app.schemas.guidance import DailyGuidanceBody
from app.schemas.palm import PalmAnalysis
from app.services.bucket_store import SessionBucket
from app.services.daily_insight import generate_daily_guidance, store_daily_context
from app.services.day_context import resolve_today_focus_theme, utc_today_iso


def _palm() -> PalmAnalysis:
    return PalmAnalysis(
        life_line="strong",
        heart_line="curved",
        head_line="long",
        personality="seeker",
        traits=["thoughtful", "resilient"],
    )


def _body() -> DailyGuidanceBody:
    return DailyGuidanceBody(
        session_id="00000000-0000-4000-8000-000000000001",
        device_install_id="device-test",
        palm_analysis=_palm(),
        focus_topics=["career"],
        streak=3,
    )


def test_guidance_returns_cache_on_same_day_without_mutation(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    get_settings.cache_clear()
    settings = get_settings()
    bkt = SessionBucket(palm=_palm())
    store_daily_context(
        bkt,
        title="Cached Title",
        body="Cached body from Life Blueprint.",
        focus_theme="career",
        source="llm",
    )
    before = dict(bkt.daily_context)

    async def run():
        with patch(
            "app.services.daily_insight.llm_chat_completion",
            new_callable=AsyncMock,
        ) as mock_llm:
            result, changed = await generate_daily_guidance(settings, _body(), bkt)
            mock_llm.assert_not_called()
            return result, changed

    result, changed = asyncio.run(run())
    assert result.cached is True
    assert changed is False
    assert result.title == "Cached Title"
    assert result.date == utc_today_iso()
    assert bkt.daily_context == before


def test_guidance_fallback_is_soft_retryable(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    get_settings.cache_clear()
    settings = get_settings()
    bkt = SessionBucket(palm=_palm())
    store_daily_context(
        bkt,
        title="Fallback",
        body="Deterministic body.",
        focus_theme="career",
        source="fallback",
        fallback_attempts=1,
    )
    # Force last attempt into the past so soft retry opens.
    bkt.daily_context["lastAttemptAt"] = (datetime.now(timezone.utc) - timedelta(minutes=20)).isoformat()

    completion = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    content='{"title":"Recovered","body":"Your thoughtful seeker Blueprint asks for one career step."}'
                )
            )
        ]
    )

    async def run():
        with patch(
            "app.services.daily_insight.llm_chat_completion",
            new_callable=AsyncMock,
            return_value=completion,
        ):
            return await generate_daily_guidance(settings, _body(), bkt)

    result, changed = asyncio.run(run())
    assert changed is True
    assert result.title == "Recovered"
    assert bkt.daily_context["source"] == "llm"
    assert result.focus_theme == "career"


def test_guidance_locks_focus_theme_ignoring_llm(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    get_settings.cache_clear()
    settings = get_settings()
    bkt = SessionBucket(palm=_palm())
    completion = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    content='{"title":"Steady Path","body":"Your seeker traits ask for one clear step today.","focusTheme":"love"}'
                )
            )
        ]
    )

    async def run():
        with patch(
            "app.services.daily_insight.llm_chat_completion",
            new_callable=AsyncMock,
            return_value=completion,
        ):
            return await generate_daily_guidance(settings, _body(), bkt)

    result, changed = asyncio.run(run())
    assert changed is True
    assert result.focus_theme == "career"
    assert bkt.daily_context["focusTheme"] == "career"


def test_guidance_falls_back_when_llm_unavailable(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    get_settings.cache_clear()
    settings = get_settings()
    bkt = SessionBucket(palm=_palm())

    async def run():
        with patch(
            "app.services.daily_insight.llm_chat_completion",
            new_callable=AsyncMock,
            return_value=None,
        ):
            return await generate_daily_guidance(settings, _body(), bkt)

    result, changed = asyncio.run(run())
    assert changed is True
    assert result.cached is False
    assert bkt.daily_context["source"] == "fallback"
    assert bkt.daily_context["date"] == utc_today_iso()
    assert "guidance" in bkt.daily_context and bkt.daily_context["guidance"]["title"]


def test_resolve_theme_prefers_complete_daily_context():
    ctx = {
        "date": utc_today_iso(),
        "guidance": {"title": "T", "body": "B"},
        "focusTheme": "money",
        "source": "llm",
    }
    assert resolve_today_focus_theme(ctx, ["career"], []) == "money"


def test_recent_chapters_archives_previous_day():
    bkt = SessionBucket(palm=_palm())
    bkt.daily_context = {
        "date": "2026-07-14",
        "guidance": {"title": "Quiet Strength", "body": "Hold one honest boundary today."},
        "focusTheme": "career",
        "reflection": {"completed": True, "note": "Felt steady"},
        "source": "llm",
        "recentChapters": [],
    }
    store_daily_context(
        bkt,
        title="New Day",
        body="A fresh step on the Blueprint.",
        focus_theme="love",
        source="llm",
    )
    recent = bkt.daily_context.get("recentChapters") or []
    assert len(recent) == 1
    assert recent[0]["date"] == "2026-07-14"
    assert recent[0]["title"] == "Quiet Strength"
    assert recent[0]["focusTheme"] == "career"
    assert recent[0]["reflectionSummary"] == "Felt steady"
    assert bkt.daily_context["date"] == utc_today_iso()


def test_daily_bundle_returns_cached_guidance_and_tasks(monkeypatch):
    from app.schemas.guidance import DailyBundleBody
    from app.schemas.tasks import Task
    from app.services.ai_interactions import _store_tasks_cache
    from app.services.daily_insight import generate_daily_bundle

    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    get_settings.cache_clear()
    settings = get_settings()
    bkt = SessionBucket(palm=_palm())
    store_daily_context(
        bkt,
        title="Cached Title",
        body="Cached body from Life Blueprint.",
        focus_theme="career",
        source="llm",
    )
    tasks = [
        Task(id="career-clarity", text="A", description="B", category="career", estimatedMinutes=10),
        Task(id="career-signal", text="C", description="D", category="career", estimatedMinutes=10),
        Task(id="evening-reflection", text="E", description="F", category="growth", estimatedMinutes=5),
    ]
    _store_tasks_cache(bkt, utc_today_iso(), "career", "focus:career", tasks, source="llm")

    body = DailyBundleBody(
        session_id="00000000-0000-4000-8000-000000000001",
        device_install_id="device-test",
        palm_analysis=_palm(),
        focus_topics=["career"],
        streak=1,
        is_premium=True,
    )

    async def run():
        with patch("app.services.daily_insight.llm_chat_completion", new_callable=AsyncMock) as mock_llm:
            with patch("app.services.ai_interactions.llm_chat_completion", new_callable=AsyncMock) as mock_tasks:
                result, changed = await generate_daily_bundle(settings, body, bkt)
                mock_llm.assert_not_called()
                mock_tasks.assert_not_called()
                return result, changed

    result, changed = asyncio.run(run())
    assert changed is False
    assert result.guidance.title == "Cached Title"
    assert result.tasks_cached is True
    assert len(result.tasks) >= 3
    assert result.focus_theme == "career"


def test_deterministic_predictions_include_beats():
    from app.services.predictions_engine import deterministic_predictions

    palm = PalmAnalysis(
        life_line="strong",
        heart_line="curved",
        head_line="long",
        personality="seeker",
        traits=["thoughtful"],
        fate_line="not_clearly_visible",
        analysis_source="openrouter_vision",
        geometry_source="vision_model",
        line_geometry=[
            {"name": "life_line", "points": [{"x": 0.2, "y": 0.3}, {"x": 0.3, "y": 0.6}]},
            {"name": "heart_line", "points": [{"x": 0.2, "y": 0.25}, {"x": 0.7, "y": 0.28}]},
            {"name": "head_line", "points": [{"x": 0.25, "y": 0.4}, {"x": 0.7, "y": 0.42}]},
        ],
    )
    out = deterministic_predictions(seed="unit", period="month", palm=palm)
    assert len(out.items) == 4
    assert out.items[0].insight
    assert len(out.items[0].beats) >= 2

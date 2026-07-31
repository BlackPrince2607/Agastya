"""Weekly summary and journey timeline tests."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.config import get_settings
from app.schemas.guidance import WeeklySummaryBody
from app.schemas.palm import PalmAnalysis
from app.services.bucket_store import SessionBucket
from app.services.day_context import utc_week_key
from app.services.journey_timeline import build_journey_timeline
from app.services.weekly_insight import generate_weekly_summary, store_weekly_context


def _palm() -> PalmAnalysis:
    return PalmAnalysis(
        life_line="strong",
        heart_line="curved",
        head_line="long",
        personality="seeker",
        traits=["thoughtful", "resilient"],
    )


def test_weekly_cache_hit_no_mutation():
    bkt = SessionBucket(palm=_palm())
    store_weekly_context(bkt, title="Week Title", body="Week body grounded in Blueprint.", top_theme="career")
    before = dict(bkt.weekly_context)

    body = WeeklySummaryBody(
        session_id="00000000-0000-4000-8000-000000000001",
        device_install_id="device-test",
        palm_analysis=_palm(),
    )

    async def run():
        with patch(
            "app.services.weekly_insight.llm_chat_completion",
            new_callable=AsyncMock,
        ) as mock_llm:
            result, changed = await generate_weekly_summary(get_settings(), body, bkt)
            mock_llm.assert_not_called()
            return result, changed

    result, changed = asyncio.run(run())
    assert changed is False
    assert result.cached is True
    assert result.week_key == utc_week_key()
    assert bkt.weekly_context == before


def test_journey_timeline_includes_blueprint_and_streak():
    bkt = SessionBucket(
        palm=_palm(),
        meta={"blueprintCreatedAt": "2026-01-01T00:00:00+00:00", "focusTopics": ["career"]},
    )
    timeline = build_journey_timeline(bkt, streak=5, rituals_completed_total=12)
    labels = [i.label for i in timeline.items]
    assert "Life Blueprint created" in labels
    assert any("consistency" in l.lower() for l in labels)
    assert "Completed 10 rituals" in labels


def test_journey_timeline_blueprint_without_created_at():
    bkt = SessionBucket(palm=_palm(), meta={"focusTopics": ["growth"]})
    timeline = build_journey_timeline(bkt)
    assert timeline.items[0].label == "Life Blueprint created"
    assert timeline.items[0].at is None


def test_ensure_reflection_task_pads_to_three():
    from app.services.reflection_task import ensure_reflection_task, EVENING_REFLECTION
    from app.schemas.tasks import Task

    one = [
        Task(
            id="only",
            text="Only",
            description="d",
            category="growth",
            estimatedMinutes=5,
            difficulty="easy",
            examples=[],
        )
    ]
    out = ensure_reflection_task(one)
    assert len(out) == 3
    assert out[-1].id == EVENING_REFLECTION.id


def test_ensure_reflection_preserves_varied_copy():
    from app.services.reflection_task import ensure_reflection_task
    from app.schemas.tasks import Task

    tasks = [
        Task(
            id="a",
            text="A",
            description="d",
            category="career",
            estimatedMinutes=5,
            difficulty="easy",
            examples=["x"],
        ),
        Task(
            id="b",
            text="B",
            description="d",
            category="career",
            estimatedMinutes=5,
            difficulty="easy",
            examples=["x"],
        ),
        Task(
            id="evening-reflection",
            text="Close the day gently",
            description="What shifted in your career thread today?",
            category="growth",
            estimatedMinutes=5,
            difficulty="easy",
            examples=["Mood", "Energy"],
        ),
    ]
    out = ensure_reflection_task(tasks)
    assert out[-1].id == "evening-reflection"
    assert out[-1].text == "Close the day gently"
    assert "career thread" in out[-1].description


def test_weekly_includes_current_chapter(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    get_settings.cache_clear()
    settings = get_settings()
    bkt = SessionBucket(palm=_palm())
    bkt.daily_context = {
        "date": "2026-07-14",
        "guidance": {"title": "Steady Path", "body": "One career step."},
        "focusTheme": "career",
        "recentChapters": [
            {
                "date": "2026-07-13",
                "title": "Quiet Focus",
                "body": "Hold your boundary.",
                "focusTheme": "career",
                "reflectionSummary": "Felt clear",
            }
        ],
        "source": "llm",
    }
    body = WeeklySummaryBody(
        session_id="00000000-0000-4000-8000-000000000001",
        device_install_id="device-test",
        palm_analysis=_palm(),
        focus_topics=["career", "love"],
        streak=4,
        rituals_completed_total=8,
    )
    completion = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    content=(
                        '{"title":"Chapter of Momentum","body":"This week your career thread sharpened. '
                        "Your seeker Blueprint stayed close. Next week keep relationships warm too.\","
                        '"currentChapter":"This week your Blueprint is expressing itself through Career Growth."}'
                    )
                )
            )
        ]
    )

    async def run():
        with patch(
            "app.services.weekly_insight.llm_chat_completion",
            new_callable=AsyncMock,
            return_value=completion,
        ):
            return await generate_weekly_summary(settings, body, bkt)

    result, changed = asyncio.run(run())
    assert changed is True
    assert result.current_chapter
    assert "Career" in (result.current_chapter or "")
    assert bkt.weekly_context["currentChapter"] == result.current_chapter
    assert result.source == "llm"


def test_weekly_fallback_is_soft_retryable(monkeypatch):
    from datetime import datetime, timedelta, timezone

    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    get_settings.cache_clear()
    settings = get_settings()
    bkt = SessionBucket(palm=_palm())
    store_weekly_context(
        bkt,
        title="Fallback week",
        body="Deterministic weekly body.",
        top_theme="career",
        source="fallback",
        fallback_attempts=1,
    )
    # Force last attempt into the past so soft retry opens.
    assert isinstance(bkt.weekly_context, dict)
    bkt.weekly_context["lastAttemptAt"] = (
        datetime.now(timezone.utc) - timedelta(minutes=20)
    ).isoformat()

    body = WeeklySummaryBody(
        session_id="00000000-0000-4000-8000-000000000001",
        device_install_id="device-test",
        palm_analysis=_palm(),
        focus_topics=["career"],
    )
    completion = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    content='{"title":"Recovered Week","body":"LLM recovered after outage.","currentChapter":"Career"}'
                )
            )
        ]
    )

    async def run():
        with patch(
            "app.services.weekly_insight.llm_chat_completion",
            new_callable=AsyncMock,
            return_value=completion,
        ) as mock_llm:
            result, changed = await generate_weekly_summary(settings, body, bkt)
            mock_llm.assert_awaited()
            return result, changed

    result, changed = asyncio.run(run())
    assert changed is True
    assert result.source == "llm"
    assert result.title == "Recovered Week"
    assert bkt.weekly_context["source"] == "llm"

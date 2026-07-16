"""Evening reflection ritual (always one of today's three rituals)."""

from app.schemas.tasks import Task

EVENING_REFLECTION = Task(
    id="evening-reflection",
    text="Evening reflection",
    description="How was today? Note your mood, energy, and one challenge in a few words.",
    category="growth",
    estimatedMinutes=5,
    difficulty="easy",
    examples=["Mood: steady / heavy / hopeful", "Energy: 1–10", "Challenge: one sentence"],
)

# Pads used only when generation returns fewer than two non-reflection rituals.
_PAD_TASKS = (
    Task(
        id="pad-gratitude",
        text="Practice gratitude",
        description="Write down three things you are grateful for today.",
        category="growth",
        estimatedMinutes=5,
        difficulty="easy",
        examples=["A person who helped you", "A small win", "Something you often overlook"],
    ),
    Task(
        id="pad-bold-step",
        text="Take a bold step",
        description="Do something today that scares you a little but moves you forward.",
        category="career",
        estimatedMinutes=15,
        difficulty="medium",
        examples=["Start that conversation", "Apply for that role", "Share your idea"],
    ),
)


def ensure_reflection_task(tasks: list[Task]) -> list[Task]:
    """Keep exactly 3 tasks with evening-reflection as the last.

    Preserve LLM-varied reflection title/description when present; fall back to static copy.
    """
    others = [t for t in tasks if t.id != "evening-reflection"][:2]
    for pad in _PAD_TASKS:
        if len(others) >= 2:
            break
        if all(t.id != pad.id for t in others):
            others.append(pad)

    generated = next((t for t in tasks if t.id == "evening-reflection"), None)
    if generated is None:
        reflection = EVENING_REFLECTION
    else:
        text = (generated.text or "").strip() or EVENING_REFLECTION.text
        description = (generated.description or "").strip() or EVENING_REFLECTION.description
        examples = generated.examples if generated.examples else EVENING_REFLECTION.examples
        reflection = generated.model_copy(
            update={
                "id": EVENING_REFLECTION.id,
                "text": text[:80],
                "description": description[:280],
                "category": generated.category or EVENING_REFLECTION.category,
                "estimatedMinutes": generated.estimated_minutes or EVENING_REFLECTION.estimated_minutes,
                "difficulty": generated.difficulty or EVENING_REFLECTION.difficulty,
                "examples": examples[:4],
            }
        )
    return [*others[:2], reflection]

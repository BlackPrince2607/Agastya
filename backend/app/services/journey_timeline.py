"""Derive a lightweight Journey Timeline from existing session data."""

from __future__ import annotations

from app.schemas.guidance import JourneyTimelineItem, JourneyTimelineResponse
from app.services.bucket_store import SessionBucket, normalize_user_memory
from app.services.user_memory import prune_user_memory

_FOCUS_LABELS = {
    "career": "Career",
    "love": "Relationships",
    "money": "Money",
    "growth": "Personal growth",
    "matching": "Relationships",
}


def _sort_key(item: JourneyTimelineItem) -> str:
    return item.at or "0000"


def build_journey_timeline(
    bkt: SessionBucket,
    *,
    streak: int | None = None,
    rituals_completed_total: int | None = None,
) -> JourneyTimelineResponse:
    """Rule-based timeline — no extra LLM call."""
    bkt.user_memory = prune_user_memory(bkt.user_memory)
    mem = normalize_user_memory(bkt.user_memory)
    items: list[JourneyTimelineItem] = []

    created = bkt.meta.get("blueprintCreatedAt")
    if bkt.palm:
        items.append(
            JourneyTimelineItem(
                id="blueprint",
                label="Life Blueprint created",
                detail=f"Your palm reading established a {bkt.palm.personality} identity.",
                at=str(created) if created else None,
            )
        )

    topics = bkt.meta.get("focusTopics") or []
    if isinstance(topics, list) and topics:
        primary = str(topics[0])
        label = _FOCUS_LABELS.get(primary.lower(), primary.replace("_", " ").title())
        items.append(
            JourneyTimelineItem(
                id="focus",
                label=f"{label} became a primary focus",
                detail="This shapes Today's Guidance and your rituals.",
                at=None,
            )
        )

    if rituals_completed_total is not None and rituals_completed_total >= 10:
        items.append(
            JourneyTimelineItem(
                id="rituals-10",
                label="Completed 10 rituals",
                detail="Consistency is becoming part of your journey.",
                at=None,
            )
        )
    if rituals_completed_total is not None and rituals_completed_total >= 30:
        items.append(
            JourneyTimelineItem(
                id="rituals-30",
                label="Completed 30 rituals",
                detail="Your daily practice is building real momentum.",
                at=None,
            )
        )

    if streak is not None and streak >= 3:
        items.append(
            JourneyTimelineItem(
                id="streak",
                label=f"{streak}-day consistency streak",
                detail="You are showing up for yourself regularly.",
                at=None,
            )
        )

    for fact in mem.get("journey") or []:
        if not isinstance(fact, dict):
            continue
        text = str(fact.get("text") or "").strip()
        if not text:
            continue
        if text.lower().startswith("completed evening reflection"):
            items.append(
                JourneyTimelineItem(
                    id=str(fact.get("id") or text[:20]),
                    label="Evening reflection",
                    detail=text,
                    at=str(fact.get("created_at") or "") or None,
                )
            )
            continue
        if any(k in text.lower() for k in ("interview", "exam", "placement", "launch")):
            items.append(
                JourneyTimelineItem(
                    id=str(fact.get("id") or text[:20]),
                    label="Prepared for what's ahead",
                    detail=text,
                    at=str(fact.get("created_at") or "") or None,
                )
            )

    for fact in reversed(mem.get("journey") or []):
        if not isinstance(fact, dict):
            continue
        text = str(fact.get("text") or "").strip()
        if not text or text.lower().startswith("completed evening reflection"):
            continue
        if any(k in text.lower() for k in ("interview", "exam", "placement", "launch")):
            continue
        items.append(
            JourneyTimelineItem(
                id=str(fact.get("id") or text[:20]),
                label="Journey note",
                detail=text,
                at=str(fact.get("created_at") or "") or None,
            )
        )
        if sum(1 for i in items if i.id.startswith("journey-") or i.label == "Journey note") >= 3:
            break

    # Stable order: dated events first (newest), then undated milestones.
    dated = sorted([i for i in items if i.at], key=_sort_key, reverse=True)
    undated = [i for i in items if not i.at]
    ordered = dated + undated
    return JourneyTimelineResponse(items=ordered[:12])

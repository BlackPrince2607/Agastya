"""Send push notifications via Expo Push API (FCM/APNs)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
BATCH_SIZE = 100

# Event type → (title, body, screen deep link)
PUSH_EVENTS: dict[str, tuple[str, str, str]] = {
    "reading_ready": (
        "Your palm reading is ready",
        "Tap to open your report.",
        "/report",
    ),
    "premium_unlocked": (
        "Premium unlocked",
        "Your full Life Blueprint is ready.",
        "/report",
    ),
    "payment_pending": (
        "Purchase pending",
        "We're confirming your payment. Tap to check status.",
        "/onboarding/paywall",
    ),
    "full_report_ready": (
        "Full report ready",
        "Your complete Life Blueprint is available.",
        "/report",
    ),
    "compatibility_ready": (
        "Compatibility ready",
        "Your partner reading is ready to view.",
        "/report/compatibility",
    ),
    "onboarding_incomplete": (
        "Continue your reading",
        "Finish your palm scan to unlock your preview.",
        "/onboarding/palm-scan",
    ),
    "preview_unsigned": (
        "Save your reading",
        "Sign in to back up your palm reading to the cloud.",
        "/onboarding/account",
    ),
    "streak_at_risk": (
        "Don't break your streak",
        "Complete today's rituals before midnight.",
        "/(main)/tasks",
    ),
    "weekly_guidance": (
        "This week's guidance",
        "Your weekly journey insight is ready.",
        "/(main)/home",
    ),
    "reengage_3d": (
        "We miss you",
        "Your guide has something for you today.",
        "/(main)/home",
    ),
    "reengage_7d": (
        "Your reading awaits",
        "Come back and see what's new in your journey.",
        "/(main)/home",
    ),
    "reengage_14d": (
        "Still here for you",
        "Open Agastya for today's guidance.",
        "/(main)/home",
    ),
}


def _chunk(items: list[str], size: int) -> list[list[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


async def send_push(
    tokens: list[str],
    *,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
    priority: str = "high",
    sound: str = "default",
) -> list[str]:
    """
    Send Expo push messages. Returns list of tokens that should be disabled
    (DeviceNotRegistered / InvalidCredentials).
    """
    unique = [t.strip() for t in tokens if isinstance(t, str) and t.strip()]
    if not unique:
        return []

    invalid: list[str] = []
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        for batch in _chunk(unique, BATCH_SIZE):
            messages = [
                {
                    "to": token,
                    "title": title,
                    "body": body,
                    "data": data or {},
                    "priority": priority,
                    "sound": sound,
                }
                for token in batch
            ]
            try:
                res = await client.post(EXPO_PUSH_URL, headers=headers, json=messages)
            except Exception:
                logger.exception("expo push request failed")
                continue
            if res.status_code != 200:
                logger.warning("expo push HTTP %s: %s", res.status_code, res.text[:300])
                continue
            try:
                payload = res.json()
            except Exception:
                continue
            tickets = payload.get("data") if isinstance(payload, dict) else None
            if not isinstance(tickets, list):
                continue
            for token, ticket in zip(batch, tickets):
                if not isinstance(ticket, dict):
                    continue
                if ticket.get("status") == "error":
                    details = ticket.get("details") or {}
                    err = details.get("error") if isinstance(details, dict) else None
                    if err in {"DeviceNotRegistered", "InvalidCredentials"}:
                        invalid.append(token)
                    logger.info("expo push ticket error token=…%s err=%s", token[-8:], err)

    return invalid


async def send_push_event(
    tokens: list[str],
    event_type: str,
    *,
    settings: Settings | None = None,
    screen: str | None = None,
    title: str | None = None,
    body: str | None = None,
) -> int:
    """
    Send a named product event push. Returns number of tokens attempted.
    Best-effort: never raises to callers for Expo failures.
    """
    if settings is not None and not settings.notifications_enabled:
        return 0

    catalog = PUSH_EVENTS.get(event_type)
    if not catalog and not (title and body and screen):
        logger.warning("unknown push event_type=%s", event_type)
        return 0

    ev_title, ev_body, ev_screen = catalog if catalog else (title or "", body or "", screen or "/")
    final_title = title or ev_title
    final_body = body or ev_body
    final_screen = screen or ev_screen

    try:
        invalid = await send_push(
            tokens,
            title=final_title,
            body=final_body,
            data={"screen": final_screen, "event": event_type},
        )
    except Exception:
        logger.exception("send_push_event failed event=%s", event_type)
        return 0

    if invalid:
        try:
            from app.services import push_token_repository

            for token in invalid:
                await push_token_repository.disable_token(token, settings)
        except Exception:
            logger.exception("failed to disable invalid push tokens")

    return len([t for t in tokens if t])


async def notify_session(
    session_id: str,
    event_type: str,
    *,
    settings: Settings,
    event_key: str | None = None,
    supabase_user_id: str | None = None,
) -> int:
    """
    Resolve tokens for a session (and optionally user), dedupe if event_key set, send push.
    Returns messages attempted.
    """
    if not settings.notifications_enabled:
        return 0

    from app.services import push_token_repository

    if event_key and not await push_token_repository.claim_if_not_sent(
        session_id, event_type, event_key, settings
    ):
        return 0

    tokens = await push_token_repository.tokens_for_session(session_id, settings)
    if supabase_user_id:
        user_tokens = await push_token_repository.tokens_for_user(supabase_user_id, settings)
        seen = set(tokens)
        for t in user_tokens:
            if t not in seen:
                tokens.append(t)
                seen.add(t)

    if not tokens:
        return 0
    return await send_push_event(tokens, event_type, settings=settings)

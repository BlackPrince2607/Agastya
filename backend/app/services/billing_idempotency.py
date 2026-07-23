"""Idempotent billing webhook event tracking."""

from __future__ import annotations

import logging

from app.config import Settings
from app.services.supabase_rest import rest_client

logger = logging.getLogger(__name__)

TABLE = "billing_webhook_events"


async def claim_webhook_event(provider: str, event_id: str, settings: Settings) -> bool:
    """Return True if this event should be processed (first claim). False if duplicate.

    Fail closed when Supabase is enabled and the claim cannot be recorded.
    Without Supabase (local/dev), allow processing.
    """
    if not event_id or not str(event_id).strip():
        logger.warning("billing webhook missing event_id provider=%s", provider)
        if settings.supabase_enabled and not settings.debug:
            return False
        return True

    client = rest_client(settings)
    if client is None:
        if settings.supabase_enabled and not settings.debug:
            logger.error("billing_webhook_events claim failed — Supabase client unavailable")
            return False
        return True

    row = {"provider": provider, "event_id": str(event_id).strip()}
    headers = {
        **client._headers,
        "Prefer": "return=minimal",
    }
    try:
        from app.services.supabase_rest import _http_client

        res = await _http_client().post(
            f"{client._base}/{TABLE}",
            headers=headers,
            json=row,
        )
        if res.status_code in (200, 201, 204):
            return True
        if res.status_code == 409:
            return False
        body = (res.text or "").lower()
        if "duplicate" in body or "unique" in body or "23505" in body:
            return False
        logger.error(
            "billing_webhook_events insert failed: %s %s",
            res.status_code,
            res.text[:200],
        )
        # Fail closed when persistence is expected.
        if settings.supabase_enabled and not settings.debug:
            return False
        return True
    except Exception as exc:
        logger.error("billing_webhook_events claim error: %s", exc)
        if settings.supabase_enabled and not settings.debug:
            return False
        return True

"""Idempotent billing webhook event tracking with retry-safe states.

States:
  processing — claim held; handler is running
  processed  — handler finished successfully (or duplicate sibling sealed)
  failed     — handler failed; Razorpay/Play may retry and reclaim

Events are marked processed only after successful completion. Failed or stale
processing rows can be reclaimed so provider retries are not permanently dropped.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Literal

from app.config import Settings
from app.services.supabase_rest import rest_client

logger = logging.getLogger(__name__)

TABLE = "billing_webhook_events"

ClaimOutcome = Literal["process", "duplicate", "unavailable"]

# Reclaim in-flight claims older than this (crash / timeout recovery).
_STALE_PROCESSING = timedelta(minutes=5)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


async def begin_webhook_event(provider: str, event_id: str, settings: Settings) -> ClaimOutcome:
    """Acquire a processing claim. Return process | duplicate | unavailable."""
    if not event_id or not str(event_id).strip():
        logger.warning("billing webhook missing event_id provider=%s", provider)
        if settings.supabase_enabled and not settings.debug:
            return "unavailable"
        return "process"

    eid = str(event_id).strip()
    client = rest_client(settings)
    if client is None:
        if settings.supabase_enabled and not settings.debug:
            logger.error("billing_webhook_events begin failed — Supabase client unavailable")
            return "unavailable"
        return "process"

    now = _utcnow()
    row = {
        "provider": provider,
        "event_id": eid,
        "status": "processing",
        "processed_at": _iso(now),
        "updated_at": _iso(now),
    }
    headers = {
        **client._headers,
        "Prefer": "return=representation",
    }
    try:
        from app.services.supabase_rest import _http_client

        res = await _http_client().post(
            f"{client._base}/{TABLE}",
            headers=headers,
            json=row,
        )
        if res.status_code in (200, 201):
            return "process"
        if res.status_code not in (409,) and "23505" not in (res.text or "") and "duplicate" not in (
            res.text or ""
        ).lower() and "unique" not in (res.text or "").lower():
            logger.error(
                "billing_webhook_events insert failed: %s %s",
                res.status_code,
                res.text[:200],
            )
            if settings.supabase_enabled and not settings.debug:
                return "unavailable"
            return "process"

        # Unique conflict — inspect existing row for reclaim.
        existing = await client.select_one(
            TABLE,
            filters={"provider": provider, "event_id": eid},
            columns="event_id,status,updated_at,processed_at",
        )
        if not existing:
            # Race: conflict but row not visible yet — treat as in-flight duplicate.
            return "duplicate"

        status = str(existing.get("status") or "processed")
        if status == "processed":
            return "duplicate"
        if status == "failed":
            if await _reclaim(client, provider, eid, now):
                return "process"
            return "duplicate"
        if status == "processing":
            updated_raw = existing.get("updated_at") or existing.get("processed_at")
            if _is_stale(updated_raw, now) and await _reclaim(client, provider, eid, now):
                return "process"
            return "duplicate"
        # Unknown status — fail closed when persistence expected.
        logger.warning("billing_webhook_events unknown status=%s id=%s", status, eid)
        return "duplicate"
    except Exception as exc:
        logger.error("billing_webhook_events begin error: %s", exc)
        if settings.supabase_enabled and not settings.debug:
            return "unavailable"
        return "process"


async def begin_webhook_events(
    provider: str, event_ids: list[str], settings: Settings
) -> tuple[ClaimOutcome, list[str]]:
    """Claim multiple related keys (e.g. pay:* and plink:*:paid).

    If any key is already processed / in-flight, release keys we just claimed
    back to failed and return duplicate so the sibling event is skipped safely.
    """
    cleaned = [str(e).strip() for e in event_ids if e and str(e).strip()]
    if not cleaned:
        if settings.supabase_enabled and not settings.debug:
            return "unavailable", []
        return "process", []

    claimed: list[str] = []
    for eid in cleaned:
        outcome = await begin_webhook_event(provider, eid, settings)
        if outcome == "unavailable":
            for c in claimed:
                await fail_webhook_event(provider, c, settings)
            return "unavailable", []
        if outcome == "duplicate":
            for c in claimed:
                # Release so a future retry of *this* delivery isn't stuck;
                # the duplicate key remains processed/in-flight.
                await fail_webhook_event(provider, c, settings)
            return "duplicate", []
        claimed.append(eid)
    return "process", claimed


async def complete_webhook_event(provider: str, event_id: str, settings: Settings) -> bool:
    """Mark a claimed event as successfully processed."""
    return await _set_status(provider, event_id, "processed", settings)


async def complete_webhook_events(provider: str, event_ids: list[str], settings: Settings) -> None:
    for eid in event_ids:
        await complete_webhook_event(provider, eid, settings)


async def fail_webhook_event(provider: str, event_id: str, settings: Settings) -> bool:
    """Mark a claimed event failed so the provider retry can reclaim it."""
    return await _set_status(provider, event_id, "failed", settings)


async def fail_webhook_events(provider: str, event_ids: list[str], settings: Settings) -> None:
    for eid in event_ids:
        await fail_webhook_event(provider, eid, settings)


async def ensure_processed_webhook_event(
    provider: str, event_id: str, settings: Settings
) -> None:
    """Insert or upgrade a sibling key to processed (seal alternate event shapes)."""
    if not event_id or not str(event_id).strip():
        return
    eid = str(event_id).strip()
    client = rest_client(settings)
    if client is None:
        return
    now = _utcnow()
    row = {
        "provider": provider,
        "event_id": eid,
        "status": "processed",
        "processed_at": _iso(now),
        "updated_at": _iso(now),
    }
    try:
        from app.services.supabase_rest import _http_client

        headers = {
            **client._headers,
            "Prefer": "resolution=merge-duplicates,return=minimal",
        }
        res = await _http_client().post(
            f"{client._base}/{TABLE}",
            headers=headers,
            params={"on_conflict": "provider,event_id"},
            json=row,
        )
        if res.status_code not in (200, 201, 204):
            # Fallback: patch existing row to processed.
            await _set_status(provider, eid, "processed", settings)
    except Exception as exc:
        logger.warning("ensure_processed_webhook_event failed: %s", exc)


async def claim_webhook_event(provider: str, event_id: str, settings: Settings) -> bool:
    """Backward-compatible claim: True = process, False = skip.

    Prefer begin_webhook_event + complete/fail in new code. This helper only
    begins a claim; callers that still use it alone should migrate.
    """
    outcome = await begin_webhook_event(provider, event_id, settings)
    return outcome == "process"


def razorpay_paid_idempotency_keys(
    payment_id: str | None, payment_link_id: str | None
) -> list[str]:
    """Stable keys shared by payment.captured and payment_link.paid."""
    keys: list[str] = []
    pid = (payment_id or "").strip()
    plink = (payment_link_id or "").strip()
    if pid:
        keys.append(f"pay:{pid}")
    if plink:
        keys.append(f"plink:{plink}:paid")
    return keys


async def _set_status(
    provider: str, event_id: str, status: str, settings: Settings
) -> bool:
    if not event_id or not str(event_id).strip():
        return False
    client = rest_client(settings)
    if client is None:
        return not settings.supabase_enabled or settings.debug
    now = _utcnow()
    values: dict = {"status": status, "updated_at": _iso(now)}
    if status == "processed":
        values["processed_at"] = _iso(now)
    return await client.patch(
        TABLE,
        filters={"provider": provider, "event_id": str(event_id).strip()},
        values=values,
    )


async def _reclaim(client, provider: str, event_id: str, now: datetime) -> bool:
    """CAS-style reclaim of failed/stale processing rows via PostgREST patch."""
    from app.services.supabase_rest import _http_client

    params = {
        "provider": f"eq.{provider}",
        "event_id": f"eq.{event_id}",
        "status": "in.(processing,failed)",
    }
    res = await _http_client().patch(
        f"{client._base}/{TABLE}",
        headers=client._headers,
        params=params,
        json={"status": "processing", "updated_at": _iso(now)},
    )
    if res.status_code not in (200, 204):
        logger.warning(
            "billing_webhook_events reclaim failed: %s %s",
            res.status_code,
            (res.text or "")[:200],
        )
        return False
    # Prefer=return=minimal → empty body; treat 204/200 as success.
    # Concurrent reclaim: both may get 204; acceptable (idempotent grant).
    return True


def _is_stale(updated_raw: object, now: datetime) -> bool:
    if updated_raw is None:
        return True
    if isinstance(updated_raw, datetime):
        ts = updated_raw if updated_raw.tzinfo else updated_raw.replace(tzinfo=timezone.utc)
        return ts < now - _STALE_PROCESSING
    if isinstance(updated_raw, str) and updated_raw.strip():
        try:
            ts = datetime.fromisoformat(updated_raw.replace("Z", "+00:00"))
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            return ts < now - _STALE_PROCESSING
        except ValueError:
            return True
    return True

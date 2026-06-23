"""Supabase Auth helpers (service role)."""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import quote

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)


async def user_exists_by_email(email: str, settings: Settings) -> bool | None:
    """Return whether a user with this email exists, or None if check failed."""
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return None

    base = settings.supabase_url.rstrip("/")
    key = settings.supabase_service_role_key
    headers = {
        "Authorization": f"Bearer {key}",
        "apikey": key,
    }
    normalized = email.strip().lower()

    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            res = await client.get(
                f"{base}/auth/v1/admin/users",
                headers=headers,
                params={"email": quote(normalized, safe="@.")},
            )
            if res.status_code == 200:
                payload: dict[str, Any] = res.json()
                users = payload.get("users") or payload.get("data") or []
                if isinstance(users, list):
                    if any(str(user.get("email", "")).lower() == normalized for user in users):
                        return True
                    return False
        except httpx.HTTPError as exc:
            logger.warning("auth admin users email lookup failed: %s", exc)

        page = 1
        while page <= 10:
            try:
                res = await client.get(
                    f"{base}/auth/v1/admin/users",
                    headers=headers,
                    params={"page": page, "per_page": 200},
                )
            except httpx.HTTPError as exc:
                logger.warning("auth admin users page %s failed: %s", page, exc)
                return None

            if res.status_code != 200:
                logger.warning("auth admin users %s: %s", res.status_code, res.text[:200])
                return None

            payload = res.json()
            users = payload.get("users") or payload.get("data") or []
            if not isinstance(users, list) or not users:
                return False

            for user in users:
                if str(user.get("email", "")).lower() == normalized:
                    return True

            if len(users) < 200:
                return False
            page += 1

    return None

"""Minimal async PostgREST client for Supabase (service role)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)


class SupabaseRest:
    def __init__(self, settings: Settings) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise ValueError("Supabase URL and service role key are required")
        self._base = settings.supabase_url.rstrip("/") + "/rest/v1"
        self._key = settings.supabase_service_role_key
        self._headers = {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    async def select_one(
        self,
        table: str,
        *,
        filters: dict[str, str],
        columns: str = "*",
    ) -> dict[str, Any] | None:
        params: dict[str, str] = {"select": columns, "limit": "1"}
        for key, value in filters.items():
            params[key] = f"eq.{value}"
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.get(f"{self._base}/{table}", headers=self._headers, params=params)
        if res.status_code != 200:
            logger.warning("supabase select %s failed: %s", table, res.status_code)
            return None
        rows = res.json()
        return rows[0] if rows else None

    async def upsert(self, table: str, row: dict[str, Any], *, on_conflict: str) -> dict[str, Any] | None:
        headers = {**self._headers, "Prefer": "resolution=merge-duplicates,return=representation"}
        params = {"on_conflict": on_conflict}
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(f"{self._base}/{table}", headers=headers, params=params, json=row)
        if res.status_code not in (200, 201):
            logger.warning("supabase upsert %s failed: %s %s", table, res.status_code, res.text[:240])
            return None
        rows = res.json()
        return rows[0] if rows else row

    async def patch(
        self,
        table: str,
        *,
        filters: dict[str, str],
        values: dict[str, Any],
    ) -> bool:
        params = {key: f"eq.{value}" for key, value in filters.items()}
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.patch(f"{self._base}/{table}", headers=self._headers, params=params, json=values)
        if res.status_code not in (200, 204):
            logger.warning("supabase patch %s failed: %s %s", table, res.status_code, res.text[:240])
            return False
        return True


def rest_client(settings: Settings) -> SupabaseRest | None:
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseRest(settings)
    return None

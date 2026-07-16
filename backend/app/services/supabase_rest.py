"""Minimal async PostgREST client for Supabase (service role)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

_shared_client: httpx.AsyncClient | None = None


class SupabaseUnavailableError(RuntimeError):
    """Raised when PostgREST is unreachable or returns a non-OK status (not an empty row)."""


def _http_client() -> httpx.AsyncClient:
    """Reuse one connection pool across session repository calls."""
    global _shared_client
    if _shared_client is None or _shared_client.is_closed:
        _shared_client = httpx.AsyncClient(timeout=20.0)
    return _shared_client


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
            "Prefer": "return=minimal",
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
        res = await _http_client().get(f"{self._base}/{table}", headers=self._headers, params=params)
        if res.status_code != 200:
            logger.warning("supabase select %s failed: %s", table, res.status_code)
            raise SupabaseUnavailableError(f"select {table} HTTP {res.status_code}")
        rows = res.json()
        return rows[0] if rows else None

    async def select_many(
        self,
        table: str,
        *,
        filters: dict[str, str],
        columns: str = "*",
        limit: int = 200,
        order: str | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, str] = {"select": columns, "limit": str(limit)}
        if order:
            params["order"] = order
        for key, value in filters.items():
            params[key] = f"eq.{value}"
        res = await _http_client().get(f"{self._base}/{table}", headers=self._headers, params=params)
        if res.status_code != 200:
            logger.warning("supabase select_many %s failed: %s", table, res.status_code)
            raise SupabaseUnavailableError(f"select_many {table} HTTP {res.status_code}")
        rows = res.json()
        return rows if isinstance(rows, list) else []

    async def delete_rows(self, table: str, *, filters: dict[str, str]) -> bool:
        params = {key: f"eq.{value}" for key, value in filters.items()}
        res = await _http_client().delete(f"{self._base}/{table}", headers=self._headers, params=params)
        if res.status_code not in (200, 204):
            logger.warning("supabase delete %s failed: %s %s", table, res.status_code, res.text[:240])
            return False
        return True

    async def upsert(self, table: str, row: dict[str, Any], *, on_conflict: str) -> dict[str, Any] | None:
        # return=minimal avoids shipping the full row (often multi-MB palm+reports) back on every save.
        headers = {**self._headers, "Prefer": "resolution=merge-duplicates,return=minimal"}
        params = {"on_conflict": on_conflict}
        res = await _http_client().post(f"{self._base}/{table}", headers=headers, params=params, json=row)
        if res.status_code not in (200, 201, 204):
            logger.warning("supabase upsert %s failed: %s %s", table, res.status_code, res.text[:240])
            return None
        if res.status_code == 204 or not res.content:
            return row
        try:
            rows = res.json()
            return rows[0] if isinstance(rows, list) and rows else row
        except Exception:
            return row

    async def patch(
        self,
        table: str,
        *,
        filters: dict[str, str],
        values: dict[str, Any],
    ) -> bool:
        params = {key: f"eq.{value}" for key, value in filters.items()}
        res = await _http_client().patch(f"{self._base}/{table}", headers=self._headers, params=params, json=values)
        if res.status_code not in (200, 204):
            logger.warning("supabase patch %s failed: %s %s", table, res.status_code, res.text[:240])
            return False
        return True


def rest_client(settings: Settings) -> SupabaseRest | None:
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseRest(settings)
    return None

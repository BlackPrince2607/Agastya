"""Verify GROQ_API_KEY from backend/.env — run: python scripts/check_groq_key.py"""

from __future__ import annotations

import asyncio
import sys

import httpx

from app.config import get_settings


def _fingerprint(key: str) -> str:
    if len(key) < 12:
        return "(too short)"
    return f"{key[:7]}…{key[-4:]}"


async def main() -> int:
    settings = get_settings()
    key = settings.groq_api_key

    if not key:
        print("FAIL: GROQ_API_KEY is not set in backend/.env")
        return 1

    print(f"Key loaded: {_fingerprint(key)} (len={len(key)})")
    if not key.startswith("gsk_"):
        print("FAIL: Groq keys must start with gsk_")
        return 1
    if len(key) < 50:
        print("WARN: Key looks too short — Groq keys are usually 56 characters total.")
        print("      You may have copied only part of the key from the console.")

    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.get(
            "https://api.groq.com/openai/v1/models",
            headers={"Authorization": f"Bearer {key}"},
        )

    if res.status_code == 200:
        print("OK: Groq accepted the key (GET /models returned 200).")
        return 0

    print(f"FAIL: Groq returned HTTP {res.status_code}")
    print(res.text[:400])
    if res.status_code == 401:
        print()
        print("This means the key string in backend/.env is NOT valid on Groq's servers.")
        print("Fix:")
        print("  1. Open https://console.groq.com/keys")
        print("  2. Create a NEW key and copy the FULL secret (shown only once)")
        print("  3. Paste into backend/.env as: GROQ_API_KEY=gsk_...")
        print("  4. Stop the API (Ctrl+C) and run: npm run api")
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

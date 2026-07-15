"""Verify OPENROUTER_API_KEY — run from backend/: python scripts/check_openrouter_key.py"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import httpx

# Allow `python scripts/check_openrouter_key.py` from backend/
_BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_BACKEND_ROOT))

from app.config import _REPO_ROOT, get_settings


def _env_var_names(path: Path) -> list[str]:
    if not path.is_file():
        return []
    names: list[str] = []
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        names.append(s.split("=", 1)[0].strip())
    return names


def _diagnose_missing_key() -> None:
    backend_env = _BACKEND_ROOT / ".env"
    root_env = _REPO_ROOT / ".env"
    print("Diagnosis:")
    print(f"  backend/.env exists: {backend_env.is_file()} ({backend_env})")
    print(f"  repo root .env exists: {root_env.is_file()} ({root_env})")
    if backend_env.is_file():
        print(f"  backend/.env AI-related keys: {[n for n in _env_var_names(backend_env) if any(x in n for x in ('ROUTER', 'OPENAI'))]}")
    if root_env.is_file():
        print(f"  root .env AI-related keys: {[n for n in _env_var_names(root_env) if any(x in n for x in ('ROUTER', 'OPENAI'))]}")
    os_key = os.getenv("OPENROUTER_API_KEY")
    if os_key is not None:
        print(f"  OS OPENROUTER_API_KEY: {'set (empty)' if not os_key.strip() else 'set (non-empty)'}")
    else:
        print("  OS OPENROUTER_API_KEY: unset")
    if os.getenv("OPENAI_API_KEY") and not os.getenv("OPENROUTER_API_KEY"):
        print()
        print("  NOTE: OPENAI_API_KEY is set, but OpenRouter needs OPENROUTER_API_KEY")
        print("  from https://openrouter.ai/keys (not platform.openai.com).")
    print()
    print("Add to backend/.env (recommended):")
    print("  OPENROUTER_API_KEY=sk-or-v1-...")
    print("  PALM_ANALYSIS_MODE=vision")
    print("  OPENROUTER_CHAT_MODEL=openai/gpt-4o-mini")
    print("  OPENROUTER_VISION_MODEL=openai/gpt-4o-mini")


def _fingerprint(key: str) -> str:
    if len(key) < 12:
        return "(too short)"
    return f"{key[:7]}…{key[-4:]}"


async def main() -> int:
    get_settings.cache_clear()
    settings = get_settings()
    key = settings.openrouter_api_key

    if not key:
        print("FAIL: OPENROUTER_API_KEY is not set (or is empty).")
        print()
        _diagnose_missing_key()
        return 1

    print(f"Key loaded: {_fingerprint(key)} (len={len(key)})")
    if not key.startswith("sk-or"):
        print("WARN: OpenRouter keys usually start with sk-or-v1- — double-check you copied from openrouter.ai/keys")

    headers = {
        "Authorization": f"Bearer {key}",
        "HTTP-Referer": settings.openrouter_app_url,
        "X-OpenRouter-Title": settings.openrouter_app_name,
    }
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.get("https://openrouter.ai/api/v1/models", headers=headers)

    if res.status_code == 200:
        print("OK: OpenRouter accepted the key (GET /models returned 200).")
        return 0

    print(f"FAIL: OpenRouter returned HTTP {res.status_code}")
    print(res.text[:400])
    if res.status_code == 401:
        print()
        print("Create a new key at https://openrouter.ai/keys and set OPENROUTER_API_KEY in backend/.env")
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

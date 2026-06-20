"""Verify remote Supabase schema matches supabase/migrations/*.sql."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

# Allow `python scripts/verify_supabase_migrations.py` from backend/
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings

EXPECTED_COLUMNS = {
    "session_id",
    "device_install_id",
    "supabase_user_id",
    "display_name",
    "gender",
    "focus_topics",
    "palm_storage_path",
    "palm_analysis",
    "preview_report",
    "full_report",
    "chat_tail",
    "created_at",
    "updated_at",
    "predictions",
    "is_premium",
}

EXPECTED_PALM_MIMES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
}

MIGRATIONS = [
    "20260518120000_agastya_sessions.sql",
    "20260520120000_agastya_palms_mime_expand.sql",
    "20260606120000_agastya_predictions.sql",
    "20260606130000_agastya_premium.sql",
]


def _get(url: str, key: str, path: str) -> tuple[int, str]:
    req = urllib.request.Request(
        url.rstrip("/") + path,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return res.status, res.read().decode()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode()


def main() -> int:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        print("Supabase is not configured in backend/.env")
        return 1

    url = settings.supabase_url
    key = settings.supabase_service_role_key
    issues: list[str] = []

    status, body = _get(url, key, "/rest/v1/agastya_sessions?select=session_id&limit=0")
    if status != 200:
        issues.append(
            "Migration 1 missing: table public.agastya_sessions does not exist or is unreachable "
            f"(HTTP {status})."
        )
        print(json.dumps({"ok": False, "issues": issues, "migrations": MIGRATIONS}, indent=2))
        return 1

    missing_cols: list[str] = []
    for col in sorted(EXPECTED_COLUMNS):
        col_status, col_body = _get(url, key, f"/rest/v1/agastya_sessions?select={col}&limit=0")
        if col_status != 200:
            missing_cols.append(col)

    if missing_cols:
        if "predictions" in missing_cols:
            issues.append("Migration 3 missing: column predictions on agastya_sessions.")
        if "is_premium" in missing_cols:
            issues.append("Migration 4 missing: column is_premium on agastya_sessions.")
        other = [c for c in missing_cols if c not in {"predictions", "is_premium"}]
        if other:
            issues.append(f"Other missing columns on agastya_sessions: {', '.join(other)}")

    bucket_status, bucket_body = _get(url, key, "/storage/v1/bucket/palms")
    if bucket_status != 200:
        issues.append("Migration 1 missing: storage bucket `palms` does not exist.")
    else:
        bucket = json.loads(bucket_body)
        mimes = set(bucket.get("allowed_mime_types") or [])
        if not EXPECTED_PALM_MIMES.issubset(mimes):
            issues.append(
                "Migration 2 incomplete: palms bucket MIME types should include "
                f"{sorted(EXPECTED_PALM_MIMES)}; got {sorted(mimes)}."
            )
        limit = bucket.get("file_size_limit")
        if limit is not None and limit < 7340032:
            issues.append(
                f"Migration 2 incomplete: palms file_size_limit is {limit}; expected >= 7340032."
            )

    ok = not issues
    print(
        json.dumps(
            {
                "ok": ok,
                "project_url": url,
                "issues": issues,
                "local_migrations": MIGRATIONS,
                "next_steps": [] if ok else [
                    "Run: npx supabase login && npx supabase link --project-ref <ref> && npx supabase db push",
                    "Or paste each file from supabase/migrations/ into Supabase SQL Editor (in timestamp order).",
                ],
            },
            indent=2,
        )
    )
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

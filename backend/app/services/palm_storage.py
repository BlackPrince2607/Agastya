"""Optional Supabase Storage upload for palm captures (PRD v1 pipeline)."""

from __future__ import annotations

import base64
import binascii
import logging
import re

import httpx

from app.config import Settings
from app.utils.validators import validate_session_id

logger = logging.getLogger(__name__)

_DATA_URL = re.compile(
    r"^data:image/(?P<mime>png|jpeg|jpg|webp|gif);base64,(?P<data>.+)$",
    re.IGNORECASE | re.DOTALL,
)


def decode_capture_bytes(image_base64: str | None) -> tuple[bytes, str, str] | None:
    """
    Data-URL-aware base64 decode. Returns (bytes, mime type for Storage, filename suffix).

    MIME must be allowed by the `palms` bucket (migration); unknown → None.
    """
    if not image_base64:
        return None
    raw = image_base64.strip()
    try:
        m = _DATA_URL.match(raw)
        if m:
            subtype = m.group("mime").lower()
            payload = "".join(m.group("data").split())
            data = base64.b64decode(payload, validate=True)
        else:
            payload = "".join(raw.split())
            data = base64.b64decode(payload, validate=False)
            subtype = "jpeg"
    except (binascii.Error, ValueError):
        logger.warning("palm capture base64 decode failed")
        return None

    subtype = subtype if subtype != "jpg" else "jpeg"
    if subtype == "jpeg":
        return data, "image/jpeg", ".jpg"
    if subtype == "png":
        return data, "image/png", ".png"
    if subtype == "webp":
        return data, "image/webp", ".webp"
    if subtype == "gif":
        return data, "image/gif", ".gif"

    logger.warning("palm capture MIME not supported for storage: %s", subtype)
    return None


async def upload_palm_capture_if_configured(
    settings: Settings,
    *,
    session_id: str,
    image_base64: str | None,
) -> str | None:
    """POST bytes to Storage; returns ``bucket/path`` or None when skipped / failed."""
    if not image_base64 or not settings.supabase_url or not settings.supabase_service_role_key:
        return None

    safe_session = validate_session_id(session_id)

    decoded = decode_capture_bytes(image_base64)
    if not decoded:
        return None

    data, content_type, ext = decoded
    base = settings.supabase_url.rstrip("/")
    bucket = settings.supabase_palm_bucket.strip() or "palms"
    obj_path = f"{safe_session}/palm_capture{ext}"
    url = f"{base}/storage/v1/object/{bucket}/{obj_path}"

    headers = {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
        "Content-Type": content_type,
        "x-upsert": "true",
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(url, content=data, headers=headers)
        if res.status_code in (200, 201):
            return f"{bucket}/{obj_path}"
        logger.warning("palm storage upload failed: %s %s", res.status_code, res.text[:200])
    except Exception as exc:
        logger.warning("palm storage upload error: %s", exc)
    return None

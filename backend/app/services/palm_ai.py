"""Vision-LM extraction of structured palm motifs from a capture."""

from __future__ import annotations

import base64
import binascii
import json
import re

from app.config import Settings
from app.prompts.templates import PALM_VISION_SYSTEM
from app.schemas.palm import PalmAnalysis
from app.services.llm_client import groq_client


_DATA_URL_RE = re.compile(r"^data:image/([^;]+);base64,(.+)$", re.DOTALL)

_LIFE_SYNONYMS = {
    "strong": "strong",
    "moderate": "moderate",
    "subtle": "subtle",
    "firm": "strong",
    "bold": "strong",
    "deep": "strong",
    "average": "moderate",
    "medium": "moderate",
    "balanced": "moderate",
    "soft": "subtle",
    "faint": "subtle",
    "delicate": "subtle",
    "fragile": "subtle",
}
_HEART_SYNONYMS = {
    "straight": "straight",
    "linear": "straight",
    "level": "straight",
    "curved": "curved",
    "arching": "curved",
    "arc": "curved",
    "broken": "broken",
    "split": "broken",
    "chained": "broken",
}
_HEAD_SYNONYMS = {
    "short": "short",
    "brief": "short",
    "stub": "short",
    "medium": "medium",
    "moderate length": "medium",
    "long": "long",
    "extended": "long",
}


def _parse_data_url(raw: str) -> tuple[str | None, str]:
    s = raw.strip()
    m = _DATA_URL_RE.match(s)
    if m:
        return m.group(1).lower(), m.group(2).strip()
    return None, s


def _decode_len_hint(b64: str) -> int:
    """Approximate decoded byte length without full decode (for Groq ~4MiB cap)."""
    core = "".join(b64.split())
    pad = core[-2:].count("=")
    n = len(core)
    return max(0, int(n * 3 / 4) - pad)


def _normalize_token(raw: str, mapping: dict[str, str]) -> str | None:
    key = raw.strip().lower()
    if not key:
        return None
    if key in mapping:
        return mapping[key]
    return next((v for k, v in mapping.items() if k in key), None)


async def palm_analysis_from_groq(settings: Settings, *, image_base64: str, seed: str) -> PalmAnalysis | None:
    mime, payload = _parse_data_url(image_base64)
    if _decode_len_hint(payload) > 3_800_000:
        return None
    client = groq_client(settings)
    if client is None:
        return None
    mime = mime or "jpeg"
    if mime in {"jpeg", "jpg"}:
        media = "jpeg"
    elif mime in {"png", "webp", "gif"}:
        media = mime
    else:
        media = "jpeg"
    try:
        base64.standard_b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        return None

    img_url = f"data:image/{media};base64,{payload}"
    seed_note = seed[:280]
    messages = [
        {"role": "system", "content": PALM_VISION_SYSTEM},
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        "Read this palm photo. Return ONLY valid JSON matching the schema. "
                        f"Nonce (ignore unless tie-break): {seed_note!r}"
                    ),
                },
                {"type": "image_url", "image_url": {"url": img_url}},
            ],
        },
    ]
    try:
        completion = await client.chat.completions.create(
            model=settings.groq_vision_model,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.35,
            max_tokens=360,
        )
        raw_text = completion.choices[0].message.content or ""
        raw_text = raw_text.strip()
        if not raw_text:
            return None
        data = json.loads(raw_text)
        life_raw = str(data.get("life_line", "")).strip()
        heart_raw = str(data.get("heart_line", "")).strip()
        head_raw = str(data.get("head_line", "")).strip()
        personality = str(data.get("personality", "")).strip() or "curious maker"
        traits_in = data.get("traits") or []
        traits: list[str] = []
        if isinstance(traits_in, list):
            for t in traits_in:
                ts = str(t).strip().lower().replace(" ", "_")
                if ts and ts not in traits:
                    traits.append(ts)
                    if len(traits) >= 5:
                        break
        life = _normalize_token(life_raw, _LIFE_SYNONYMS) or "moderate"
        heart = _normalize_token(heart_raw, _HEART_SYNONYMS) or "curved"
        head = _normalize_token(head_raw, _HEAD_SYNONYMS) or "medium"
        if len(traits) < 2:
            traits.extend(["thoughtful", "resilient"])
            traits = list(dict.fromkeys(traits))[:5]
        return PalmAnalysis(
            life_line=life,
            heart_line=heart,
            head_line=head,
            personality=personality[:96],
            traits=traits[:5],
        )
    except Exception:
        return None

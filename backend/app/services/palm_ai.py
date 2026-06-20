"""Vision-LM extraction of structured palm motifs from a capture."""

from __future__ import annotations

import base64
import binascii
import json
import logging
import re

import sentry_sdk

from app.config import Settings
from app.prompts.templates import PALM_VISION_SYSTEM
from app.schemas.palm import PalmAnalysis
from app.services.llm_client import groq_chat_completion

logger = logging.getLogger(__name__)

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


def _clamp_confidence(value: object) -> float:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return 0.5
    return max(0.0, min(1.0, n))


async def palm_analysis_from_groq(
    settings: Settings,
    *,
    image_base64: str,
    seed: str,
    dominant_hand: str | None = None,
) -> PalmAnalysis | None:
    mime, payload = _parse_data_url(image_base64)
    if _decode_len_hint(payload) > 3_800_000:
        logger.warning("Palm image exceeds Groq size cap")
        return None
    if settings.groq_api_key is None:
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
        logger.warning("Invalid palm image base64")
        return None

    img_url = f"data:image/{media};base64,{payload}"
    seed_note = seed[:280]
    hand_note = dominant_hand or "unknown"
    messages = [
        {"role": "system", "content": PALM_VISION_SYSTEM},
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        "Read this palm photo. Return ONLY valid JSON matching the schema. "
                        f"Dominant hand (client): {hand_note}. "
                        f"Nonce (ignore unless tie-break): {seed_note!r}"
                    ),
                },
                {"type": "image_url", "image_url": {"url": img_url}},
            ],
        },
    ]
    try:
        completion = await groq_chat_completion(
            settings,
            model=settings.groq_vision_model,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.35,
            max_tokens=800,
        )
        if completion is None:
            return None
        raw_text = (completion.choices[0].message.content or "").strip()
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

        image_quality = str(data.get("image_quality", "acceptable")).strip().lower()
        if image_quality not in {"good", "acceptable", "poor", "no_hand"}:
            image_quality = "acceptable"

        hand_shape = str(data.get("hand_shape", "mixed")).strip().lower()
        if hand_shape not in {"earth", "air", "fire", "water", "mixed"}:
            hand_shape = "mixed"

        dom = str(data.get("dominant_hand", dominant_hand or "unknown")).strip().lower()
        if dom not in {"left", "right", "unknown"}:
            dom = dominant_hand or "unknown"

        warnings_in = data.get("quality_warnings") or []
        warnings = [str(w).strip() for w in warnings_in if str(w).strip()][:5] if isinstance(warnings_in, list) else []

        return PalmAnalysis(
            life_line=life,
            heart_line=heart,
            head_line=head,
            personality=personality[:96],
            traits=traits[:5],
            dominant_hand=dom,
            hand_shape=hand_shape,
            image_quality=image_quality,
            confidence=_clamp_confidence(data.get("confidence", 0.65)),
            analysis_source="groq_vision",
            quality_warnings=warnings,
            line_details=data.get("line_details") if isinstance(data.get("line_details"), dict) else None,
            mounts=data.get("mounts") if isinstance(data.get("mounts"), dict) else None,
            fate_line=str(data.get("fate_line", "")).strip() or None,
        )
    except Exception as exc:
        logger.exception("Groq palm vision failed: %s", exc)
        sentry_sdk.capture_exception(exc)
        return None

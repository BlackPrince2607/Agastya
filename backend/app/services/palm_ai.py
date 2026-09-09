"""Vision-LM extraction of structured palm motifs + line overlays from a capture."""

from __future__ import annotations

import base64
import binascii
import logging
import re

import sentry_sdk

from app.config import Settings
from app.prompts.templates import PALM_VISION_SYSTEM
from app.schemas.palm import PalmAnalysis
from app.services.llm_client import llm_chat_completion
from app.utils.ai_logging import log_ai_event
from app.utils.json_repair import loads_llm_json

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
_SECONDARY_STRENGTH_SYNONYMS = {
    "strong": "strong",
    "deep": "strong",
    "bold": "strong",
    "clear": "strong",
    "moderate": "moderate",
    "medium": "moderate",
    "average": "moderate",
    "balanced": "moderate",
    "faint": "faint",
    "subtle": "faint",
    "weak": "faint",
    "soft": "faint",
    "broken": "broken",
    "split": "broken",
    "interrupted": "broken",
    "absent": "absent",
    "none": "absent",
    "missing": "absent",
    "present": "moderate",
    "partial": "faint",
    "not_clearly_visible": "not_clearly_visible",
    "not clearly visible": "not_clearly_visible",
    "unclear": "not_clearly_visible",
    "unknown": "not_clearly_visible",
}
_MARRIAGE_SYNONYMS = {
    "clear": "clear",
    "strong": "clear",
    "single": "clear",
    "one": "clear",
    "multiple": "multiple",
    "many": "multiple",
    "several": "multiple",
    "faint": "faint",
    "subtle": "faint",
    "weak": "faint",
    "absent": "absent",
    "none": "absent",
    "missing": "absent",
    "not_clearly_visible": "not_clearly_visible",
    "not clearly visible": "not_clearly_visible",
    "unclear": "not_clearly_visible",
    "unknown": "not_clearly_visible",
}

_MAJOR_GEOMETRY = {"life_line", "heart_line", "head_line"}
_SECONDARY_GEOMETRY = {"fate_line", "sun_line", "marriage_line"}
_ALLOWED_GEOMETRY = _MAJOR_GEOMETRY | _SECONDARY_GEOMETRY


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


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _downscale_for_vision(payload_b64: str, mime: str | None, max_edge: int) -> tuple[str, str]:
    """Re-encode captures to a bounded JPEG so OpenRouter vision stays fast/reliable."""
    import io

    from PIL import Image, ImageOps

    raw = base64.b64decode(payload_b64, validate=False)
    with Image.open(io.BytesIO(raw)) as pil:
        img = ImageOps.exif_transpose(pil).convert("RGB")
    w, h = img.size
    long_side = max(w, h)
    edge = max(256, int(max_edge))
    if long_side > edge:
        scale = edge / float(long_side)
        img = img.resize(
            (max(1, int(w * scale)), max(1, int(h * scale))),
            Image.Resampling.LANCZOS,
        )
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85, optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii"), "jpeg"


def _parse_point(raw: object) -> dict[str, float] | None:
    if not isinstance(raw, dict):
        return None
    try:
        return {"x": _clamp01(float(raw.get("x", 0))), "y": _clamp01(float(raw.get("y", 0)))}
    except (TypeError, ValueError):
        return None


def _normalize_geometry_name(name: str) -> str:
    n = name.strip().lower().replace(" ", "_").replace("-", "_")
    aliases = {
        "life": "life_line",
        "heart": "heart_line",
        "head": "head_line",
        "fate": "fate_line",
        "destiny": "fate_line",
        "bhagya": "fate_line",
        "sun": "sun_line",
        "apollo": "sun_line",
        "surya": "sun_line",
        "marriage": "marriage_line",
        "relationship": "marriage_line",
        "vivah": "marriage_line",
    }
    return aliases.get(n, n)


def parse_vision_line_geometry(raw: object) -> list[dict] | None:
    """Normalize vision-returned crease polylines (0–1 image coords)."""
    if not isinstance(raw, list):
        return None
    cleaned: list[dict] = []
    for line in raw:
        if not isinstance(line, dict):
            continue
        name = _normalize_geometry_name(str(line.get("name", "")))
        points = line.get("points")
        if name not in _ALLOWED_GEOMETRY or not isinstance(points, list):
            continue
        parsed = [_parse_point(p) for p in points]
        parsed = [p for p in parsed if p is not None]
        if len(parsed) < 2:
            continue
        cleaned.append({"name": name, "points": parsed[:14]})
    major_names = {g["name"] for g in cleaned if g["name"] in _MAJOR_GEOMETRY}
    # Life + heart + head must lock before we treat vision geometry as live.
    return cleaned if _MAJOR_GEOMETRY <= major_names else None


async def palm_analysis_from_vision(
    settings: Settings,
    *,
    image_base64: str,
    seed: str,
    dominant_hand: str | None = None,
    gender: str | None = None,
) -> PalmAnalysis | None:
    mime, payload = _parse_data_url(image_base64)
    if _decode_len_hint(payload) > 3_800_000:
        logger.warning("Palm image exceeds vision size cap (pre-downscale)")
        return None
    if settings.openrouter_api_key is None:
        return None
    mime = mime or "jpeg"
    try:
        # Use b64decode (not standard_b64decode) — only b64decode accepts validate=.
        base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        logger.warning("Invalid palm image base64")
        return None

    # Phone captures are often multi‑MB; downscale before OpenRouter so vision
    # completes within client/server budgets instead of hanging at 28%.
    try:
        payload, media = _downscale_for_vision(
            payload,
            mime,
            settings.palm_vision_max_edge,
        )
    except Exception:
        logger.exception("palm vision downscale failed — using original capture")
        if mime in {"jpeg", "jpg"}:
            media = "jpeg"
        elif mime in {"png", "webp", "gif"}:
            media = mime
        else:
            media = "jpeg"

    img_url = f"data:image/{media};base64,{payload}"
    seed_note = seed[:280]
    hand_note = dominant_hand or "unknown"
    gender_note = gender or "unspecified"
    tradition = ""
    if gender == "male":
        tradition = " Traditional reading hand for male: right."
    elif gender == "female":
        tradition = " Traditional reading hand for female: left."
    messages = [
        {"role": "system", "content": PALM_VISION_SYSTEM},
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        "Read this palm photo. Trace life, heart, and head creases; also fate, sun, and "
                        "marriage lines ONLY when clearly visible. Return normalized line_geometry and "
                        "ONLY valid JSON matching the schema. Never invent unclear marks. "
                        f"Scanned hand (client): {hand_note}. "
                        f"Gender (client): {gender_note}.{tradition} "
                        f"Nonce (ignore unless tie-break): {seed_note!r}"
                    ),
                },
                {"type": "image_url", "image_url": {"url": img_url}},
            ],
        },
    ]
    try:
        completion = await llm_chat_completion(
            settings,
            model=settings.openrouter_vision_model,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.25,
            max_tokens=1800,
            timeout_seconds=settings.openrouter_vision_timeout_seconds,
            feature="palm_vision",
        )
        if completion is None:
            return None
        raw_text = (completion.choices[0].message.content or "").strip()
        if not raw_text:
            return None
        data = loads_llm_json(raw_text, feature="palm_vision")
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

        geometry = parse_vision_line_geometry(data.get("line_geometry"))
        # Only forgive a timid poor/no_hand label when geometry is real and confidence is high.
        if geometry and image_quality in {"poor", "no_hand"}:
            conf = _clamp_confidence(data.get("confidence", 0.7))
            if conf >= 0.55:
                image_quality = "acceptable"
                warnings = [w for w in warnings if "no" not in w.lower() and "blur" not in w.lower()][:5]

        fate = _normalize_token(str(data.get("fate_line", "")), _SECONDARY_STRENGTH_SYNONYMS)
        sun = _normalize_token(str(data.get("sun_line", "")), _SECONDARY_STRENGTH_SYNONYMS)
        marriage = _normalize_token(str(data.get("marriage_line", "")), _MARRIAGE_SYNONYMS)

        return PalmAnalysis(
            life_line=life,
            heart_line=heart,
            head_line=head,
            personality=personality[:96],
            traits=traits[:5],
            dominant_hand=dom,
            hand_shape=hand_shape,
            image_quality=image_quality,
            confidence=_clamp_confidence(data.get("confidence", 0.7)),
            analysis_source="openrouter_vision",
            quality_warnings=warnings,
            line_details=data.get("line_details") if isinstance(data.get("line_details"), dict) else None,
            mounts=data.get("mounts") if isinstance(data.get("mounts"), dict) else None,
            fate_line=fate or "not_clearly_visible",
            sun_line=sun or "not_clearly_visible",
            marriage_line=marriage or "not_clearly_visible",
            line_geometry=geometry,
            geometry_source="vision_model" if geometry else None,
        )
    except Exception as exc:
        log_ai_event(
            logger,
            "palm_vision_failed",
            feature="palm_vision",
            level=logging.ERROR,
            error_type=type(exc).__name__,
        )
        sentry_sdk.capture_exception(exc)
        return None

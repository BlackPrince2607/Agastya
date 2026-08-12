"""Server-side hand landmark detection (MediaPipe Hands / Tasks) for clients."""

from __future__ import annotations

import io
import logging
import os
import tempfile
import urllib.request
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

_MAX_SIDE = 1280
_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
    "hand_landmarker/float16/1/hand_landmarker.task"
)
_landmarker_cache: object | None = None
_landmarker_path: str | None = None


@dataclass(frozen=True)
class _Variant:
    """RGB image plus how to map detected normalized coords back to the original frame."""

    arr: object
    x0: int = 0
    y0: int = 0
    crop_w: int = 0
    crop_h: int = 0
    full_w: int = 0
    full_h: int = 0
    pad_x: int = 0
    pad_y: int = 0
    pad_w: int = 0
    pad_h: int = 0
    mirrored: bool = False

    def remap(self, landmarks: list[list[float]]) -> list[list[float]]:
        pts = landmarks
        if self.pad_w > 0 and self.pad_h > 0 and self.full_w > 0 and self.full_h > 0:
            pts = [
                [
                    (x * self.pad_w - self.pad_x) / self.full_w,
                    (y * self.pad_h - self.pad_y) / self.full_h,
                ]
                for x, y in pts
            ]
        elif self.crop_w > 0 and self.crop_h > 0 and self.full_w > 0 and self.full_h > 0:
            pts = [
                [
                    (x * self.crop_w + self.x0) / self.full_w,
                    (y * self.crop_h + self.y0) / self.full_h,
                ]
                for x, y in pts
            ]
        if self.mirrored:
            pts = [[1.0 - x, y] for x, y in pts]
        return [[max(0.0, min(1.0, x)), max(0.0, min(1.0, y))] for x, y in pts]


def _prepare_rgb_variants(image_bytes: bytes, *, fast: bool = False) -> list[_Variant]:
    """Decode + downscale / contrast / crop / pad / mirror for more reliable static detection."""
    import numpy as np
    from PIL import Image, ImageEnhance, ImageOps

    pil = Image.open(io.BytesIO(image_bytes))
    pil = ImageOps.exif_transpose(pil).convert("RGB")
    w, h = pil.size
    long_side = max(w, h)
    if long_side > _MAX_SIDE:
        scale = _MAX_SIDE / float(long_side)
        pil = pil.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
        w, h = pil.size

    def as_variant(
        img: Image.Image,
        *,
        mirrored: bool = False,
        crop: tuple[int, int, int, int] | None = None,
        pad_ratio: float = 0.0,
    ) -> _Variant:
        if pad_ratio > 0:
            pad_x = int(w * pad_ratio)
            pad_y = int(h * pad_ratio)
            canvas_w = w + pad_x * 2
            canvas_h = h + pad_y * 2
            canvas = Image.new("RGB", (canvas_w, canvas_h), (48, 48, 48))
            canvas.paste(img, (pad_x, pad_y))
            arr = np.ascontiguousarray(np.asarray(canvas))
            if mirrored:
                arr = np.ascontiguousarray(arr[:, ::-1])
            return _Variant(
                arr=arr,
                full_w=w,
                full_h=h,
                pad_x=pad_x,
                pad_y=pad_y,
                pad_w=canvas_w,
                pad_h=canvas_h,
                mirrored=mirrored,
            )
        if crop is not None:
            x0, y0, x1, y1 = crop
            cropped = img.crop((x0, y0, x1, y1))
            arr = np.ascontiguousarray(np.asarray(cropped))
            if mirrored:
                arr = np.ascontiguousarray(arr[:, ::-1])
            return _Variant(
                arr=arr,
                x0=x0,
                y0=y0,
                crop_w=x1 - x0,
                crop_h=y1 - y0,
                full_w=w,
                full_h=h,
                mirrored=mirrored,
            )
        arr = np.ascontiguousarray(np.asarray(img))
        if mirrored:
            arr = np.ascontiguousarray(arr[:, ::-1])
        return _Variant(arr=arr, mirrored=mirrored, full_w=w, full_h=h)

    contrasted = ImageOps.autocontrast(pil, cutoff=1)

    # Fast path for /palm/analyze: few high-yield variants so MediaPipe cannot
    # serialize ahead of OpenRouter vision on the critical path.
    if fast:
        return [
            as_variant(pil, pad_ratio=0.22),
            as_variant(pil, pad_ratio=0.22, mirrored=True),
            as_variant(contrasted, pad_ratio=0.28),
            as_variant(pil),
            as_variant(pil, mirrored=True),
        ]

    margin_x = int(w * 0.12)
    margin_y = int(h * 0.10)
    center_crop = (margin_x, margin_y, w - margin_x, h - margin_y)
    tight_x = int(w * 0.18)
    tight_y = int(h * 0.14)
    tight_crop = (tight_x, tight_y, w - tight_x, h - tight_y)

    bright = ImageEnhance.Brightness(pil).enhance(1.18)
    bright = ImageEnhance.Contrast(bright).enhance(1.12)

    # Pad first — fill-frame palms are the most common MediaPipe miss.
    variants: list[_Variant] = [
        as_variant(pil, pad_ratio=0.22),
        as_variant(pil, pad_ratio=0.22, mirrored=True),
        as_variant(pil, pad_ratio=0.35),
        as_variant(pil, pad_ratio=0.35, mirrored=True),
        as_variant(contrasted, pad_ratio=0.28),
        as_variant(contrasted, pad_ratio=0.28, mirrored=True),
        as_variant(pil),
        as_variant(pil, mirrored=True),
        as_variant(contrasted),
        as_variant(contrasted, mirrored=True),
        as_variant(bright),
        as_variant(bright, mirrored=True),
    ]
    for crop in (center_crop, tight_crop):
        if crop[2] - crop[0] >= 64 and crop[3] - crop[1] >= 64:
            variants.extend(
                [
                    as_variant(pil, crop=crop),
                    as_variant(pil, mirrored=True, crop=crop),
                    as_variant(contrasted, crop=crop),
                    as_variant(contrasted, mirrored=True, crop=crop),
                ]
            )
    return variants


def _ensure_hand_model() -> str:
    global _landmarker_path
    if _landmarker_path and Path(_landmarker_path).is_file():
        return _landmarker_path
    override = os.environ.get("MEDIAPIPE_HAND_MODEL_PATH", "").strip()
    if override and Path(override).is_file():
        _landmarker_path = override
        return override
    cache_dir = Path(os.environ.get("MEDIAPIPE_MODEL_DIR", tempfile.gettempdir()))
    cache_dir.mkdir(parents=True, exist_ok=True)
    dest = cache_dir / "agastya_hand_landmarker.task"
    if not dest.is_file() or dest.stat().st_size < 1000:
        logger.info("Downloading MediaPipe hand landmarker model…")
        # Hard timeout — urlretrieve can hang forever and block /palm/analyze.
        with urllib.request.urlopen(_MODEL_URL, timeout=30) as resp:  # noqa: S310 — pinned Google CDN
            dest.write_bytes(resp.read())
        if dest.stat().st_size < 1000:
            raise RuntimeError("MediaPipe hand model download incomplete")
    _landmarker_path = str(dest)
    return _landmarker_path


def _get_tasks_landmarker(confidence: float):
    """Create/reuse MediaPipe Tasks HandLandmarker (0.10+ without solutions)."""
    global _landmarker_cache
    import mediapipe as mp
    from mediapipe.tasks.python import vision
    from mediapipe.tasks.python.core import base_options as base_options_module

    # Recreate when confidence changes — Options are fixed at construct time.
    key = round(confidence, 3)
    cached = _landmarker_cache
    if cached is not None and getattr(cached, "_agastya_conf", None) == key:
        return cached

    if cached is not None:
        try:
            cached.close()
        except Exception:
            pass

    model = _ensure_hand_model()
    options = vision.HandLandmarkerOptions(
        base_options=base_options_module.BaseOptions(model_asset_path=model),
        running_mode=vision.RunningMode.IMAGE,
        num_hands=2,
        min_hand_detection_confidence=confidence,
        min_hand_presence_confidence=confidence,
        min_tracking_confidence=confidence,
    )
    landmarker = vision.HandLandmarker.create_from_options(options)
    landmarker._agastya_conf = key  # type: ignore[attr-defined]
    _landmarker_cache = landmarker
    return landmarker


def _pick_hand_tasks(result, dominant_hand: str):
    if not result.hand_landmarks:
        return None
    chosen = result.hand_landmarks[0]
    if result.handedness and len(result.hand_landmarks) > 1:
        target = dominant_hand.lower()
        for idx, handedness in enumerate(result.handedness):
            label = ""
            if handedness:
                cat = handedness[0]
                label = (getattr(cat, "category_name", None) or getattr(cat, "display_name", "") or "").lower()
            if target == "left" and "left" in label:
                return result.hand_landmarks[idx]
            if target == "right" and "right" in label:
                return result.hand_landmarks[idx]
    return chosen


def _landmarks_from_tasks(result, dominant_hand: str) -> list[list[float]] | None:
    chosen = _pick_hand_tasks(result, dominant_hand)
    if chosen is None:
        return None
    landmarks = [[float(lm.x), float(lm.y)] for lm in chosen]
    if len(landmarks) < 21:
        return None
    return landmarks[:21]


def _pick_hand_solutions(results, dominant_hand: str):
    chosen = results.multi_hand_landmarks[0]
    if results.multi_handedness and len(results.multi_hand_landmarks) > 1:
        target = dominant_hand.lower()
        for idx, handedness in enumerate(results.multi_handedness):
            label = (handedness.classification[0].label or "").lower()
            if target == "left" and "left" in label:
                return results.multi_hand_landmarks[idx]
            if target == "right" and "right" in label:
                return results.multi_hand_landmarks[idx]
    return chosen


def _landmarks_from_solutions(results, dominant_hand: str) -> list[list[float]] | None:
    if not results.multi_hand_landmarks:
        return None
    chosen = _pick_hand_solutions(results, dominant_hand)
    landmarks = [[float(lm.x), float(lm.y)] for lm in chosen.landmark]
    if len(landmarks) < 21:
        return None
    return landmarks[:21]


def _detect_with_tasks(
    variants: list[_Variant],
    hands_order: list[str],
    *,
    fast: bool = False,
) -> list[list[float]] | None:
    import mediapipe as mp
    import numpy as np

    confidences = (0.35, 0.20) if fast else (0.35, 0.22, 0.12, 0.08)
    for confidence in confidences:
        landmarker = _get_tasks_landmarker(confidence)
        for variant in variants:
            arr = np.ascontiguousarray(variant.arr, dtype=np.uint8)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=arr)
            result = landmarker.detect(mp_image)
            for hand_label in hands_order:
                landmarks = _landmarks_from_tasks(result, hand_label)
                if landmarks:
                    return variant.remap(landmarks)
    return None


def _detect_with_solutions(
    variants: list[_Variant],
    hands_order: list[str],
    *,
    fast: bool = False,
) -> list[list[float]] | None:
    import mediapipe as mp

    if not hasattr(mp, "solutions"):
        return None

    complexities = (0,) if fast else (1, 0)
    confidences = (0.35, 0.20) if fast else (0.35, 0.22, 0.12, 0.08)
    for model_complexity in complexities:
        for confidence in confidences:
            with mp.solutions.hands.Hands(
                static_image_mode=True,
                max_num_hands=2,
                model_complexity=model_complexity,
                min_detection_confidence=confidence,
            ) as hands:
                for variant in variants:
                    processed = hands.process(variant.arr)
                    for hand_label in hands_order:
                        landmarks = _landmarks_from_solutions(processed, hand_label)
                        if landmarks:
                            return variant.remap(landmarks)
    return None


def detect_hand_landmarks_from_bytes(
    image_bytes: bytes,
    dominant_hand: str = "right",
    *,
    fast: bool = False,
) -> tuple[list[list[float]] | None, str]:
    """
    Detect 21 normalized hand landmarks from a JPEG/PNG capture.

    Returns (landmarks, source) where source is mediapipe | not_found | unavailable.
    Prefers MediaPipe Tasks (0.10.30+); falls back to classic solutions when present.
    ``fast=True`` uses fewer variants/confidences for the analyze critical path.
    """
    try:
        import mediapipe as mp  # noqa: F401
        import numpy as np  # noqa: F401
        from PIL import Image  # noqa: F401
    except ImportError:
        logger.warning("mediapipe or Pillow not installed — landmark detection unavailable")
        return None, "unavailable"

    try:
        variants = _prepare_rgb_variants(image_bytes, fast=fast)
    except Exception:
        logger.warning("palm landmark image decode failed")
        return None, "not_found"

    hands_order = [dominant_hand.lower()]
    other = "left" if dominant_hand.lower() == "right" else "right"
    if other not in hands_order:
        hands_order.append(other)

    try:
        # Tasks API first (current Windows / modern mediapipe wheels).
        try:
            from mediapipe.tasks.python import vision  # noqa: F401

            hit = _detect_with_tasks(variants, hands_order, fast=fast)
            if hit:
                return hit, "mediapipe"
        except Exception:
            logger.exception("mediapipe Tasks hand detection failed — trying solutions")

        hit = _detect_with_solutions(variants, hands_order, fast=fast)
        if hit:
            return hit, "mediapipe"
    except Exception:
        logger.exception("mediapipe hand detection failed")
        return None, "unavailable"

    return None, "not_found"

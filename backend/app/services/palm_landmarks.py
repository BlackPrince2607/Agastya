"""Server-side hand landmark detection (MediaPipe Hands) for native clients."""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

_MAX_SIDE = 1280


@dataclass(frozen=True)
class _Variant:
    """RGB image plus how to map detected normalized coords back to the original frame."""

    arr: object
    # For crop: origin + crop size in original pixels; full size for normalization.
    x0: int = 0
    y0: int = 0
    crop_w: int = 0
    crop_h: int = 0
    full_w: int = 0
    full_h: int = 0
    mirrored: bool = False

    def remap(self, landmarks: list[list[float]]) -> list[list[float]]:
        pts = landmarks
        if self.crop_w > 0 and self.crop_h > 0 and self.full_w > 0 and self.full_h > 0:
            pts = [
                [
                    (x * self.crop_w + self.x0) / self.full_w,
                    (y * self.crop_h + self.y0) / self.full_h,
                ]
                for x, y in pts
            ]
        if self.mirrored:
            pts = [[1.0 - x, y] for x, y in pts]
        return pts


def _prepare_rgb_variants(image_bytes: bytes) -> list[_Variant]:
    """Decode + downscale / contrast / crop / mirror for more reliable static detection."""
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

    def as_variant(img: Image.Image, *, mirrored: bool = False, crop: tuple[int, int, int, int] | None = None) -> _Variant:
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
        return _Variant(arr=arr, mirrored=mirrored)

    # Mild center zoom — palm is framed in the scan guide, often with empty margins.
    margin_x = int(w * 0.12)
    margin_y = int(h * 0.10)
    center_crop = (margin_x, margin_y, w - margin_x, h - margin_y)

    contrasted = ImageOps.autocontrast(pil, cutoff=1)
    bright = ImageEnhance.Brightness(pil).enhance(1.18)
    bright = ImageEnhance.Contrast(bright).enhance(1.12)

    variants: list[_Variant] = [
        as_variant(pil),
        as_variant(pil, mirrored=True),
        as_variant(contrasted),
        as_variant(contrasted, mirrored=True),
        as_variant(bright),
        as_variant(bright, mirrored=True),
    ]
    if center_crop[2] - center_crop[0] >= 64 and center_crop[3] - center_crop[1] >= 64:
        variants.extend(
            [
                as_variant(pil, crop=center_crop),
                as_variant(pil, mirrored=True, crop=center_crop),
                as_variant(contrasted, crop=center_crop),
                as_variant(contrasted, mirrored=True, crop=center_crop),
            ]
        )
    return variants


def _pick_hand(results, dominant_hand: str):
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


def _landmarks_from_results(results, dominant_hand: str) -> list[list[float]] | None:
    if not results.multi_hand_landmarks:
        return None
    chosen = _pick_hand(results, dominant_hand)
    landmarks = [[float(lm.x), float(lm.y)] for lm in chosen.landmark]
    if len(landmarks) < 21:
        return None
    return landmarks[:21]


def detect_hand_landmarks_from_bytes(
    image_bytes: bytes,
    dominant_hand: str = "right",
) -> tuple[list[list[float]] | None, str]:
    """
    Detect 21 normalized hand landmarks from a JPEG/PNG capture.

    Returns (landmarks, source) where source is mediapipe | not_found | unavailable.
    """
    try:
        import mediapipe as mp
        import numpy as np  # noqa: F401
        from PIL import Image  # noqa: F401
    except ImportError:
        logger.warning("mediapipe or Pillow not installed — landmark detection unavailable")
        return None, "unavailable"

    try:
        variants = _prepare_rgb_variants(image_bytes)
    except Exception:
        logger.warning("palm landmark image decode failed")
        return None, "not_found"

    try:
        # Complexity 1 first (accuracy), then 0 (sometimes finds harder static palms).
        for model_complexity in (1, 0):
            for confidence in (0.35, 0.22, 0.12):
                with mp.solutions.hands.Hands(
                    static_image_mode=True,
                    max_num_hands=2,
                    model_complexity=model_complexity,
                    min_detection_confidence=confidence,
                ) as hands:
                    for variant in variants:
                        landmarks = _landmarks_from_results(hands.process(variant.arr), dominant_hand)
                        if not landmarks:
                            continue
                        return variant.remap(landmarks), "mediapipe"
    except Exception:
        logger.exception("mediapipe hand detection failed")
        return None, "unavailable"

    return None, "not_found"

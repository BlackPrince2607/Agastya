"""Server-side hand landmark detection (MediaPipe Hands) for native clients."""

from __future__ import annotations

import io
import logging

logger = logging.getLogger(__name__)

_MAX_SIDE = 1280


def _prepare_rgb_variants(image_bytes: bytes) -> list:
    """Decode + optionally downscale / mirror for more reliable static detection."""
    import numpy as np
    from PIL import Image, ImageOps

    pil = Image.open(io.BytesIO(image_bytes))
    pil = ImageOps.exif_transpose(pil).convert("RGB")
    w, h = pil.size
    long_side = max(w, h)
    if long_side > _MAX_SIDE:
        scale = _MAX_SIDE / float(long_side)
        pil = pil.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)

    arr = np.asarray(pil)
    mirrored = np.ascontiguousarray(arr[:, ::-1])
    return [arr, mirrored]


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


def _run_hands(arr, dominant_hand: str, min_confidence: float):
    import mediapipe as mp

    with mp.solutions.hands.Hands(
        static_image_mode=True,
        max_num_hands=2,
        model_complexity=1,
        min_detection_confidence=min_confidence,
    ) as hands:
        results = hands.process(arr)

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
        import mediapipe as mp  # noqa: F401
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
        for confidence in (0.35, 0.22):
            for idx, arr in enumerate(variants):
                landmarks = _run_hands(arr, dominant_hand, confidence)
                if not landmarks:
                    continue
                # Mirrored attempt: flip x back to original image space.
                if idx == 1:
                    landmarks = [[1.0 - x, y] for x, y in landmarks]
                return landmarks, "mediapipe"
    except Exception:
        logger.exception("mediapipe hand detection failed")
        return None, "unavailable"

    return None, "not_found"

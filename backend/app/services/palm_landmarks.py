"""Server-side hand landmark detection (MediaPipe Hands) for native clients."""

from __future__ import annotations

import io
import logging

logger = logging.getLogger(__name__)


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
        import numpy as np
        from PIL import Image
    except ImportError:
        logger.warning("mediapipe or Pillow not installed — landmark detection unavailable")
        return None, "unavailable"

    try:
        pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        arr = np.asarray(pil)
    except Exception:
        logger.warning("palm landmark image decode failed")
        return None, "not_found"

    try:
        with mp.solutions.hands.Hands(
            static_image_mode=True,
            max_num_hands=1,
            model_complexity=1,
            min_detection_confidence=0.45,
        ) as hands:
            results = hands.process(arr)
    except Exception:
        logger.exception("mediapipe hand detection failed")
        return None, "unavailable"

    if not results.multi_hand_landmarks:
        return None, "not_found"

    chosen = results.multi_hand_landmarks[0]
    if results.multi_handedness and len(results.multi_hand_landmarks) > 1:
        target = dominant_hand.lower()
        for idx, handedness in enumerate(results.multi_handedness):
            label = (handedness.classification[0].label or "").lower()
            if target == "left" and "left" in label:
                chosen = results.multi_hand_landmarks[idx]
                break
            if target == "right" and "right" in label:
                chosen = results.multi_hand_landmarks[idx]
                break

    landmarks = [[float(lm.x), float(lm.y)] for lm in chosen.landmark]
    if len(landmarks) < 21:
        return None, "not_found"
    return landmarks[:21], "mediapipe"

"""OpenCV crease extraction — life/heart/head polylines from a palm photo.

Pipeline:
  MediaPipe landmarks → palm ROI warp → crease enhance → darkest-path traces
  in anatomic corridors → full-image normalized geometry + measured motifs.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from app.services.palm_storage import decode_capture_bytes

logger = logging.getLogger(__name__)

ROI_W = 256
ROI_H = 320

# MediaPipe Hands indices
_WRIST = 0
_THUMB_CMC = 1
_INDEX_MCP = 5
_MIDDLE_MCP = 9
_RING_MCP = 13
_PINKY_MCP = 17


@dataclass
class CreaseExtractionResult:
    line_geometry: list[dict[str, Any]] = field(default_factory=list)
    line_features: dict[str, Any] = field(default_factory=dict)
    life_line: str = "moderate"
    heart_line: str = "curved"
    head_line: str = "medium"
    geometry_source: str = "unavailable"
    confidence: float = 0.0
    quality_warnings: list[str] = field(default_factory=list)
    image_quality: str = "acceptable"


def _pt(landmarks: list[list[float]], idx: int) -> tuple[float, float] | None:
    if idx >= len(landmarks):
        return None
    row = landmarks[idx]
    if len(row) < 2:
        return None
    return float(row[0]), float(row[1])


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _decode_bgr(image_base64: str) -> np.ndarray | None:
    try:
        import cv2
    except ImportError:
        logger.warning("opencv not installed — crease extraction unavailable")
        return None

    decoded = decode_capture_bytes(image_base64)
    if decoded is None:
        return None
    data, _, _ = decoded
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


def _palm_src_quad(
    landmarks: list[list[float]],
    img_w: int,
    img_h: int,
) -> np.ndarray | None:
    """Four corners (pixel) for perspective warp: TL, TR, BR, BL of the palm rectangle."""
    wrist = _pt(landmarks, _WRIST)
    thumb = _pt(landmarks, _THUMB_CMC)
    index = _pt(landmarks, _INDEX_MCP)
    pinky = _pt(landmarks, _PINKY_MCP)
    middle = _pt(landmarks, _MIDDLE_MCP)
    if not all([wrist, thumb, index, pinky, middle]):
        return None

    assert wrist and thumb and index and pinky and middle

    # Expand slightly past MCP row toward finger bases and past wrist/thenar.
    def px(p: tuple[float, float]) -> tuple[float, float]:
        return (p[0] * img_w, p[1] * img_h)

    i = px(index)
    p = px(pinky)
    w = px(wrist)
    t = px(thumb)
    m = px(middle)

    # Vector from wrist toward middle MCP (palm up direction).
    up_x, up_y = m[0] - w[0], m[1] - w[1]
    up_len = max(1e-6, (up_x**2 + up_y**2) ** 0.5)
    up_x, up_y = up_x / up_len, up_y / up_len

    # Lateral: index → pinky
    lat_x, lat_y = p[0] - i[0], p[1] - i[1]
    lat_len = max(1e-6, (lat_x**2 + lat_y**2) ** 0.5)
    lat_x, lat_y = lat_x / lat_len, lat_y / lat_len

    pad_up = 0.08 * up_len
    pad_down = 0.22 * up_len
    pad_lat = 0.12 * lat_len

    # Top edge just below finger MCPs
    top_mid = np.array([m[0] - up_x * pad_up, m[1] - up_y * pad_up], dtype=np.float32)
    tl = top_mid - np.array([lat_x, lat_y], dtype=np.float32) * (lat_len * 0.55 + pad_lat)
    tr = top_mid + np.array([lat_x, lat_y], dtype=np.float32) * (lat_len * 0.55 + pad_lat)

    # Bottom edge around wrist / thenar
    bottom_mid = np.array(
        [
            (w[0] + t[0]) / 2 + up_x * pad_down * 0.15,
            (w[1] + t[1]) / 2 + up_y * pad_down * 0.15,
        ],
        dtype=np.float32,
    )
    bl = (
        bottom_mid
        - np.array([lat_x, lat_y], dtype=np.float32) * (lat_len * 0.5 + pad_lat)
        - np.array([up_x, up_y], dtype=np.float32) * pad_down
    )
    br = (
        bottom_mid
        + np.array([lat_x, lat_y], dtype=np.float32) * (lat_len * 0.5 + pad_lat)
        - np.array([up_x, up_y], dtype=np.float32) * pad_down
    )

    quad = np.float32([tl, tr, br, bl])
    # Reject degenerate quads
    edge_mat = np.float32([tr - tl, bl - tl])
    if abs(float(np.linalg.det(edge_mat))) < 1.0:
        return None
    return quad


def _warp_palm(bgr: np.ndarray, landmarks: list[list[float]]) -> tuple[np.ndarray, np.ndarray] | None:
    """Return (warped gray ROI, inverse 3x3 homography ROI→full)."""
    try:
        import cv2
    except ImportError:
        return None

    h, w = bgr.shape[:2]
    src = _palm_src_quad(landmarks, w, h)
    if src is None:
        return None
    dst = np.float32([[0, 0], [ROI_W - 1, 0], [ROI_W - 1, ROI_H - 1], [0, ROI_H - 1]])
    M = cv2.getPerspectiveTransform(src, dst)
    M_inv = cv2.getPerspectiveTransform(dst, src)
    warped = cv2.warpPerspective(bgr, M, (ROI_W, ROI_H), flags=cv2.INTER_LINEAR)
    gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    return gray, M_inv


def _enhance_creases(gray: np.ndarray) -> np.ndarray:
    """CLAHE + black-hat to emphasize dark creases; returns float score map (higher = crease)."""
    import cv2

    clahe = cv2.createCLAHE(clipLimit=2.4, tileGridSize=(8, 8))
    eq = clahe.apply(gray)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    blackhat = cv2.morphologyEx(eq, cv2.MORPH_BLACKHAT, kernel)
    # Soft invert so valleys are bright on score map
    blur = cv2.GaussianBlur(eq, (5, 5), 0)
    valleys = cv2.subtract(blur, eq)
    score = cv2.addWeighted(blackhat, 0.65, valleys, 0.35, 0)
    score = cv2.GaussianBlur(score, (3, 3), 0)
    return score.astype(np.float32)


def _trace_horizontal_corridor(
    score: np.ndarray,
    *,
    y_lo: float,
    y_hi: float,
    x_start: float = 0.05,
    x_end: float = 0.95,
    steps: int = 28,
) -> list[tuple[float, float]]:
    """Trace darkest path left→right inside a vertical band (normalized ROI coords)."""
    h, w = score.shape
    ys_lo = int(max(0, y_lo * h))
    ys_hi = int(min(h - 1, y_hi * h))
    if ys_hi <= ys_lo + 2:
        return []

    band = score[ys_lo : ys_hi + 1, :]
    xs = np.linspace(x_start * (w - 1), x_end * (w - 1), steps)
    points: list[tuple[float, float]] = []
    prev_y: int | None = None
    for x in xs:
        xi = int(round(x))
        col = band[:, xi]
        # Prefer continuity with previous row
        if prev_y is not None:
            local = np.arange(len(col))
            weights = col - 0.15 * np.abs(local - (prev_y - ys_lo))
            yi_rel = int(np.argmax(weights))
        else:
            yi_rel = int(np.argmax(col))
        yi = ys_lo + yi_rel
        prev_y = yi
        # Reject flat bands (no crease contrast)
        if float(col[yi_rel]) < 4.0:
            continue
        points.append((xi / (w - 1), yi / (h - 1)))
    return points


def _trace_arc_corridor(
    score: np.ndarray,
    *,
    x_lo: float,
    x_hi: float,
    y_start: float,
    y_end: float,
    steps: int = 24,
) -> list[tuple[float, float]]:
    """Trace darkest path top→bottom inside a horizontal band (life line thenar arc)."""
    h, w = score.shape
    xs_lo = int(max(0, x_lo * w))
    xs_hi = int(min(w - 1, x_hi * w))
    if xs_hi <= xs_lo + 2:
        return []

    band = score[:, xs_lo : xs_hi + 1]
    ys = np.linspace(y_start * (h - 1), y_end * (h - 1), steps)
    points: list[tuple[float, float]] = []
    prev_x: int | None = None
    for y in ys:
        yi = int(round(y))
        row = band[yi, :]
        if prev_x is not None:
            local = np.arange(len(row))
            weights = row - 0.12 * np.abs(local - (prev_x - xs_lo))
            xi_rel = int(np.argmax(weights))
        else:
            xi_rel = int(np.argmax(row))
        xi = xs_lo + xi_rel
        prev_x = xi
        if float(row[xi_rel]) < 4.0:
            continue
        points.append((xi / (w - 1), yi / (h - 1)))
    return points


def _polyline_length(pts: list[tuple[float, float]]) -> float:
    if len(pts) < 2:
        return 0.0
    total = 0.0
    for a, b in zip(pts, pts[1:]):
        total += ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5
    return total


def _curvature(pts: list[tuple[float, float]]) -> float:
    """Approximate mean absolute curvature via turning angles (0 = straight)."""
    if len(pts) < 3:
        return 0.0
    angles: list[float] = []
    for i in range(1, len(pts) - 1):
        ax, ay = pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]
        bx, by = pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]
        na = max(1e-9, (ax * ax + ay * ay) ** 0.5)
        nb = max(1e-9, (bx * bx + by * by) ** 0.5)
        cos = max(-1.0, min(1.0, (ax * bx + ay * by) / (na * nb)))
        angles.append(abs(float(np.arccos(cos))))
    return float(np.mean(angles)) if angles else 0.0


def _count_breaks(pts: list[tuple[float, float]], score: np.ndarray, gap_thresh: float = 8.0) -> int:
    """Count local intensity dropouts along the path."""
    if len(pts) < 4:
        return 0
    h, w = score.shape
    vals = []
    for x, y in pts:
        xi = int(round(x * (w - 1)))
        yi = int(round(y * (h - 1)))
        vals.append(float(score[yi, xi]))
    median = float(np.median(vals))
    if median < 1e-3:
        return 0
    breaks = 0
    below = False
    for v in vals:
        if v < median * 0.35 or v < gap_thresh:
            if not below:
                breaks += 1
                below = True
        else:
            below = False
    return min(breaks, 5)


def _mean_depth(pts: list[tuple[float, float]], score: np.ndarray) -> float:
    if not pts:
        return 0.0
    h, w = score.shape
    vals = []
    for x, y in pts:
        xi = int(round(_clamp01(x) * (w - 1)))
        yi = int(round(_clamp01(y) * (h - 1)))
        vals.append(float(score[yi, xi]))
    return float(np.mean(vals)) if vals else 0.0


def _downsample(pts: list[tuple[float, float]], max_pts: int = 8) -> list[tuple[float, float]]:
    if len(pts) <= max_pts:
        return pts
    idxs = np.linspace(0, len(pts) - 1, max_pts)
    return [pts[int(round(i))] for i in idxs]


def _roi_to_full(
    pts: list[tuple[float, float]],
    M_inv: np.ndarray,
    img_w: int,
    img_h: int,
) -> list[dict[str, float]]:
    import cv2

    if not pts:
        return []
    arr = np.float32([[[p[0] * (ROI_W - 1), p[1] * (ROI_H - 1)]] for p in pts])
    mapped = cv2.perspectiveTransform(arr, M_inv)
    out: list[dict[str, float]] = []
    for pt in mapped:
        x = _clamp01(float(pt[0][0]) / max(1, img_w - 1))
        y = _clamp01(float(pt[0][1]) / max(1, img_h - 1))
        out.append({"x": x, "y": y})
    return out


def _features_for(
    name: str,
    pts: list[tuple[float, float]],
    score: np.ndarray,
) -> dict[str, Any]:
    length = _polyline_length(pts)
    curv = _curvature(pts)
    breaks = _count_breaks(pts, score)
    depth = _mean_depth(pts, score)
    conf = _clamp01(0.25 + depth / 80.0 + min(0.35, length) - breaks * 0.08)
    return {
        "length": round(length, 4),
        "length_label": "long" if length > 0.55 else "short" if length < 0.28 else "medium",
        "depth": "strong" if depth > 28 else "subtle" if depth < 12 else "moderate",
        "depth_score": round(depth, 2),
        "curvature": round(curv, 4),
        "breaks": breaks,
        "confidence": round(conf, 3),
        "notes": f"cv_{name}",
    }


def _map_life_motif(feat: dict[str, Any]) -> str:
    depth = feat.get("depth", "moderate")
    if depth == "strong":
        return "strong"
    if depth == "subtle":
        return "subtle"
    return "moderate"


def _map_heart_motif(feat: dict[str, Any]) -> str:
    if int(feat.get("breaks", 0)) >= 2:
        return "broken"
    if float(feat.get("curvature", 0)) < 0.18:
        return "straight"
    return "curved"


def _map_head_motif(feat: dict[str, Any]) -> str:
    label = feat.get("length_label", "medium")
    if label in {"short", "medium", "long"}:
        return str(label)
    return "medium"


def extract_creases_from_image(
    image_base64: str,
    landmarks: list[list[float]] | None,
) -> CreaseExtractionResult:
    """
    Extract major palm crease geometry from a capture.

    Requires landmarks (MediaPipe 21-point). Returns geometry_source=unavailable
    when extraction cannot produce reliable creases — never invents overlays.
    """
    result = CreaseExtractionResult()
    if not landmarks or len(landmarks) < 18:
        result.quality_warnings.append("Hand landmarks required for crease scan")
        result.image_quality = "no_hand"
        return result

    try:
        import cv2  # noqa: F401 — presence check
    except ImportError:
        result.quality_warnings.append("OpenCV unavailable on server")
        return result

    bgr = _decode_bgr(image_base64)
    if bgr is None:
        result.quality_warnings.append("Could not decode palm image")
        result.image_quality = "poor"
        return result

    img_h, img_w = bgr.shape[:2]
    warped = _warp_palm(bgr, landmarks)
    if warped is None:
        result.quality_warnings.append("Could not align palm region")
        result.image_quality = "poor"
        return result

    gray, M_inv = warped
    score = _enhance_creases(gray)

    # Anatomic corridors in normalized ROI space (index on left after warp for either hand:
    # our quad puts index→pinky as TL→TR so heart/head run left→right).
    heart_pts = _trace_horizontal_corridor(score, y_lo=0.10, y_hi=0.28, x_start=0.08, x_end=0.92)
    head_pts = _trace_horizontal_corridor(score, y_lo=0.32, y_hi=0.52, x_start=0.10, x_end=0.88)
    life_pts = _trace_arc_corridor(score, x_lo=0.05, x_hi=0.42, y_start=0.12, y_end=0.88)

    heart_pts = _downsample(heart_pts)
    head_pts = _downsample(head_pts)
    life_pts = _downsample(life_pts)

    named = {
        "heart_line": heart_pts,
        "head_line": head_pts,
        "life_line": life_pts,
    }

    geometry: list[dict[str, Any]] = []
    features: dict[str, Any] = {}
    warnings: list[str] = []

    for name, pts in named.items():
        if len(pts) < 3:
            warnings.append(f"{name} crease not clearly visible")
            continue
        feat = _features_for(name, pts, score)
        if feat["depth_score"] < 5.0 or feat["length"] < 0.12:
            warnings.append(f"{name} too faint to lock")
            continue
        full_pts = _roi_to_full(_downsample(pts, max_pts=8), M_inv, img_w, img_h)
        if len(full_pts) < 2:
            continue
        geometry.append({"name": name, "points": full_pts})
        features[name] = feat

    if len(geometry) < 2:
        result.quality_warnings = warnings or ["Major palm creases not detected — retake with open palm and even light"]
        result.image_quality = "poor"
        result.geometry_source = "unavailable"
        return result

    # Motifs from measured features (defaults if a line was skipped)
    life_feat = features.get("life_line", {"depth": "moderate"})
    heart_feat = features.get("heart_line", {"curvature": 0.3, "breaks": 0})
    head_feat = features.get("head_line", {"length_label": "medium"})

    confs = [float(f.get("confidence", 0.5)) for f in features.values()]
    mean_conf = float(np.mean(confs)) if confs else 0.4

    result.line_geometry = geometry
    result.line_features = features
    result.life_line = _map_life_motif(life_feat)
    result.heart_line = _map_heart_motif(heart_feat)
    result.head_line = _map_head_motif(head_feat)
    result.geometry_source = "opencv_creases"
    result.confidence = round(_clamp01(mean_conf), 3)
    result.quality_warnings = warnings
    result.image_quality = "good" if len(geometry) >= 3 and mean_conf >= 0.55 else "acceptable"
    return result

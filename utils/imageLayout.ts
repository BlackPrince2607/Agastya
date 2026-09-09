/** Map normalized image coords (0–1) to on-screen pixels for cover/contain layouts. */

export type ImageLayout = {
  offsetX: number;
  offsetY: number;
  displayWidth: number;
  displayHeight: number;
};

export function computeImageLayout(
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number,
  resizeMode: 'cover' | 'contain' = 'cover',
): ImageLayout {
  if (containerW <= 0 || containerH <= 0 || imageW <= 0 || imageH <= 0) {
    return { offsetX: 0, offsetY: 0, displayWidth: containerW, displayHeight: containerH };
  }

  const scale =
    resizeMode === 'cover'
      ? Math.max(containerW / imageW, containerH / imageH)
      : Math.min(containerW / imageW, containerH / imageH);

  const displayWidth = imageW * scale;
  const displayHeight = imageH * scale;

  return {
    offsetX: (containerW - displayWidth) / 2,
    offsetY: (containerH - displayHeight) / 2,
    displayWidth,
    displayHeight,
  };
}

export function normalizedToScreen(
  nx: number,
  ny: number,
  layout: ImageLayout,
): { x: number; y: number } {
  return {
    x: layout.offsetX + nx * layout.displayWidth,
    y: layout.offsetY + ny * layout.displayHeight,
  };
}

export function screenToNormalized(
  x: number,
  y: number,
  layout: ImageLayout,
): { x: number; y: number } {
  return {
    x: layout.displayWidth ? (x - layout.offsetX) / layout.displayWidth : 0,
    y: layout.displayHeight ? (y - layout.offsetY) / layout.displayHeight : 0,
  };
}

function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 1e-8) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Nearest crease name under a screen tap, or null if none within `thresholdPx`. */
export function nearestLineAtScreen(
  geometry: Array<{ name: string; points: Array<{ x: number; y: number }> }>,
  screenX: number,
  screenY: number,
  layout: ImageLayout,
  thresholdPx = 28,
): string | null {
  let best: { name: string; dist: number } | null = null;
  for (const line of geometry) {
    const pts = line.points ?? [];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = normalizedToScreen(pts[i]!.x, pts[i]!.y, layout);
      const b = normalizedToScreen(pts[i + 1]!.x, pts[i + 1]!.y, layout);
      const dist = distToSegment(screenX, screenY, a.x, a.y, b.x, b.y);
      if (!best || dist < best.dist) best = { name: line.name, dist };
    }
  }
  if (!best || best.dist > thresholdPx) return null;
  return best.name;
}

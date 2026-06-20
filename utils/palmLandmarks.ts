/**
 * Normalized hand landmarks (0–1) for hybrid CV pipeline.
 * When MediaPipe is unavailable, derive approximate landmarks from a centered palm ROI.
 */
export type HandLandmark = [number, number];

/** MediaPipe Hands index order (21 points). */
export function estimateLandmarksFromRoi(
  cx = 0.5,
  cy = 0.55,
  scale = 0.22,
): HandLandmark[] {
  const pts: HandLandmark[] = [];
  // wrist
  pts.push([cx, cy + scale * 1.1]);
  // thumb chain (4)
  for (let i = 0; i < 4; i += 1) {
    pts.push([cx - scale * (1.1 - i * 0.15), cy + scale * (0.5 - i * 0.12)]);
  }
  // index → pinky MCPs and tips (simplified)
  const fingers = [
    [cx - scale * 0.15, cy - scale * 0.2],
    [cx + scale * 0.05, cy - scale * 0.35],
    [cx + scale * 0.25, cy - scale * 0.25],
    [cx + scale * 0.45, cy - scale * 0.1],
  ];
  for (const [x, y] of fingers) {
    pts.push([x, y]);
    pts.push([x, y - scale * 0.35]);
  }
  while (pts.length < 21) {
    pts.push([cx, cy]);
  }
  return pts.slice(0, 21);
}

/** Trim base64 payload size — keep under Groq cap (~3.8MB decoded). */
export function trimBase64Payload(base64: string, maxChars = 4_000_000): string {
  const raw = base64.replace(/^data:image\/[^;]+;base64,/, '');
  return raw.length > maxChars ? raw.slice(0, maxChars) : raw;
}

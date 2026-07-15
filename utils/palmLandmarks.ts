/**
 * Normalized hand landmarks (0–1) for hybrid CV pipeline.
 * When MediaPipe is unavailable, derive approximate landmarks from a centered palm ROI.
 */
import type { PalmAnalysisDto, PalmLineGeometry } from '@/types/palmAnalysis';

export type HandLandmark = [number, number];

type Point = { x: number; y: number };

function mid(a: Point, b: Point, t = 0.5): Point {
  return { x: a.x * (1 - t) + b.x * t, y: a.y * (1 - t) + b.y * t };
}

function below(p: Point, amount = 0.035): Point {
  return { x: p.x, y: p.y + amount };
}

/** MediaPipe Hands index order (21 points). */
export function estimateLandmarksFromRoi(
  cx = 0.5,
  cy = 0.55,
  scale = 0.22,
  hand: 'left' | 'right' = 'right',
): HandLandmark[] {
  const flip = hand === 'left' ? -1 : 1;
  const pts: HandLandmark[] = [];

  const set = (idx: number, x: number, y: number) => {
    pts[idx] = [x, y];
  };

  // 0 wrist
  set(0, cx, cy + scale * 0.92);
  // 1–4 thumb chain
  set(1, cx - flip * scale * 0.82, cy + scale * 0.42);
  set(2, cx - flip * scale * 0.7, cy + scale * 0.12);
  set(3, cx - flip * scale * 0.58, cy - scale * 0.06);
  set(4, cx - flip * scale * 0.46, cy - scale * 0.2);
  // 5–8 index
  set(5, cx - flip * scale * 0.2, cy - scale * 0.4);
  set(6, cx - flip * scale * 0.16, cy - scale * 0.58);
  set(7, cx - flip * scale * 0.12, cy - scale * 0.74);
  set(8, cx - flip * scale * 0.08, cy - scale * 0.9);
  // 9–12 middle
  set(9, cx + flip * scale * 0.04, cy - scale * 0.44);
  set(10, cx + flip * scale * 0.06, cy - scale * 0.62);
  set(11, cx + flip * scale * 0.08, cy - scale * 0.78);
  set(12, cx + flip * scale * 0.1, cy - scale * 0.94);
  // 13–16 ring
  set(13, cx + flip * scale * 0.28, cy - scale * 0.38);
  set(14, cx + flip * scale * 0.3, cy - scale * 0.56);
  set(15, cx + flip * scale * 0.32, cy - scale * 0.72);
  set(16, cx + flip * scale * 0.34, cy - scale * 0.88);
  // 17–20 pinky
  set(17, cx + flip * scale * 0.5, cy - scale * 0.3);
  set(18, cx + flip * scale * 0.52, cy - scale * 0.48);
  set(19, cx + flip * scale * 0.54, cy - scale * 0.64);
  set(20, cx + flip * scale * 0.56, cy - scale * 0.8);

  for (let i = 0; i < 21; i += 1) {
    if (!pts[i]) pts[i] = [cx, cy];
  }
  return pts;
}

function pt(landmarks: HandLandmark[], idx: number): Point | null {
  const row = landmarks[idx];
  if (!row || row.length < 2) return null;
  return { x: row[0], y: row[1] };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function sanitizeGeometry(geometry: PalmLineGeometry[] | null | undefined): PalmLineGeometry[] {
  if (!geometry?.length) return [];
  const allowed = new Set(['life_line', 'heart_line', 'head_line']);
  return geometry
    .filter((line) => allowed.has(line.name) && line.points?.length >= 2)
    .map((line) => ({
      name: line.name,
      points: line.points.map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) })),
    }));
}

/** Approximate major-line polylines from MediaPipe-style 21 hand landmarks (preview overlay). */
export function landmarksToLineGeometry(landmarks: HandLandmark[] | null | undefined): PalmLineGeometry[] {
  if (!landmarks || landmarks.length < 18) return [];

  const wrist = pt(landmarks, 0);
  const thumbCmc = pt(landmarks, 1);
  const indexMcp = pt(landmarks, 5);
  const middleMcp = pt(landmarks, 9);
  const ringMcp = pt(landmarks, 13);
  const pinkyMcp = pt(landmarks, 17);
  if (!wrist || !indexMcp || !middleMcp || !ringMcp || !pinkyMcp || !thumbCmc) return [];

  const palmSpan = Math.hypot(pinkyMcp.x - indexMcp.x, pinkyMcp.y - indexMcp.y);
  const curve = Math.max(0.02, palmSpan * 0.12);

  const lifeStart = mid(thumbCmc, indexMcp, 0.42);
  const lifeCurve = {
    x: thumbCmc.x * 0.55 + wrist.x * 0.25 + indexMcp.x * 0.2,
    y: thumbCmc.y * 0.25 + wrist.y * 0.55 + indexMcp.y * 0.2,
  };
  const lifeLower = mid(thumbCmc, wrist, 0.62);
  const lifeEnd = mid(wrist, thumbCmc, 0.18);

  const heartStart = below(pinkyMcp, curve * 0.35);
  const heartMid = below(middleMcp, curve * 0.55);
  const heartEnd = below(indexMcp, curve * 0.45);

  const headStart = mid(indexMcp, thumbCmc, 0.28);
  const headMid = {
    x: (indexMcp.x + middleMcp.x + ringMcp.x) / 3,
    y: (indexMcp.y + middleMcp.y) / 2 + (wrist.y - indexMcp.y) * 0.18,
  };
  const headEnd = mid(ringMcp, pinkyMcp, 0.35);

  return [
    {
      name: 'life_line',
      points: [lifeStart, lifeCurve, lifeLower, lifeEnd],
    },
    {
      name: 'heart_line',
      points: [heartStart, below(ringMcp, curve * 0.5), heartMid, heartEnd],
    },
    {
      name: 'head_line',
      points: [headStart, headMid, headEnd],
    },
  ];
}

/** Prefer stored vision geometry, then derive from landmarks. */
export function resolveLineGeometry(
  palm: PalmAnalysisDto | null | undefined,
  landmarks?: HandLandmark[] | null,
): PalmLineGeometry[] {
  const fromVision = sanitizeGeometry(palm?.line_geometry);
  if (fromVision.length >= 3) return fromVision;
  const fromLandmarks = landmarksToLineGeometry(landmarks);
  if (fromLandmarks.length) return fromLandmarks;
  return fromVision;
}

/** Trim base64 payload size — keep under OpenRouter vision upload limits. */
export function trimBase64Payload(base64: string, maxChars = 4_000_000): string {
  const raw = base64.replace(/^data:image\/[^;]+;base64,/, '');
  return raw.length > maxChars ? raw.slice(0, maxChars) : raw;
}

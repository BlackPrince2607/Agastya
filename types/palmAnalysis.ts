export type PalmLineGeometry = {
  name: string;
  points: Array<{ x: number; y: number }>;
};

export type PalmAnalysisDto = {
  life_line: string;
  heart_line: string;
  head_line: string;
  personality: string;
  traits: string[];
  dominant_hand?: string;
  hand_shape?: string;
  image_quality?: 'good' | 'acceptable' | 'poor' | 'no_hand';
  confidence?: number;
  analysis_source?: 'openrouter_vision' | 'hybrid' | 'dummy' | 'fallback' | 'opencv_creases';
  quality_warnings?: string[];
  line_details?: Record<string, { length?: string; depth?: string; breaks?: number; notes?: string }>;
  mounts?: Record<string, string>;
  fate_line?: string | null;
  sun_line?: string | null;
  marriage_line?: string | null;
  line_geometry?: PalmLineGeometry[];
  line_features?: Record<
    string,
    {
      length?: number;
      length_label?: string;
      depth?: string;
      depth_score?: number;
      curvature?: number;
      breaks?: number;
      confidence?: number;
      notes?: string;
    }
  >;
  geometry_source?: 'opencv_creases' | 'vision_model' | 'landmark_heuristic' | 'unavailable' | null;
};

const LIVE_GEOMETRY = new Set(['opencv_creases', 'vision_model']);
const MAJOR_LINE_NAMES = ['life_line', 'heart_line', 'head_line'] as const;

/** True when we have drawable major-line overlays from vision or CV. */
export function hasPalmLineOverlay(palm: PalmAnalysisDto | null | undefined): boolean {
  if (!palm?.line_geometry?.length) return false;
  // Skip knuckle heuristics — those are not real crease traces.
  if (palm.geometry_source === 'landmark_heuristic') return false;
  if (palm.geometry_source && !LIVE_GEOMETRY.has(palm.geometry_source) && palm.geometry_source !== 'unavailable') {
    return false;
  }
  const names = new Set(palm.line_geometry.map((g) => g.name));
  // Prefer all three majors; still allow overlay when at least two are present.
  const majorCount = MAJOR_LINE_NAMES.filter((key) => names.has(key)).length;
  return majorCount >= 2;
}

export function isLivePalmAnalysis(palm: PalmAnalysisDto | null | undefined): boolean {
  if (!palm) return false;
  return (
    palm.analysis_source === 'openrouter_vision' ||
    palm.analysis_source === 'hybrid' ||
    palm.analysis_source === 'opencv_creases'
  );
}

export function palmNeedsRetake(palm: PalmAnalysisDto | null | undefined): boolean {
  if (!palm) return false;
  if (palm.image_quality === 'no_hand' || palm.image_quality === 'poor') return true;
  if ((palm.confidence ?? 1) < 0.35 && !hasPalmLineOverlay(palm)) return true;
  return !hasPalmLineOverlay(palm);
}

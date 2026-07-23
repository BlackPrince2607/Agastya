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

const LIVE_GEOMETRY = new Set(['opencv_creases', 'vision_model', 'landmark_heuristic']);

/** True when we have drawable major-line overlays from vision or CV. */
export function hasPalmLineOverlay(palm: PalmAnalysisDto | null | undefined): boolean {
  if (!palm?.line_geometry || palm.line_geometry.length < 2) return false;
  if (!palm.geometry_source || !LIVE_GEOMETRY.has(palm.geometry_source)) return false;
  return true;
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
  // Drawable lines from vision or CV — capture is usable.
  if (hasPalmLineOverlay(palm)) return false;
  // Vision/CV returned a live reading for a visible palm — never loop retake.
  if (isLivePalmAnalysis(palm) && palm.image_quality !== 'no_hand') {
    return false;
  }
  // Motifs present even from a soft source — still usable for the report.
  if (palm.life_line && palm.heart_line && palm.head_line && palm.image_quality !== 'no_hand') {
    return false;
  }
  return palm.image_quality === 'no_hand';
}

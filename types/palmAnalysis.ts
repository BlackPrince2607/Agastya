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
  geometry_source?: 'opencv_creases' | 'landmark_heuristic' | 'unavailable' | null;
};

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
  return palm.image_quality === 'no_hand' || palm.image_quality === 'poor';
}

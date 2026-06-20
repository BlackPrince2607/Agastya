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
  analysis_source?: 'groq_vision' | 'hybrid' | 'dummy' | 'fallback';
  quality_warnings?: string[];
  line_details?: Record<string, { length?: string; depth?: string; breaks?: number; notes?: string }>;
  mounts?: Record<string, string>;
  fate_line?: string | null;
  line_geometry?: PalmLineGeometry[];
};

export function isLivePalmAnalysis(palm: PalmAnalysisDto | null | undefined): boolean {
  if (!palm) return false;
  return palm.analysis_source === 'groq_vision' || palm.analysis_source === 'hybrid';
}

export function palmNeedsRetake(palm: PalmAnalysisDto | null | undefined): boolean {
  if (!palm) return false;
  return palm.image_quality === 'no_hand' || palm.image_quality === 'poor';
}

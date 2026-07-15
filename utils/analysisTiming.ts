import { ANALYSIS_MIN_DURATION_MS } from '@/constants/onboarding';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';

export function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Fixed presentation window for the analysis progress UI (0 → 100%). */
export function analysisPresentationMs(_phraseCount?: number) {
  return ANALYSIS_MIN_DURATION_MS;
}

/** Smooth 0–100 progress over the fixed analysis window. */
export function analysisProgressPct(elapsedMs: number, durationMs = ANALYSIS_MIN_DURATION_MS): number {
  if (durationMs <= 0) return 100;
  return Math.min(100, Math.round((elapsedMs / durationMs) * 100));
}

/** Reveal palm fields gradually so the checklist does not complete instantly. */
export function palmFieldsVisibleAt(elapsedMs: number, palm: PalmAnalysisDto | null): PalmAnalysisDto | null {
  if (!palm) return null;

  const progress = Math.min(1, elapsedMs / ANALYSIS_MIN_DURATION_MS);
  const next: Partial<PalmAnalysisDto> = {};

  if (progress >= 0.18) {
    next.life_line = palm.life_line;
    next.heart_line = palm.heart_line;
    next.head_line = palm.head_line;
  }
  if (progress >= 0.42) {
    next.mounts = palm.mounts;
  }
  if (progress >= 0.66) {
    next.hand_shape = palm.hand_shape;
  }
  if (progress >= 0.88) {
    next.line_details = palm.line_details;
    next.fate_line = palm.fate_line;
    next.personality = palm.personality;
    next.traits = palm.traits;
    next.analysis_source = palm.analysis_source;
  }

  return Object.keys(next).length > 0 ? (next as PalmAnalysisDto) : null;
}

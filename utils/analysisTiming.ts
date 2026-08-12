import { ANALYSIS_MIN_DURATION_MS } from '@/constants/onboarding';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';

/** Matches client fetch budget for /v1/palm/analyze (vision ~75s + buffer). */
export const PALM_ANALYZE_CLIENT_TIMEOUT_MS = 100_000;

/** Soft creep while frozen on the "Analyzing palm…" stage (28% / 35%). */
export const ANALYSIS_ANALYZE_CREEP_MS = 90_000;

/**
 * Hard ceiling for the whole analysis screen.
 * Must exceed analyze + report client budgets; also aborts in-flight work.
 */
export const ANALYSIS_FLOW_WATCHDOG_MS = 160_000;

export function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Reject after `ms`, or sooner if `signal` aborts (RN fetch abort can be flaky). */
export function rejectAfterMs(ms: number, message: string, signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal?.aborted) {
      reject(new Error(message));
      return;
    }
    const timer = setTimeout(() => reject(new Error(message)), ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error(message));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Race a promise against a hard deadline (and optional AbortSignal). */
export function raceWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  signal?: AbortSignal,
): Promise<T> {
  return Promise.race([promise, rejectAfterMs(ms, `timeout ${label}`, signal)]);
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
export function palmFieldsVisibleAt(
  elapsedMs: number,
  palm: PalmAnalysisDto | null,
  durationMs = ANALYSIS_MIN_DURATION_MS,
): PalmAnalysisDto | null {
  if (!palm) return null;

  const windowMs = durationMs > 0 ? durationMs : ANALYSIS_MIN_DURATION_MS;
  const progress = Math.min(1, elapsedMs / windowMs);
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

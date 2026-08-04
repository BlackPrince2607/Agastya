import type { LifeMetrics, MetricKey } from '@/types/report';

const METRIC_KEYS: MetricKey[] = ['love', 'career', 'money', 'growth'];

/** Display band — readings should feel insightful, not punitive. */
export const METRIC_FLOOR = 58;
export const METRIC_CEILING = 96;

/**
 * Normalize a single life-score into a 0–100 integer suitable for donuts.
 * Handles LLM quirks: fractions (0.72 → 72), out-of-range, and non-numbers.
 */
export function normalizeMetricValue(raw: unknown, fallback = 72): number {
  let n: number;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    n = raw;
  } else if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) {
    n = Number(raw);
  } else {
    n = fallback;
  }

  // Model sometimes returns 0–1 probabilities.
  if (n > 0 && n <= 1) {
    n = n * 100;
  }

  n = Math.round(n);
  return Math.max(METRIC_FLOOR, Math.min(METRIC_CEILING, n));
}

export function normalizeLifeMetrics(
  raw: Partial<Record<MetricKey, unknown>> | null | undefined,
  fallbacks: LifeMetrics = { love: 72, career: 74, money: 70, growth: 73 },
): LifeMetrics {
  const out = {} as LifeMetrics;
  for (const key of METRIC_KEYS) {
    out[key] = normalizeMetricValue(raw?.[key], fallbacks[key]);
  }
  return out;
}

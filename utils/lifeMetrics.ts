import type { LifeMetrics, MetricKey } from '@/types/report';
import { colors } from '@/constants/theme';

export const METRIC_KEYS: MetricKey[] = ['love', 'career', 'money', 'growth'];

/** Soft floor — affirming, but low enough that rings look distinct. */
export const METRIC_FLOOR = 48;
export const METRIC_CEILING = 97;

/** Minimum gap between strongest and weakest score after normalize. */
const MIN_SPREAD = 16;

/**
 * Per-category bands with different centers so love/career/money/growth
 * never collapse into the same visual height.
 */
export const METRIC_BANDS: Record<MetricKey, { min: number; max: number; fallback: number }> = {
  love: { min: 54, max: 94, fallback: 76 },
  career: { min: 58, max: 97, fallback: 84 },
  money: { min: 48, max: 88, fallback: 66 },
  growth: { min: 56, max: 95, fallback: 80 },
};

/** Stroke gradients for MetricDonut — one signature color family per pillar. */
export const METRIC_GRADIENTS: Record<MetricKey, readonly [string, string]> = {
  love: [colors.love, colors.magenta],
  career: [colors.career, colors.cyan],
  money: [colors.money, '#f59e0b'],
  growth: [colors.growth, colors.purple],
};

export function metricKeyFromLabel(label: string): MetricKey | null {
  const k = label.trim().toLowerCase();
  if (k === 'love' || k === 'career' || k === 'money' || k === 'growth') return k;
  return null;
}

/**
 * Normalize a single life-score into a 0–100 integer suitable for donuts.
 * Handles LLM quirks: fractions (0.72 → 72), out-of-range, and non-numbers.
 */
export function normalizeMetricValue(raw: unknown, fallback = 72, key?: MetricKey): number {
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
  const band = key ? METRIC_BANDS[key] : { min: METRIC_FLOOR, max: METRIC_CEILING };
  return Math.max(band.min, Math.min(band.max, n));
}

/**
 * If scores are too flat (all ~same), stretch them toward category centers
 * while preserving seed-relative ranking.
 */
export function differentiateLifeMetrics(metrics: LifeMetrics): LifeMetrics {
  const values = METRIC_KEYS.map((k) => metrics[k]);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const spread = hi - lo;

  let next: LifeMetrics = { ...metrics };

  if (spread < MIN_SPREAD) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length || 72;
    const scale = MIN_SPREAD / Math.max(spread, 1);
    const centers: Record<MetricKey, number> = {
      love: 74,
      career: 86,
      money: 62,
      growth: 80,
    };

    next = {} as LifeMetrics;
    for (const key of METRIC_KEYS) {
      const relative = (metrics[key] - mean) * scale;
      const towardCenter = (centers[key] - mean) * 0.35;
      next[key] = normalizeMetricValue(mean + relative + towardCenter, METRIC_BANDS[key].fallback, key);
    }
  }

  // Ensure no two pillars share the exact same % (reads as "flat" on the UI).
  const used = new Set<number>();
  const out = { ...next };
  for (const key of METRIC_KEYS) {
    let v = out[key];
    const band = METRIC_BANDS[key];
    let guard = 0;
    while (used.has(v) && guard < 12) {
      v = v + ((guard % 2 === 0 ? 1 : -1) * (Math.floor(guard / 2) + 1));
      v = Math.max(band.min, Math.min(band.max, v));
      guard += 1;
    }
    used.add(v);
    out[key] = v;
  }
  return out;
}

export function normalizeLifeMetrics(
  raw: Partial<Record<MetricKey, unknown>> | null | undefined,
  fallbacks?: LifeMetrics,
): LifeMetrics {
  const fb =
    fallbacks ??
    ({
      love: METRIC_BANDS.love.fallback,
      career: METRIC_BANDS.career.fallback,
      money: METRIC_BANDS.money.fallback,
      growth: METRIC_BANDS.growth.fallback,
    } satisfies LifeMetrics);

  const out = {} as LifeMetrics;
  for (const key of METRIC_KEYS) {
    out[key] = normalizeMetricValue(raw?.[key], fb[key], key);
  }
  return differentiateLifeMetrics(out);
}

/** Build seed-based affirming-but-varied scores, then apply focus boosts. */
export function buildSeedLifeMetrics(
  digs: number[],
  focusTopics: string[] = [],
): LifeMetrics {
  const raw: LifeMetrics = {
    love: Math.round(METRIC_BANDS.love.min + (digs[0] ?? 0.5) * (METRIC_BANDS.love.max - METRIC_BANDS.love.min)),
    career: Math.round(
      METRIC_BANDS.career.min + (digs[1] ?? 0.55) * (METRIC_BANDS.career.max - METRIC_BANDS.career.min),
    ),
    money: Math.round(METRIC_BANDS.money.min + (digs[2] ?? 0.4) * (METRIC_BANDS.money.max - METRIC_BANDS.money.min)),
    growth: Math.round(
      METRIC_BANDS.growth.min + (digs[3] ?? 0.6) * (METRIC_BANDS.growth.max - METRIC_BANDS.growth.min),
    ),
  };

  for (const topic of focusTopics) {
    const key: MetricKey | null =
      topic === 'love' || topic === 'matching'
        ? 'love'
        : topic === 'career'
          ? 'career'
          : topic === 'money'
            ? 'money'
            : topic === 'growth'
              ? 'growth'
              : null;
    if (!key) continue;
    // Absolute boost so focus pillars clearly lead the chart.
    raw[key] = Math.min(METRIC_BANDS[key].max, raw[key] + 9);
  }

  return differentiateLifeMetrics(raw);
}

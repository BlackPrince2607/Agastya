import type { InsightSection, LifeMetrics, SimulatedReading } from '@/types/report';
import { normalizeLifeMetrics } from '@/utils/lifeMetrics';

export function normalizeFullReport(payload: Record<string, unknown>): SimulatedReading {
  const metricsRaw = payload.metrics as Record<string, unknown> | undefined;
  const metrics: LifeMetrics = normalizeLifeMetrics(metricsRaw);

  const auraRaw = payload.aura as Record<string, unknown> | undefined;
  const gradient = Array.isArray(auraRaw?.gradient)
    ? (auraRaw?.gradient as string[])
    : ['#7c3aed', '#a855f7', '#06b6d4', '#2dd4bf'];

  const sectionsRaw = Array.isArray(payload.sections) ? (payload.sections as InsightSection[]) : [];

  return {
    blueprintTitle: String(payload.blueprintTitle ?? 'Your Life Blueprint'),
    visionaryTitle: String(payload.visionaryTitle ?? 'The Seeker'),
    visionarySubtitle: String(payload.visionarySubtitle ?? ''),
    archetypeLine: String(payload.archetypeLine ?? ''),
    headline: String(payload.headline ?? ''),
    sections: sectionsRaw,
    boldPrediction: String(payload.boldPrediction ?? ''),
    metrics,
    aura: {
      label: String(auraRaw?.label ?? 'Crystalline Violet'),
      gradient,
    },
  };
}

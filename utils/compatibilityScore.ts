import { inRange, seedDigits } from '@/utils/deterministicNumbers';

export type CompatibilityDimension = {
  key: string;
  label: string;
  pct: number;
};

const DIMENSION_LABELS = ['Emotional', 'Communication', 'Trust', 'Values', 'Physical'] as const;

export function compatibilityAffinity(nameA: string, nameB: string): number {
  const merged = `${nameA.trim()}::${nameB.trim()}`.toLowerCase();
  const digs = seedDigits(merged || 'affinity', 4);
  const base = digs.reduce((acc, n) => acc + (n ?? 0), 0) % 41;
  return 58 + base; // 58–98 ceremonial band
}

export function compatibilityDimensions(nameA: string, nameB: string): CompatibilityDimension[] {
  const merged = `${nameA.trim()}::${nameB.trim()}`.toLowerCase();
  const digs = seedDigits(merged || 'dimensions', DIMENSION_LABELS.length);
  return DIMENSION_LABELS.map((label, i) => ({
    key: label.toLowerCase(),
    label,
    pct: inRange(digs[i] ?? 0.5, 72, 96),
  }));
}

export function matchStrengthLabel(pct: number): string {
  if (pct >= 90) return 'Strong match';
  if (pct >= 80) return 'Harmonious match';
  if (pct >= 70) return 'Promising match';
  return 'Growing match';
}

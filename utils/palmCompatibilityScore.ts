import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import { inRange, seedDigits } from '@/utils/deterministicNumbers';
import type { CompatibilityDimension } from '@/utils/compatibilityScore';

const DIMENSION_LABELS = ['Emotional', 'Communication', 'Trust', 'Values', 'Physical'] as const;

function normalize(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase();
}

function traitOverlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0.35;
  const setB = new Set(b.map(normalize));
  const shared = a.filter((t) => setB.has(normalize(t))).length;
  return shared / Math.max(a.length, b.length);
}

function lineAffinity(a: string | undefined, b: string | undefined): number {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return 0.45;
  if (left === right) return 0.92;
  if (left.includes(right) || right.includes(left)) return 0.78;
  return 0.58;
}

function shapeAffinity(a: string | undefined, b: string | undefined): number {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return 0.5;
  if (left === right) return 0.88;
  return 0.62;
}

function palmSeed(self: PalmAnalysisDto, partner: PalmAnalysisDto): string {
  const traits = [...(self.traits ?? []), ...(partner.traits ?? [])].sort().join('|');
  return [
    self.life_line,
    self.heart_line,
    self.head_line,
    partner.life_line,
    partner.heart_line,
    partner.head_line,
    traits,
  ]
    .map(normalize)
    .join('::');
}

function dimensionScores(self: PalmAnalysisDto, partner: PalmAnalysisDto): number[] {
  const overlap = traitOverlap(self.traits ?? [], partner.traits ?? []);
  const emotional = (lineAffinity(self.heart_line, partner.heart_line) + overlap) / 2;
  const communication =
    (lineAffinity(self.head_line, partner.head_line) +
      lineAffinity(self.personality, partner.personality)) /
    2;
  const trust = (lineAffinity(self.life_line, partner.life_line) + overlap * 0.85) / 1.85;
  const values = (overlap + lineAffinity(self.fate_line ?? '', partner.fate_line ?? '')) / 2;
  const physical = shapeAffinity(self.hand_shape, partner.hand_shape);

  return [emotional, communication, trust, values, physical];
}

export function palmCompatibilityAffinity(self: PalmAnalysisDto, partner: PalmAnalysisDto): number {
  const scores = dimensionScores(self, partner);
  const avg = scores.reduce((sum, n) => sum + n, 0) / scores.length;
  const seed = palmSeed(self, partner);
  const variance = seedDigits(seed, 1)[0] ?? 0.5;
  const blended = avg * 0.82 + variance * 0.18;
  return inRange(blended, 58, 98);
}

export function palmCompatibilityDimensions(
  self: PalmAnalysisDto,
  partner: PalmAnalysisDto,
): CompatibilityDimension[] {
  const raw = dimensionScores(self, partner);
  const seed = palmSeed(self, partner);
  const variance = seedDigits(seed, DIMENSION_LABELS.length);

  return DIMENSION_LABELS.map((label, i) => ({
    key: label.toLowerCase(),
    label,
    pct: inRange((raw[i] ?? 0.5) * 0.75 + (variance[i] ?? 0.5) * 0.25, 72, 96),
  }));
}

export function hasPalmPair(self: PalmAnalysisDto | null | undefined, partner: PalmAnalysisDto | null | undefined): boolean {
  return Boolean(self?.life_line && partner?.life_line);
}

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

function mountAffinity(a: string | undefined, b: string | undefined): number {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return 0.5;
  if (left === right) return 0.86;
  if (left === 'prominent' || right === 'prominent') return 0.72;
  return 0.64;
}

function lineDetailAffinity(self: PalmAnalysisDto, partner: PalmAnalysisDto, key: string): number {
  const a = self.line_details?.[key];
  const b = partner.line_details?.[key];
  if (!a || !b) return 0.5;
  let score = 0.5;
  if (a.depth && b.depth && normalize(a.depth) === normalize(b.depth)) score += 0.18;
  if (a.length && b.length && normalize(a.length) === normalize(b.length)) score += 0.16;
  const breaksA = a.breaks ?? 0;
  const breaksB = b.breaks ?? 0;
  if (Math.abs(breaksA - breaksB) <= 1) score += 0.1;
  return Math.min(0.95, score);
}

function dimensionScores(self: PalmAnalysisDto, partner: PalmAnalysisDto): number[] {
  const overlap = traitOverlap(self.traits ?? [], partner.traits ?? []);
  const emotional =
    (lineAffinity(self.heart_line, partner.heart_line) +
      lineDetailAffinity(self, partner, 'heart_line') +
      overlap) /
    3;
  const communication =
    (lineAffinity(self.head_line, partner.head_line) +
      lineDetailAffinity(self, partner, 'head_line') +
      lineAffinity(self.personality, partner.personality)) /
    3;
  const trust =
    (lineAffinity(self.life_line, partner.life_line) +
      lineDetailAffinity(self, partner, 'life_line') +
      overlap * 0.85) /
    2.85;
  const venusA = self.mounts?.venus;
  const venusB = partner.mounts?.venus;
  const values =
    (overlap + lineAffinity(self.fate_line ?? '', partner.fate_line ?? '') + mountAffinity(venusA, venusB)) / 3;
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

export function buildPalmCompatibilitySummary(
  self: PalmAnalysisDto,
  partner: PalmAnalysisDto,
  affinity: number,
  partnerName?: string,
): string {
  const dims = palmCompatibilityDimensions(self, partner);
  const strongest = [...dims].sort((a, b) => b.pct - a.pct)[0];
  const heartMatch = normalize(self.heart_line) === normalize(partner.heart_line);
  const headMatch = normalize(self.head_line) === normalize(partner.head_line);
  const lifeMatch = normalize(self.life_line) === normalize(partner.life_line);
  const partnerLabel = partnerName?.trim() || 'Your partner';
  const selfHeartNotes = self.line_details?.heart_line?.notes?.trim();
  const partnerHeartNotes = partner.line_details?.heart_line?.notes?.trim();

  const lines = [
    `You and ${partnerLabel} score ${affinity}% together.`,
    strongest ? `Strongest overlap: ${strongest.label} (${strongest.pct}%).` : '',
    heartMatch
      ? 'Heart lines align closely — similar emotional rhythm.'
      : 'Heart lines differ — emotional styles may balance each other.',
    headMatch
      ? 'Head lines match — you think about problems in similar ways.'
      : 'Head lines differ — you bring different perspectives.',
    lifeMatch ? 'Life lines echo each other — shared resilience patterns.' : '',
    selfHeartNotes && partnerHeartNotes
      ? `Heart-line notes: ${selfHeartNotes} / ${partnerHeartNotes}`
      : '',
  ];

  return lines.filter(Boolean).join(' ');
}

import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import { inRange, seedDigits } from '@/utils/deterministicNumbers';

export type PalmLineInsight = {
  lineName: string;
  descriptor: string;
  interpretation: string;
  score: number;
};

const LIFE: Record<string, { descriptor: string; text: string }> = {
  strong: { descriptor: 'Strong & deep', text: 'Your life line is long and deep. You carry strong vitality and steady resilience through change.' },
  moderate: { descriptor: 'Steady', text: 'Your life line is balanced. You renew your energy in cycles and pace yourself with wisdom.' },
  subtle: { descriptor: 'Gentle', text: 'Your life line is fine and graceful. You move through life with sensitivity and adaptability.' },
};

const HEART: Record<string, { descriptor: string; text: string }> = {
  curved: { descriptor: 'Curved & warm', text: 'Your heart line curves gently. You love openly and feel deeply, leading with emotion and warmth.' },
  straight: { descriptor: 'Clear & direct', text: 'Your heart line runs clear. You value honesty in connection and say what you mean.' },
  broken: { descriptor: 'Complex', text: 'Your heart line is intricate. You have loved through lessons, and that depth is now your strength.' },
};

const HEAD: Record<string, { descriptor: string; text: string }> = {
  long: { descriptor: 'Long & deep', text: 'Your head line is long and thoughtful. You are intuitive, creative, and think several steps ahead.' },
  medium: { descriptor: 'Balanced', text: 'Your head line is balanced. You weigh logic and feeling well before you decide.' },
  short: { descriptor: 'Focused', text: 'Your head line is focused and decisive. You cut through noise and act with clarity.' },
};

function pick<T>(map: Record<string, T>, key: string, fallback: T): T {
  return map[String(key).toLowerCase()] ?? fallback;
}

export function palmLineInsights(palm: PalmAnalysisDto, seed: string): PalmLineInsight[] {
  const digs = seedDigits(seed || 'lines', 3);
  const conf = palm.confidence ?? 0.55;
  const life = pick(LIFE, palm.life_line, LIFE.moderate);
  const heart = pick(HEART, palm.heart_line, HEART.curved);
  const head = pick(HEAD, palm.head_line, HEAD.medium);

  return [
    {
      lineName: 'Life Line',
      descriptor: life.descriptor,
      interpretation: life.text,
      score: inRange((digs[0] ?? 0.7) * conf, 74, 92),
    },
    {
      lineName: 'Heart Line',
      descriptor: heart.descriptor,
      interpretation: heart.text,
      score: inRange((digs[1] ?? 0.6) * conf, 70, 90),
    },
    {
      lineName: 'Head Line',
      descriptor: head.descriptor,
      interpretation: head.text,
      score: inRange((digs[2] ?? 0.65) * conf, 72, 88),
    },
  ];
}

export type PersonalityProfile = {
  traits: string[];
  shadowTraits: string[];
  strengths: { label: string; value: number }[];
  description: string;
};

const SHADOW_POOL = ['Overthinking', 'Perfectionist', 'Restless', 'Guarded', 'Impatient'];

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function personalityProfile(palm: PalmAnalysisDto, seed: string): PersonalityProfile {
  const digs = seedDigits(`${seed}:persona`, 5);
  const traits = (palm.traits.length > 0 ? palm.traits : ['creative', 'independent', 'intuitive', 'empathetic'])
    .slice(0, 4)
    .map((t) => capitalize(t.replace(/_/g, ' ')));

  const shadowTraits = [
    SHADOW_POOL[Math.floor((digs[0] ?? 0) * SHADOW_POOL.length) % SHADOW_POOL.length],
    SHADOW_POOL[Math.floor((digs[1] ?? 0.4) * SHADOW_POOL.length) % SHADOW_POOL.length],
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  const strengths = [
    { label: 'Leadership', value: 3 + Math.round((digs[2] ?? 0.5) * 2) },
    { label: 'Problem Solving', value: 3 + Math.round((digs[3] ?? 0.6) * 2) },
    { label: 'Communication', value: 3 + Math.round((digs[4] ?? 0.4) * 2) },
  ];

  const persona = capitalize(palm.personality || 'visionary');
  const description = `You are ${traits.slice(0, 3).map((t) => t.toLowerCase()).join(', ')} and highly intuitive. You value freedom but also deeply care for the people around you. Your ${persona.toLowerCase()} nature is a strong inner voice—trust it.`;

  return { traits, shadowTraits, strengths, description };
}

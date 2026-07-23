import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import { inRange, seedDigits } from '@/utils/deterministicNumbers';

export type PalmLineInsight = {
  lineName: string;
  descriptor: string;
  interpretation: string;
  score: number;
  length?: string;
  depth?: string;
  breaks?: number;
  notes?: string;
};

const LINE_DETAIL_KEYS: Record<string, string> = {
  'Life Line': 'life_line',
  'Heart Line': 'heart_line',
  'Head Line': 'head_line',
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
  short: { descriptor: 'Focused', text: 'Your head line is focused and decisive. You cut through noise and move with purpose.' },
};

function pick<T>(map: Record<string, T>, key: string, fallback: T): T {
  return map[String(key).toLowerCase()] ?? fallback;
}

function lineDetailFields(
  palm: PalmAnalysisDto,
  lineName: string,
): Pick<PalmLineInsight, 'length' | 'depth' | 'breaks' | 'notes'> {
  const key = LINE_DETAIL_KEYS[lineName];
  const detail = key ? palm.line_details?.[key] : undefined;
  const feat = key && palm.line_features?.[key] ? palm.line_features[key] : undefined;
  if (!detail && !feat) return {};
  return {
    length: detail?.length ?? feat?.length_label,
    depth: detail?.depth ?? feat?.depth,
    breaks: detail?.breaks ?? feat?.breaks,
    notes: detail?.notes ?? feat?.notes,
  };
}

function enrichInterpretation(base: string, detail: Pick<PalmLineInsight, 'notes' | 'length' | 'depth'>): string {
  const extra = detail.notes?.trim();
  if (extra) return `${base} ${extra}`;
  const parts = [detail.length, detail.depth].filter(Boolean);
  if (parts.length) return `${base} (${parts.join(', ')})`;
  return base;
}

export function palmLineInsights(palm: PalmAnalysisDto, seed: string): PalmLineInsight[] {
  const digs = seedDigits(seed || 'lines', 3);
  const life = pick(LIFE, palm.life_line, LIFE.moderate);
  const heart = pick(HEART, palm.heart_line, HEART.curved);
  const head = pick(HEAD, palm.head_line, HEAD.medium);

  const rows: Array<{ lineName: string; base: typeof life; dig: number; min: number; max: number }> = [
    { lineName: 'Life Line', base: life, dig: digs[0] ?? 0.7, min: 74, max: 92 },
    { lineName: 'Heart Line', base: heart, dig: digs[1] ?? 0.6, min: 70, max: 90 },
    { lineName: 'Head Line', base: head, dig: digs[2] ?? 0.65, min: 72, max: 88 },
  ];

  return rows.map(({ lineName, base, dig, min, max }) => {
    const fields = lineDetailFields(palm, lineName);
    const geometryBoost = palm.line_geometry?.some((g) => g.name === LINE_DETAIL_KEYS[lineName]) ? 0.06 : 0;
    const conf = Math.min(0.98, (palm.confidence ?? 0.55) + geometryBoost);
    return {
      lineName,
      descriptor: base.descriptor,
      interpretation: enrichInterpretation(base.text, fields),
      score: inRange(dig * conf, min, max),
      ...fields,
    };
  });
}

export type PersonalityProfile = {
  traits: string[];
  shadowTraits: string[];
  strengths: { label: string; value: number }[];
  description: string;
  handShape?: string | null;
  mounts?: Record<string, string> | null;
};

const SHADOW_POOL = ['Overthinking', 'Perfectionist', 'Restless', 'Guarded', 'Impatient'];

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const PERSONALITY_MOTIFS: Record<string, string> = {
  visionary: 'visionary clarity',
  seeker: 'quiet seeking',
  guardian: 'steady protection',
  empath: 'warm intuition',
  strategist: 'measured insight',
  healer: 'gentle resilience',
  builder: 'grounded ambition',
};

const LINE_MOTIFS: Record<string, string> = {
  strong: 'steady resilience',
  moderate: 'quiet balance',
  subtle: 'gentle adaptability',
  curved: 'warm intuition',
  straight: 'clear conviction',
  broken: 'layered depth',
  long: 'thoughtful vision',
  medium: 'balanced insight',
  short: 'decisive focus',
};

const VISIONARY_SUBTITLES: Record<string, string> = {
  visionary: 'Architect of Quiet Intensity',
  seeker: 'Reader of Hidden Signs',
  guardian: 'Keeper of Steady Ground',
  empath: 'Voice of Warm Conviction',
  strategist: 'Mind That Maps the Quiet Path',
  healer: 'Gentle Force Behind the Surface',
  builder: 'Builder of Lasting Momentum',
};

export function palmMotifPhrase(palm: PalmAnalysisDto): string {
  const persona = String(palm.personality ?? '').toLowerCase().trim();
  if (PERSONALITY_MOTIFS[persona]) return PERSONALITY_MOTIFS[persona];

  const heart = String(palm.heart_line ?? '').toLowerCase();
  const life = String(palm.life_line ?? '').toLowerCase();
  const head = String(palm.head_line ?? '').toLowerCase();
  return LINE_MOTIFS[heart] ?? LINE_MOTIFS[life] ?? LINE_MOTIFS[head] ?? 'quiet purpose';
}

export function palmHeadline(palm: PalmAnalysisDto): string {
  const motif = palmMotifPhrase(palm);
  return `The pattern “${motif}” runs quietly through the way you move.`;
}

export function palmVisionaryTitle(palm: PalmAnalysisDto): string {
  const persona = capitalize(String(palm.personality ?? 'seeker').trim() || 'seeker');
  return `The ${persona}`;
}

export function palmVisionarySubtitle(palm: PalmAnalysisDto): string {
  const persona = String(palm.personality ?? '').toLowerCase().trim();
  return VISIONARY_SUBTITLES[persona] ?? 'Reader of Your Inner Lines';
}

export function palmArchetypeLine(palm: PalmAnalysisDto): string {
  const life = pick(LIFE, palm.life_line, LIFE.moderate);
  const heart = pick(HEART, palm.heart_line, HEART.curved);
  const traits =
    palm.traits.length > 0
      ? palm.traits
          .slice(0, 2)
          .map((t) => t.replace(/_/g, ' '))
          .join(' and ')
      : 'depth and intuition';
  return `Your ${life.descriptor.toLowerCase()} life line and ${heart.descriptor.toLowerCase()} heart line suggest someone ${traits} — you take things in quietly and speak up only when it truly matters.`;
}

export function palmSelfSectionBody(palm: PalmAnalysisDto): string {
  const motif = palmMotifPhrase(palm);
  const head = pick(HEAD, palm.head_line, HEAD.medium);
  return `You turn overwhelm into plans. Sometimes that protects you; sometimes it keeps people at arm's length. Your ${head.descriptor.toLowerCase()} mind and the pattern of ${motif} keep surfacing whenever you put off being direct.`;
}

/** Detects internal scan seeds like `right-1783693762016` leaking into user-facing copy. */
export function looksLikeTechnicalSeed(text: string): boolean {
  const trimmed = text.trim();
  return /^(right|left|partner|trace)-\d{8,}$/i.test(trimmed) || /^\w+-\d{10,}$/.test(trimmed);
}

export function headlineNeedsPalmFix(headline: string): boolean {
  const match = headline.match(/[“"]([^”"]+)[”"]/);
  if (!match?.[1]) return false;
  return looksLikeTechnicalSeed(match[1]);
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
  const shape = palm.hand_shape ? capitalize(palm.hand_shape.replace(/_/g, ' ')) : null;
  const mountBits = palm.mounts
    ? Object.entries(palm.mounts)
        .filter(([, v]) => v && v !== 'flat')
        .slice(0, 3)
        .map(([k, v]) => `${capitalize(k)} (${v})`)
    : [];
  const mountFrag =
    mountBits.length > 0 ? ` Mounts of note: ${mountBits.join(', ')}.` : '';
  const shapeFrag = shape ? ` Your ${shape.toLowerCase()} hand shape frames how this energy shows up.` : '';
  const description = `You are ${traits
    .slice(0, 3)
    .map((t) => t.toLowerCase())
    .join(', ')} and highly intuitive. You value freedom but also deeply care for the people around you. Your ${persona.toLowerCase()} nature is a strong inner voice.${shapeFrag}${mountFrag} Trust it.`;

  return { traits, shadowTraits, strengths, description, handShape: shape, mounts: palm.mounts ?? null };
}

export type MountSummary = { name: string; level: string };

export function mountSummaries(palm: PalmAnalysisDto): MountSummary[] {
  if (!palm.mounts) return [];
  return Object.entries(palm.mounts)
    .filter(([, level]) => Boolean(level))
    .map(([name, level]) => ({
      name: capitalize(name.replace(/_/g, ' ')),
      level: String(level),
    }));
}

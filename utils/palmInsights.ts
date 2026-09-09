import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import { inRange, seedDigits } from '@/utils/deterministicNumbers';

export type PalmLineInsight = {
  lineKey: string;
  lineName: string;
  rekhaName?: string;
  descriptor: string;
  interpretation: string;
  score: number;
  length?: string;
  depth?: string;
  breaks?: number;
  notes?: string;
  unclear?: boolean;
};

const REKHA: Record<string, { english: string; rekha: string; bilingual: string }> = {
  life_line: { english: 'Life Line', rekha: 'Jeevan Rekha', bilingual: 'Life Line · Jeevan Rekha' },
  heart_line: { english: 'Heart Line', rekha: 'Hridaya Rekha', bilingual: 'Heart Line · Hridaya Rekha' },
  head_line: { english: 'Head Line', rekha: 'Mastishka Rekha', bilingual: 'Head Line · Mastishka Rekha' },
  fate_line: { english: 'Fate Line', rekha: 'Bhagya Rekha', bilingual: 'Fate Line · Bhagya Rekha' },
  sun_line: { english: 'Sun Line', rekha: 'Surya Rekha', bilingual: 'Sun Line · Surya Rekha' },
  marriage_line: {
    english: 'Marriage Line',
    rekha: 'Vivah Rekha',
    bilingual: 'Marriage Line · Vivah Rekha',
  },
};

const MOUNT_DUAL: Record<string, string> = {
  venus: 'Venus · Shukra',
  jupiter: 'Jupiter · Guru',
  saturn: 'Saturn · Shani',
  sun: 'Sun · Surya',
  mercury: 'Mercury · Budh',
};

const LIFE: Record<string, { descriptor: string; text: string }> = {
  strong: {
    descriptor: 'Strong & deep',
    text: 'Your Life Line · Jeevan Rekha reads strong. Traditional palmistry associates this with steady vitality and resilience through change.',
  },
  moderate: {
    descriptor: 'Steady',
    text: 'Your Life Line · Jeevan Rekha is balanced. Traditionally this suggests paced renewal — you restore energy in cycles rather than all at once.',
  },
  subtle: {
    descriptor: 'Gentle',
    text: 'Your Life Line · Jeevan Rekha is fine and graceful. Traditionally this points to sensitivity and adaptive pacing through life’s chapters.',
  },
};

const HEART: Record<string, { descriptor: string; text: string }> = {
  curved: {
    descriptor: 'Curved & warm',
    text: 'Your Heart Line · Hridaya Rekha curves gently. Traditional palmistry links this with warm, expressive emotional giving — you feel deeply once trust is earned.',
  },
  straight: {
    descriptor: 'Clear & direct',
    text: 'Your Heart Line · Hridaya Rekha runs clear. Traditionally this favors honesty in connection — you prefer saying what you mean.',
  },
  broken: {
    descriptor: 'Complex',
    text: 'Your Heart Line · Hridaya Rekha is intricate. Traditional readings associate this with layered emotional history — depth earned through experience.',
  },
};

const HEAD: Record<string, { descriptor: string; text: string }> = {
  long: {
    descriptor: 'Long & deep',
    text: 'Your Head Line · Mastishka Rekha is long. Traditionally this suggests a reflective mind that thinks several steps ahead — strength and overthinking can share the same crease.',
  },
  medium: {
    descriptor: 'Balanced',
    text: 'Your Head Line · Mastishka Rekha is balanced. Traditional palmistry reads this as weighing logic and feeling before you decide.',
  },
  short: {
    descriptor: 'Focused',
    text: 'Your Head Line · Mastishka Rekha is focused. Traditionally this points to decisive judgment — you cut through noise when you trust yourself to move.',
  },
};

const FATE: Record<string, { descriptor: string; text: string }> = {
  strong: {
    descriptor: 'Clear path',
    text: 'Your Fate Line · Bhagya Rekha reads strong. Traditional palmistry associates this with a clearer sense of vocation — a path that wants ownership, not only waiting.',
  },
  moderate: {
    descriptor: 'Shaped by effort',
    text: 'Your Fate Line · Bhagya Rekha is moderate. Traditionally this suggests a career arc shaped by both effort and timing.',
  },
  faint: {
    descriptor: 'Clarifies with time',
    text: 'Your Fate Line · Bhagya Rekha is faint. Traditional readings often see a path that clarifies through experience rather than early certainty.',
  },
  broken: {
    descriptor: 'Chapters of redirect',
    text: 'Your Fate Line · Bhagya Rekha shows breaks. Traditionally this can point to chapters of redirection in work and purpose — not failure, but rewriting.',
  },
  present: {
    descriptor: 'Active thread',
    text: 'Your Fate Line · Bhagya Rekha is present. Traditional palmistry associates this with an active career and destiny thread.',
  },
  partial: {
    descriptor: 'Emerging path',
    text: 'Your Fate Line · Bhagya Rekha is partial. Traditionally this suggests a destiny thread that strengthens over time.',
  },
  absent: {
    descriptor: 'Self-authored',
    text: 'Your Fate Line · Bhagya Rekha is not strongly marked. Traditional palmistry often reads this as a more self-authored path — not an absence of purpose.',
  },
};

const SUN: Record<string, { descriptor: string; text: string }> = {
  strong: {
    descriptor: 'Visible craft',
    text: 'Your Sun Line · Surya Rekha reads strong. Traditionally this favors recognition through skill and creative presence.',
  },
  moderate: {
    descriptor: 'Earned regard',
    text: 'Your Sun Line · Surya Rekha is moderate. Traditional palmistry associates this with gradual visibility and earned regard.',
  },
  faint: {
    descriptor: 'Quiet success',
    text: 'Your Sun Line · Surya Rekha is faint. Traditionally this can mean quieter success that grows with consistency.',
  },
  broken: {
    descriptor: 'Uneven recognition',
    text: 'Your Sun Line · Surya Rekha shows interruption. Traditional readings often see effort preceding applause.',
  },
  present: {
    descriptor: 'Recognition thread',
    text: 'Your Sun Line · Surya Rekha is present. Traditionally this points to a thread of recognition and creative return.',
  },
  partial: {
    descriptor: 'Emerging light',
    text: 'Your Sun Line · Surya Rekha is partial. Traditional palmistry reads emerging recognition still taking shape.',
  },
  absent: {
    descriptor: 'Persistence first',
    text: 'Your Sun Line · Surya Rekha is not clearly marked. Traditionally this is less about lacking talent and more about recognition arriving through persistence.',
  },
};

const MARRIAGE: Record<string, { descriptor: string; text: string }> = {
  clear: {
    descriptor: 'Clear orientation',
    text: 'Your Marriage Line · Vivah Rekha reads clear. Traditional palmistry associates this with a clearer partnership orientation when you are ready — not a fixed wedding date.',
  },
  multiple: {
    descriptor: 'Several chapters',
    text: 'Your Marriage Line · Vivah Rekha suggests more than one mark. Traditionally this can point to more than one significant bond chapter across life.',
  },
  faint: {
    descriptor: 'Selective pace',
    text: 'Your Marriage Line · Vivah Rekha is faint. Traditional readings often associate this with selective, carefully paced intimacy.',
  },
  absent: {
    descriptor: 'Independence first',
    text: 'Your Marriage Line · Vivah Rekha is not strongly marked. Traditional palmistry may read partnership that prioritizes independence or arrives later — not a verdict against love.',
  },
};

const UNCLEAR = {
  descriptor: 'Not clearly marked',
  text: 'Not clearly visible in the provided scan. Traditional palmistry would not invent this line — clearer light and a fuller open palm would help.',
};

function pick<T>(map: Record<string, T>, key: string, fallback: T): T {
  return map[String(key).toLowerCase()] ?? fallback;
}

function lineDetailFields(
  palm: PalmAnalysisDto,
  key: string,
): Pick<PalmLineInsight, 'length' | 'depth' | 'breaks' | 'notes'> {
  const detail = palm.line_details?.[key];
  const feat = palm.line_features?.[key];
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

function motifBundle(
  table: Record<string, { descriptor: string; text: string }>,
  motif: string | null | undefined,
): { descriptor: string; text: string; unclear: boolean } {
  const key = String(motif ?? '').toLowerCase().trim();
  if (!key || key === 'not_clearly_visible' || key === 'unclear' || key === 'unknown') {
    return { ...UNCLEAR, unclear: true };
  }
  const hit = table[key];
  if (!hit) return { ...UNCLEAR, unclear: true };
  return { ...hit, unclear: false };
}

function lineScore(
  dig: number,
  palm: PalmAnalysisDto,
  key: string,
  unclear: boolean,
  min: number,
  max: number,
): number {
  if (unclear) return inRange(dig * 0.35, 42, 58);
  const feat = palm.line_features?.[key];
  const featConf = typeof feat?.confidence === 'number' ? feat.confidence : null;
  const hasGeom = palm.line_geometry?.some((g) => g.name === key) ?? false;
  const conf = Math.min(0.98, (featConf ?? palm.confidence ?? 0.55) + (hasGeom ? 0.06 : 0));
  return inRange(dig * conf, min, max);
}

export function isLockedPalmLine(palm: PalmAnalysisDto, key: string): boolean {
  const motif = String((palm as Record<string, unknown>)[key] ?? '').toLowerCase().trim();
  const unclear =
    !motif || motif === 'not_clearly_visible' || motif === 'unclear' || motif === 'unknown' || motif === 'absent';
  const hasGeom = palm.line_geometry?.some((g) => g.name === key) ?? false;
  const live = palm.geometry_source === 'opencv_creases' || palm.geometry_source === 'vision_model';
  return (live && hasGeom) || !unclear;
}

export function palmLineBilingualName(key: string): string {
  return REKHA[key]?.bilingual ?? key;
}

export function palmLineMotifChip(palm: PalmAnalysisDto, key: string): string | null {
  const raw = (palm as Record<string, unknown>)[key];
  if (typeof raw !== 'string') return null;
  const motif = raw.toLowerCase().trim();
  if (!motif || motif === 'not_clearly_visible' || motif === 'unclear' || motif === 'unknown' || motif === 'absent') {
    return null;
  }
  return motif.replace(/_/g, ' ');
}

export function palmLineInsights(palm: PalmAnalysisDto, seed: string): PalmLineInsight[] {
  const digs = seedDigits(seed || 'lines', 6);
  const rows: Array<{
    key: string;
    base: { descriptor: string; text: string; unclear: boolean };
    dig: number;
    min: number;
    max: number;
  }> = [
    { key: 'life_line', base: motifBundle(LIFE, palm.life_line), dig: digs[0] ?? 0.7, min: 74, max: 92 },
    { key: 'heart_line', base: motifBundle(HEART, palm.heart_line), dig: digs[1] ?? 0.6, min: 70, max: 90 },
    { key: 'head_line', base: motifBundle(HEAD, palm.head_line), dig: digs[2] ?? 0.65, min: 72, max: 88 },
    { key: 'fate_line', base: motifBundle(FATE, palm.fate_line), dig: digs[3] ?? 0.55, min: 62, max: 88 },
    { key: 'sun_line', base: motifBundle(SUN, palm.sun_line), dig: digs[4] ?? 0.5, min: 60, max: 86 },
    {
      key: 'marriage_line',
      base: motifBundle(MARRIAGE, palm.marriage_line),
      dig: digs[5] ?? 0.52,
      min: 58,
      max: 86,
    },
  ];

  const majors = new Set(['life_line', 'heart_line', 'head_line']);
  const mapped = rows.map(({ key, base, dig, min, max }) => {
    const meta = REKHA[key]!;
    const fields = lineDetailFields(palm, key);
    const locked = isLockedPalmLine(palm, key);
    const unclear = base.unclear || !locked;
    return {
      lineKey: key,
      lineName: meta.bilingual,
      rekhaName: meta.rekha,
      descriptor: unclear ? UNCLEAR.descriptor : base.descriptor,
      interpretation: unclear ? UNCLEAR.text : enrichInterpretation(base.text, fields),
      score: unclear ? 0 : lineScore(dig, palm, key, false, min, max),
      unclear,
      ...fields,
    };
  });

  const majorCards = mapped.filter((row) => majors.has(row.lineKey));
  const secondaryCards = mapped.filter((row) => !majors.has(row.lineKey) && !row.unclear);
  const missingSecondary = mapped.some((row) => !majors.has(row.lineKey) && row.unclear);
  if (!missingSecondary) return [...majorCards, ...secondaryCards];
  return [
    ...majorCards,
    ...secondaryCards,
    {
      lineKey: 'other_lines',
      lineName: 'Other lines',
      descriptor: UNCLEAR.descriptor,
      interpretation: UNCLEAR.text,
      score: 0,
      unclear: true,
    },
  ];
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
  return `There is an interesting tension running through your palm — ${motif}.`;
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
  const traitList = Array.isArray(palm.traits) ? palm.traits : [];
  const traits =
    traitList.length > 0
      ? traitList
          .slice(0, 2)
          .map((t) => t.replace(/_/g, ' '))
          .join(' and ')
      : 'depth and intuition';
  return `Your ${life.descriptor.toLowerCase()} Life Line · Jeevan Rekha and ${heart.descriptor.toLowerCase()} Heart Line · Hridaya Rekha suggest someone ${traits} — you take things in quietly and speak up only when it truly matters.`;
}

export function palmSelfSectionBody(palm: PalmAnalysisDto): string {
  const motif = palmMotifPhrase(palm);
  const head = pick(HEAD, palm.head_line, HEAD.medium);
  return `What stands out is how your ${head.descriptor.toLowerCase()} Head Line · Mastishka Rekha works with the pattern of ${motif}. Sometimes planning protects you; sometimes it keeps people at arm's length. Your challenge may be wanting certainty before you allow yourself to move.`;
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
  const traitSource = Array.isArray(palm.traits) && palm.traits.length > 0
    ? palm.traits
    : ['creative', 'independent', 'intuitive', 'empathetic'];
  const traits = traitSource
    .slice(0, 4)
    .map((t) => capitalize(t.replace(/_/g, ' ')));

  const shadowTraits = [
    SHADOW_POOL[Math.floor((digs[0] ?? 0) * SHADOW_POOL.length) % SHADOW_POOL.length],
    SHADOW_POOL[Math.floor((digs[1] ?? 0.4) * SHADOW_POOL.length) % SHADOW_POOL.length],
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  const strengths = [
    { label: 'Leadership', value: 4 + Math.round((digs[2] ?? 0.5) * 1) },
    { label: 'Problem Solving', value: 4 + Math.round((digs[3] ?? 0.6) * 1) },
    { label: 'Communication', value: 4 + Math.round((digs[4] ?? 0.4) * 1) },
  ];

  const persona = capitalize(palm.personality || 'visionary');
  const shape = palm.hand_shape ? capitalize(palm.hand_shape.replace(/_/g, ' ')) : null;
  const mountBits = palm.mounts
    ? Object.entries(palm.mounts)
        .filter(([, v]) => v && v !== 'flat')
        .slice(0, 3)
        .map(([k, v]) => `${MOUNT_DUAL[k] ?? capitalize(k)} (${v})`)
    : [];
  const mountFrag = mountBits.length > 0 ? ` Mounts of note: ${mountBits.join(', ')}.` : '';
  const shapeFrag = shape ? ` Your ${shape.toLowerCase()} hand shape frames how this energy shows up.` : '';
  const description = `You are ${traits
    .slice(0, 3)
    .map((t) => t.toLowerCase())
    .join(', ')} — and that shows in how your Head Line · Mastishka Rekha and Heart Line · Hridaya Rekha work together. Your ${persona.toLowerCase()} nature is a strong inner voice.${shapeFrag}${mountFrag} The blind spot is often wanting certainty before you move.`;

  return { traits, shadowTraits, strengths, description, handShape: shape, mounts: palm.mounts ?? null };
}

export type MountSummary = { name: string; level: string };

export function mountSummaries(palm: PalmAnalysisDto): MountSummary[] {
  if (!palm.mounts) return [];
  return Object.entries(palm.mounts)
    .filter(([, level]) => Boolean(level))
    .map(([name, level]) => ({
      name: MOUNT_DUAL[name] ?? capitalize(name.replace(/_/g, ' ')),
      level: String(level),
    }));
}

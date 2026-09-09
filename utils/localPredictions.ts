import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import type {
  PredictionCategory,
  PredictionItem,
  PredictionPeriod,
  PredictionsResponse,
} from '@/types/predictions';
import { inRange, seedDigits } from '@/utils/deterministicNumbers';
import { isLockedPalmLine } from '@/utils/palmInsights';

const PERIOD_WINDOW: Record<PredictionPeriod, string> = {
  month: 'this month',
  '3month': 'the next three months',
  year: 'the year ahead',
};

const PERIOD_BEATS: Record<PredictionPeriod, string[]> = {
  month: ['This week', 'Mid-month', 'Closing days'],
  '3month': ['Weeks 1–4', 'Weeks 5–8', 'Weeks 9–12'],
  year: ['Q1', 'Q2', 'Q3', 'Q4'],
};

const CATEGORIES: PredictionCategory[] = ['career', 'love', 'money', 'growth'];

function cite(palm: PalmAnalysisDto | null | undefined, key: keyof PalmAnalysisDto, theme: string): string {
  if (palm && isLockedPalmLine(palm, String(key))) {
    const v = palm[key];
    const motif = typeof v === 'string' && v.trim() ? v.trim().toLowerCase() : 'observed';
    return `${String(key).replace('_', ' ')} (${motif})`;
  }
  return `the pattern of ${theme}`;
}

/** Deterministic offline predictions grounded in locked palm motifs when available. */
export function buildLocalPredictions(
  seed: string,
  period: PredictionPeriod,
  palm?: PalmAnalysisDto | null,
): PredictionsResponse {
  const window = PERIOD_WINDOW[period];
  const digs = seedDigits(`${seed}:${period}`, CATEGORIES.length * 2);
  const theme = 'independence vs closeness';
  const careerCite = cite(palm, 'fate_line', theme);
  const loveCite = cite(palm, 'heart_line', theme);
  const moneyCite = cite(palm, 'sun_line', theme);
  const growthCite = cite(palm, 'life_line', theme);
  const beatLabels = PERIOD_BEATS[period];

  const details: Record<PredictionCategory, { headline: string; detail: string; insight: string }> = {
    career: {
      headline: 'Path comes into focus',
      detail: `${window.charAt(0).toUpperCase()}${window.slice(1)}, ${careerCite} asks for ownership over waiting. The pattern of ${theme} may show up as a choice between certainty and momentum — pick one lane before you need a perfect map. Progress will feel quieter than dramatic, but more durable if you claim it.`,
      insight: `Work wants a clearer claim ${window}. ${careerCite} traditionally favors choosing a direction before every answer is certain — not rushing, but stopping the stall. Notice where ${theme} makes you wait for permission you already have. One visible commitment beats three half-started plans; name the next concrete step and protect time for it. If doubt arrives mid-period, treat it as a signal to simplify scope, not abandon the path. Talk to one person who can unblock you rather than rehearsing the whole plan alone. Keep a short weekly check: what moved, what stalled, what you will try once. The palm tone here is steady ambition — paced, not performative.`,
    },
    love: {
      headline: 'Honesty softens the edge',
      detail: `Clarity in connection matters ${window}. ${loveCite} suggests saying what you mean without forcing a timeline. Warmth lands better when it is specific — one true sentence over a performance of certainty. The period favors repair and naming over guessing.`,
      insight: `Closeness ${window} is less about a grand gesture and more about one honest sentence grounded in ${loveCite}. Traditionally this reads as paced trust: warmth that does not rush a verdict. Where ${theme} appears, name it instead of withdrawing. Ask one clear question, listen without rewriting their answer, and notice whether your body softens or braces. Repair is often quieter than romance — a check-in, an apology, a boundary spoken kindly. If you feel the urge to test someone, pause and state the need underneath the test. Give the connection room to respond without scoring it as a final answer. Soft honesty is the skill this window is teaching.`,
    },
    money: {
      headline: 'Skill over sudden luck',
      detail: `Finances find rhythm ${window}. ${moneyCite} traditionally favors persistence and visible craft more than windfalls. Small discipline compounds faster than a dramatic reset. Treat money as a craft you can practice, not a mood.`,
      insight: `Material life ${window} compounds through one visible skill. ${moneyCite} is more compatible with craft you can point to — a deliverable, a rate you can defend, a habit that shows up weekly. Let small discipline sit next to ${theme} instead of chasing a dramatic reset. Track one inflow and one outflow with honesty; trim the noise that pretends to be strategy. Abundance here looks like steadiness you can feel in your calendar, not a lottery ticket. If envy flares, translate it into one skill gap you can practice. Protect a quiet money hour each week — review, adjust, then stop. The palm favors earned rhythm over sudden spikes.`,
    },
    growth: {
      headline: 'A pattern becomes visible',
      detail: `You may notice ${theme} more clearly ${window}. ${growthCite} supports pacing change without abandoning yourself. Watch the pattern without turning it into a verdict. Growth arrives as accuracy, not intensity.`,
      insight: `${window.charAt(0).toUpperCase()}${window.slice(1)} is a good window to watch ${theme} without turning it into a verdict. ${growthCite} traditionally supports change that keeps your pacing intact. One honest adjustment beats a total reinvention: a bedtime, a boundary, a practice you return to when the mind races. When old habits flare, treat them as data — what were you protecting? Growth here is not louder effort; it is kinder accuracy about what actually restores you. Write one sentence about the pattern when it appears, then choose a 2% response. Ask for support in one specific way instead of carrying the whole shift alone. Let the period teach you steadiness more than spectacle.`,
    },
  };

  const beatCopy: Record<PredictionCategory, (label: string) => string> = {
    career: (label) =>
      `${label}: choose one ownership move in work — a decision, a send, or a calendar block — and complete it before expanding scope. Notice where waiting for certainty is costing momentum.`,
    love: (label) =>
      `${label}: offer one clear sentence of honesty. Listen for the reply without planning the next three moves, and notice if your body softens or braces.`,
    money: (label) =>
      `${label}: advance one visible craft or money habit — a rate, a deliverable, or a simple tracking check. Keep it small enough to finish the same day.`,
    growth: (label) =>
      `${label}: notice ${theme} once without fixing it. Then make one small adjustment that protects your pacing, and write what you learned in a single line.`,
  };

  const items: PredictionItem[] = CATEGORIES.map((category, i) => {
    const pick = details[category];
    return {
      category,
      headline: pick.headline,
      detail: pick.detail,
      insight: pick.insight,
      beats: beatLabels.map((label) => ({
        label,
        text: beatCopy[category](label),
      })),
      score: inRange(digs[i + CATEGORIES.length] ?? 0.5, 68, 94),
    };
  });

  return { period, items, generatedAt: new Date().toISOString() };
}

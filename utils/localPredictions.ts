import type {
  PredictionCategory,
  PredictionItem,
  PredictionPeriod,
  PredictionsResponse,
} from '@/types/predictions';
import { inRange, seedDigits } from '@/utils/deterministicNumbers';

const PERIOD_WINDOW: Record<PredictionPeriod, string> = {
  month: 'this month',
  '3month': 'the next three months',
  year: 'the year ahead',
};

type Template = { headline: string; detail: (window: string) => string };

const TEMPLATES: Record<PredictionCategory, Template[]> = {
  career: [
    {
      headline: 'An unexpected opening',
      detail: (w) => `A door you didn't plan for opens ${w}. Say yes before you feel fully ready.`,
    },
    {
      headline: 'Recognition arrives',
      detail: (w) => `Your quiet effort gets noticed ${w}. Let someone advocate for you.`,
    },
  ],
  love: [
    {
      headline: 'A meaningful conversation',
      detail: (w) => `Clarity comes through honesty ${w}. The right words land softer than you expect.`,
    },
    {
      headline: 'Deeper connection',
      detail: (w) => `Someone moves closer ${w}. Stay open without rushing the ending.`,
    },
  ],
  money: [
    {
      headline: 'Steady abundance',
      detail: (w) => `Your finances find rhythm ${w}. A small discipline compounds into real ease.`,
    },
    {
      headline: 'A wise decision',
      detail: (w) => `Pause before a purchase ${w}; patience here pays you back twice.`,
    },
  ],
  growth: [
    {
      headline: 'A pattern breaks',
      detail: (w) => `You outgrow an old loop ${w}. Notice what no longer fits and let it go.`,
    },
    {
      headline: 'Inner momentum',
      detail: (w) => `Your discipline deepens ${w}. One honest habit changes the whole story.`,
    },
  ],
};

const CATEGORIES: PredictionCategory[] = ['career', 'love', 'money', 'growth'];

/** Deterministic offline predictions so the screen always renders. */
export function buildLocalPredictions(seed: string, period: PredictionPeriod): PredictionsResponse {
  const window = PERIOD_WINDOW[period];
  const digs = seedDigits(`${seed}:${period}`, CATEGORIES.length * 2);

  const items: PredictionItem[] = CATEGORIES.map((category, i) => {
    const pool = TEMPLATES[category];
    const pick = pool[Math.floor((digs[i] ?? 0) * pool.length) % pool.length] ?? pool[0];
    return {
      category,
      headline: pick.headline,
      detail: pick.detail(window),
      score: inRange(digs[i + CATEGORIES.length] ?? 0.5, 68, 94),
    };
  });

  return { period, items, generatedAt: new Date().toISOString() };
}

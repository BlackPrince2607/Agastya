import type { FocusTopic } from '@/store/sessionStore';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import type { SimulatedReading } from '@/types/report';
import { inRange, seedDigits } from '@/utils/deterministicNumbers';
import { buildSeedLifeMetrics } from '@/utils/lifeMetrics';
import {
  palmArchetypeLine,
  palmHeadline,
  palmSelfSectionBody,
  palmVisionarySubtitle,
  palmVisionaryTitle,
} from '@/utils/palmInsights';

const DEFAULT_PALM: PalmAnalysisDto = {
  life_line: 'strong',
  heart_line: 'curved',
  head_line: 'long',
  personality: 'visionary',
  traits: ['independent', 'intuitive'],
};

/** V1: deterministic “reading” layered on ritual + chosen topics—not computer vision output. */
export function buildSimulatedReading(
  seedHint: string,
  focusTopics?: FocusTopic[],
  palmAnalysis?: PalmAnalysisDto | null,
): SimulatedReading {
  const palm = palmAnalysis ?? DEFAULT_PALM;
  const digs = seedDigits(seedHint || 'pulse', 8);
  const focus = focusTopics ?? [];
  const base = buildSeedLifeMetrics(digs, focus);

  const auraPalette = [
    ['#7c3aed', '#a855f7', '#06b6d4', '#2dd4bf'] as const,
    ['#db2777', '#9333ea', '#38bdf8', '#818cf8'] as const,
    ['#0891b2', '#6366f1', '#e879f9', '#fde047'] as const,
  ];
  const aura = auraPalette[inRange(digs[4] ?? 0.5, 0, auraPalette.length - 1)]!;
  const auraNames = ['Crystalline Violet', 'Nebula Rose', 'Aurora Meridian'];
  const auraLabel = auraNames[inRange(digs[4] ?? 0.5, 0, auraNames.length - 1)]!;

  return {
    blueprintTitle: 'Your Life Blueprint',
    visionaryTitle: palmVisionaryTitle(palm),
    visionarySubtitle: palmVisionarySubtitle(palm),
    archetypeLine: palmArchetypeLine(palm),
    headline: palmHeadline(palm),
    sections: [
      {
        id: 'self',
        title: 'Who you are',
        body: palmSelfSectionBody(palm),
        tone: 'reveal',
      },
      {
        id: 'love',
        title: 'Love & connection',
        body:
          'You lead with intuition and hold back with restraint. The people close to you learn your patterns long before they meet the real, unguarded you. When you feel safe, warmth arrives quickly — and when you do not, you go quiet rather than conflict. The next chapter of connection asks for one clear ask instead of another careful silence.',
        tone: 'pattern',
      },
      {
        id: 'career',
        title: 'Drive & ambition',
        body:
          'You move fastest when the stakes feel meaningful, not when a task simply feels responsible. Give yourself work that matters and momentum follows. Your head line favors long arcs over quick wins; protect deep-focus blocks and say no to scatter. A near-term opportunity will reward the project you keep returning to when nobody is watching.',
        tone: 'pattern',
      },
      {
        id: 'money',
        title: 'Money & security',
        body:
          'Your sense of comfort sits between careful planning and quiet worry. Naming the thing you are avoiding makes it far easier to handle. Build one simple system — a weekly review, a named savings goal, or a boundary around impulse spends — and your money story softens. Security grows from small consistent choices, not dramatic overhauls.',
        tone: 'forecast',
      },
    ],
    boldPrediction:
      'In the coming weeks, something you brushed off as coincidence will get harder to ignore. It may be time to set one boundary you have been putting off.',
    metrics: base,
    aura: { label: auraLabel, gradient: aura },
  };
}

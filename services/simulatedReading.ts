import type { FocusTopic } from '@/store/sessionStore';
import type { SimulatedReading } from '@/types/report';
import { inRange, seedDigits } from '@/utils/deterministicNumbers';

/** V1: deterministic “reading” layered on ritual + chosen topics—not computer vision output. */
export function buildSimulatedReading(seedHint: string, focusTopics?: FocusTopic[]): SimulatedReading {
  const condensed = seedHint.slice(0, 32).trim() || 'stillness';
  const digs = seedDigits(seedHint || 'pulse', 8);
  const base: Record<'love' | 'career' | 'money' | 'growth', number> = {
    love: inRange(digs[0] ?? 0, 52, 86),
    career: inRange(digs[1] ?? 0, 58, 92),
    money: inRange(digs[2] ?? 0, 40, 78),
    growth: inRange(digs[3] ?? 0, 55, 90),
  };
  const focus = focusTopics ?? [];
  for (const topic of focus) {
    const key =
      topic === 'love' || topic === 'matching'
        ? 'love'
        : topic === 'career'
          ? 'career'
          : topic === 'money'
            ? 'money'
            : 'growth';
    base[key] = Math.min(95, Math.round(base[key] * 1.08));
  }

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
    visionaryTitle: 'The Visionary',
    visionarySubtitle: 'Architect of Quiet Intensity',
    archetypeLine: `Your patterns suggest someone who takes things in quietly—and speaks up only when it truly matters.`,
    headline: `The pattern “${condensed}” runs quietly through the way you move.`,
    sections: [
      {
        id: 'self',
        title: 'Who you are',
        body: `You turn overwhelm into plans. Sometimes that protects you; sometimes it keeps people at arm’s length. The theme “${condensed}” keeps surfacing whenever you put off being direct.`,
      },
      {
        id: 'love',
        title: 'Love & connection',
        body: 'You lead with intuition and hold back with restraint. The people close to you learn your patterns long before they meet the real, unguarded you.',
      },
      {
        id: 'career',
        title: 'Drive & ambition',
        body: 'You move fastest when the stakes feel meaningful—not when a task simply feels responsible. Give yourself work that matters and momentum follows.',
      },
      {
        id: 'money',
        title: 'Money & security',
        body: 'Your sense of comfort sits between careful planning and quiet worry. Naming the thing you’re avoiding makes it far easier to handle.',
      },
    ],
    boldPrediction:
      'In the coming weeks, something you brushed off as coincidence will get harder to ignore—until you set one boundary you’ve been putting off.',
    metrics: base,
    aura: { label: auraLabel, gradient: aura },
  };
}

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
      topic === 'love' || topic === 'matching' || topic === 'dating'
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
    archetypeLine: `Your patterns suggest someone who gathers signal in silence—and releases it only when the room finally earns the heat.`,
    headline: `The constellation “${condensed}” hums beside your pacing.`,
    sections: [
      {
        id: 'self',
        title: 'Inner Cartography',
        body: `You translate overwhelm into itineraries. Sometimes that protects you; sometimes it exiles tenderness. The motif “${condensed}” keeps surfacing whenever you postpone being direct.`,
      },
      {
        id: 'love',
        title: 'Love Currents',
        body: 'You reach first with intuition, apologize second with restraint. Attachment learns your choreography long before anyone meets the backstage version.',
      },
      {
        id: 'career',
        title: 'Ambition Strand',
        body: 'Momentum appears when stakes feel mythic—not when tasks feel virtuous. You require meaningful gravity to mobilize cleanly.',
      },
      {
        id: 'money',
        title: 'Resource Lore',
        body: 'Comfort is negotiated between spreadsheets and nightmares. Naming the phantom bill softens negotiation with reality.',
      },
    ],
    boldPrediction:
      'Within forty rotations of the moon something you waved off as synchronicity knocks louder—until you redraw one invisible boundary.',
    metrics: base,
    aura: { label: auraLabel, gradient: aura },
  };
}

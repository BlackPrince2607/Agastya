import type { Task, TaskCategory } from '@/types/task';

/** Deterministic offline daily tasks so the screen always renders (reflection last). */
export const LOCAL_TASKS: Task[] = [
  {
    id: 'local-gratitude',
    text: 'Practice gratitude',
    description: 'Write down three things you are grateful for today.',
    category: 'growth',
    estimatedMinutes: 5,
    difficulty: 'easy',
    examples: ['A person who helped you', 'A small win', 'Something you often overlook'],
  },
  {
    id: 'local-bold-step',
    text: 'Take a bold step',
    description: 'Do something today that scares you a little but moves you forward.',
    category: 'career',
    estimatedMinutes: 15,
    difficulty: 'medium',
    examples: ['Start that conversation', 'Apply for that role', 'Share your idea'],
  },
  {
    id: 'evening-reflection',
    text: 'Evening reflection',
    description: 'Pause for a moment. Note your mood, energy, and one challenge in a few words.',
    category: 'growth',
    estimatedMinutes: 5,
    difficulty: 'easy',
    examples: ['Mood: steady / heavy / hopeful', 'Energy: 1–10', 'Challenge: one sentence'],
  },
];

const CATEGORY_FALLBACK: TaskCategory = 'growth';

/** Normalize loosely-typed API task payloads into the strict Task shape. */
export function normalizeTask(raw: unknown, index: number): Task {
  if (typeof raw === 'string') {
    return {
      id: `task-${index}`,
      text: raw,
      description: raw,
      category: CATEGORY_FALLBACK,
      estimatedMinutes: 10,
      difficulty: 'easy',
      examples: [],
    };
  }
  const r = (raw ?? {}) as Record<string, unknown>;
  const text = typeof r.text === 'string' ? r.text.trim() : '';
  const description = typeof r.description === 'string' ? r.description.trim() : '';
  return {
    id: typeof r.id === 'string' ? r.id : `task-${index}`,
    text: text || 'Daily action',
    description,
    category: (['love', 'career', 'money', 'growth'].includes(r.category as string)
      ? r.category
      : CATEGORY_FALLBACK) as TaskCategory,
    estimatedMinutes: typeof r.estimatedMinutes === 'number' ? r.estimatedMinutes : 10,
    difficulty: (['easy', 'medium', 'hard'].includes(r.difficulty as string)
      ? r.difficulty
      : 'easy') as Task['difficulty'],
    examples: Array.isArray(r.examples) ? (r.examples as unknown[]).filter((e): e is string => typeof e === 'string') : [],
  };
}

/** Ensure offline/API ritual lists always close with evening reflection. */
export function ensureEveningReflection(tasks: Task[]): Task[] {
  const others = tasks.filter((t) => t.id !== 'evening-reflection').slice(0, 2);
  const reflection =
    tasks.find((t) => t.id === 'evening-reflection') ??
    LOCAL_TASKS.find((t) => t.id === 'evening-reflection')!;
  while (others.length < 2) {
    const pad = LOCAL_TASKS.find((t) => t.id !== 'evening-reflection' && !others.some((o) => o.id === t.id));
    if (!pad) break;
    others.push(pad);
  }
  return [...others, reflection];
}

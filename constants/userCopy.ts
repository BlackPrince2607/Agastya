import type { ComponentProps } from 'react';
import type FontAwesome from '@expo/vector-icons/FontAwesome';

import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import type { InsightSection } from '@/types/report';

export const APP_BRAND = 'Agastya';

export const SIGN_IN_UNAVAILABLE =
  'Sign-in isn’t available right now. You can still enjoy your reading on this device.';

export const SYNC_NOTICE_FAILED =
  'We couldn’t sync your latest reading. You’re viewing what’s saved on this device.';

export const OFFLINE_LIMITED_LABEL = 'Some features may be limited while offline.';

export const SAMPLE_READING_BADGE = 'Sample reading';

export const GUIDE_FINISH_PALM_FIRST =
  'Complete your palm reading first—then the Guide can personalize answers for you.';

export type HomeShortcutAction = 'guide' | 'compat' | 'report' | 'tasks' | 'paywall';

export type HomeShortcut = {
  icon: ComponentProps<typeof FontAwesome>['name'];
  label: string;
  hint: string;
  action: HomeShortcutAction;
  highlight?: boolean;
};

export const HOME_SHORTCUTS: HomeShortcut[] = [
  { icon: 'file-text-o', label: 'Palm report', hint: 'Your full reading and scores', action: 'report' },
  { icon: 'comments-o', label: 'Guide', hint: 'Ask questions about your reading', action: 'guide' },
  { icon: 'check-circle-o', label: 'Today', hint: 'Personalized daily actions', action: 'tasks' },
  { icon: 'heart-o', label: 'Compatibility', hint: 'Compare names and vibes', action: 'compat' },
];

export const FALLBACK_DAILY_TASKS = [
  'Send one honest message you’ve been postponing.',
  'Take a 10-minute walk without your phone.',
  'Write down one fear, then one small step past it.',
];

export const TASKS_FALLBACK_NOTICE = 'Showing general suggestions until we can personalize your list.';

export const TASKS_EMPTY_NO_PALM = {
  title: 'Personal tasks unlock after your reading',
  body: 'Finish your palm scan to receive daily actions tailored to your focus areas.',
  action: 'Continue setup',
} as const;

export const ANALYSIS_LOADING_PHRASES = [
  'Reading your palm lines…',
  'Matching patterns to your focus areas…',
  'Preparing your personal report…',
];

export const ANALYSIS_LOADING_CHIPS: readonly [string, string] = [
  'Reading your palm',
  'Building your profile',
];

export const ANALYSIS_OFFLINE_NOTICE =
  'You’re offline—we saved a preview on this device. Connect to sync your full reading.';

export const PALM_CAPTURE_FAILED =
  'We couldn’t capture your palm. Try again in better light with your hand steady.';

export const AI_VOICE_HINTS = [
  'You often think things through longer than you let on—and that’s a strength when you finally speak.',
  'The next step doesn’t have to be big; it has to be honest.',
  'What you’re avoiding naming is usually what wants your attention most.',
];

export const PROFILE_DEFAULT_NAME = 'Your profile';

export const JOURNEY_DAY_LABEL = (days: number) => `Day ${days} of your journey`;

export const JOURNEY_DAY_FOOTNOTE = 'Based on your reading rhythm on this device';

const LIFE_LABELS: Record<string, string> = {
  strong: 'Strong life line',
  moderate: 'Steady life line',
  subtle: 'Gentle life line',
};

const HEART_LABELS: Record<string, string> = {
  straight: 'Clear heart line',
  curved: 'Warm heart line',
  broken: 'Complex heart line',
};

const HEAD_LABELS: Record<string, string> = {
  short: 'Focused mind line',
  medium: 'Balanced mind line',
  long: 'Deep thinker’s line',
};

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function palmReadingChips(p: PalmAnalysisDto): [string, string] {
  const life =
    LIFE_LABELS[String(p.life_line).toLowerCase()] ?? `Life line · ${capitalize(String(p.life_line))}`;
  const heart = HEART_LABELS[String(p.heart_line).toLowerCase()];
  const head = HEAD_LABELS[String(p.head_line).toLowerCase()];
  const personality =
    typeof p.personality === 'string' && p.personality.trim().length > 0
      ? capitalize(p.personality.trim())
      : '';
  const second = personality ? `${personality} energy` : heart ?? head ?? 'Personal signature';
  return [life, second];
}

export function buildDailyInsight(palm: PalmAnalysisDto | null): InsightSection {
  if (!palm) {
    return {
      id: 'daily',
      title: 'Today’s insight',
      body: 'Take one small step toward what you already know matters. Clarity grows when you stop waiting for a perfect moment.',
    };
  }

  const traits =
    palm.traits.length > 0
      ? palm.traits.slice(0, 2).map((t) => capitalize(t.replace(/_/g, ' '))).join(' and ')
      : 'curiosity and depth';

  return {
    id: 'daily',
    title: capitalize(palm.personality),
    body: `Your reading points to ${traits}. Today is a good day for honest conversations and steady progress—not big leaps, but real ones.`,
  };
}

export function displayNameOrDefault(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed?.length ? trimmed : PROFILE_DEFAULT_NAME;
}

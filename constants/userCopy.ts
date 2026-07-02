import type { ComponentProps } from 'react';
import type FontAwesome from '@expo/vector-icons/FontAwesome';

import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import type { InsightSection } from '@/types/report';

export const APP_BRAND = 'Agastya';

export const SIGN_IN_UNAVAILABLE =
  'Sign-in isn’t available right now. You can still enjoy your reading on this device.';

export const EMAIL_MAGIC_LINK_SENT =
  'We sent a sign-in link. Open it on this device to finish signing in.';

export const EMAIL_CONFIRM_SENT =
  'We sent a confirmation link to your inbox. Open it on this same phone, then come back here and sign in with your password.';

export const EMAIL_RESET_SENT =
  'We sent a password reset link. Open it on this device to choose a new password.';

export const PASSWORD_MISMATCH = 'Passwords do not match.';

export const AUTH_WRONG_PASSWORD_HINT =
  'That password did not work. If you joined with Google or Apple, use that button instead. If you are new, tap Create account. You can also use Email me a sign-in link. No password needed.';

export const AUTH_ACCOUNT_EXISTS_HINT =
  'An account already exists for this email. Sign in with your password, Google, or Apple.';

export const AUTH_RATE_LIMIT_HINT =
  'Too many emails were sent recently. If you already created an account, sign in with your password below. Otherwise wait about an hour and try again.';

export const AUTH_MAGIC_LINK_HELP =
  'Check spam or promotions. Open the link on this same device.';

export const SYNC_NOTICE_FAILED =
  'We couldn’t sync your latest reading. You’re viewing what’s saved on this device.';

export const SYNC_NOTICE_MERGE_FAILED =
  'Sign-in succeeded but we couldn’t link your reading to your account. Try again from Profile.';

export const SAMPLE_READING_BADGE = 'Sample reading';

export const GUIDE_FINISH_PALM_FIRST =
  'Complete your palm reading first. Then the Guide can answer questions about your report.';

export type HomeShortcutAction = 'guide' | 'compat' | 'report' | 'tasks' | 'paywall';

export type HomeShortcut = {
  icon: ComponentProps<typeof FontAwesome>['name'];
  label: string;
  hint: string;
  action: HomeShortcutAction;
  highlight?: boolean;
};

export const HOME_SHORTCUTS: HomeShortcut[] = [
  { icon: 'file-text-o', label: 'Palm report', hint: 'Your full reading and line scores', action: 'report' },
  { icon: 'comments-o', label: 'Guide', hint: 'Ask questions about your reading', action: 'guide' },
  { icon: 'check-circle-o', label: 'Daily tasks', hint: 'Daily actions based on your reading', action: 'tasks' },
  { icon: 'heart-o', label: 'Compatibility', hint: 'Compare palm readings', action: 'compat' },
];

export const FALLBACK_DAILY_TASKS = [
  'Send one message you have been putting off.',
  'Take a 10-minute walk without your phone.',
  'Write down one worry and one small next step.',
];

export const TASKS_EMPTY_NO_PALM = {
  title: 'Tasks unlock after your reading',
  body: 'Finish your palm scan to get daily actions matched to your focus areas.',
  action: 'Continue setup',
} as const;

export const ANALYSIS_LOADING_PHRASES = [
  'Reading your palm lines',
  'Matching patterns to your focus areas',
  'Preparing your report',
];

export const ANALYSIS_LOADING_CHIPS: readonly [string, string] = [
  'Reading your palm',
  'Building your profile',
];

export const PALM_CAPTURE_FAILED =
  'We couldn’t capture your palm. Try again in better light with your hand steady.';

export const AI_VOICE_HINTS = [
  'You often think things through before you speak. That patience is a strength.',
  'The next step does not have to be big. It just has to be honest.',
  'What you keep avoiding is usually what needs your attention.',
];

export const PROFILE_DEFAULT_NAME = 'Your profile';

export const JOURNEY_DAY_LABEL = (days: number) => `Day ${days} with Agastya`;

export const JOURNEY_DAY_FOOTNOTE = 'Days you have opened the app on this device';

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
  const second = personality || (heart ?? head ?? 'Personal signature');
  return [life, second];
}

export function buildDailyInsight(palm: PalmAnalysisDto | null): InsightSection {
  if (!palm) {
    return {
      id: 'daily',
      title: 'Today’s insight',
      body: 'Take one small step toward what already matters to you. You do not need a perfect moment to start.',
    };
  }

  const traits =
    palm.traits.length > 0
      ? palm.traits.slice(0, 2).map((t) => capitalize(t.replace(/_/g, ' '))).join(' and ')
      : 'curiosity and depth';

  return {
    id: 'daily',
    title: capitalize(palm.personality),
    body: `Your reading points to ${traits}. Today is a good day for honest conversations and steady steps.`,
  };
}

export function displayNameOrDefault(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed?.length ? trimmed : PROFILE_DEFAULT_NAME;
}

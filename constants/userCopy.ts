import type { ComponentProps } from 'react';
import type FontAwesome from '@expo/vector-icons/FontAwesome';

import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import type { InsightSection } from '@/types/report';

export const APP_BRAND = 'Agastya';

export const SIGN_IN_UNAVAILABLE =
  "Sign-in isn't available right now. You can still enjoy your reading on this device.";

export const EMAIL_MAGIC_LINK_SENT =
  'We sent a sign-in link. Open it on this device to finish signing in.';

export const EMAIL_CONFIRM_SENT =
  'We sent a confirmation link to your inbox. Open it on this same phone, then come back here and sign in with your password. Check spam/promotions if you do not see it within a few minutes.';

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
  "We couldn't sync your latest reading. You're viewing what's saved on this device.";

export const SYNC_NOTICE_MERGE_FAILED =
  "Sign-in succeeded but we couldn't link your reading to your account. Try again from Profile.";

export const SAMPLE_READING_BADGE =
  'Provisional reading — analysis was unavailable, so this uses a sample pattern until you rescan';

export const GUIDE_FINISH_PALM_FIRST =
  'Complete your palm reading first. Then the Guide can answer questions about your report.';

export type HomeShortcutAction = 'guide' | 'compat' | 'report' | 'tasks' | 'paywall';

export type HomeShortcut = {
  icon: ComponentProps<typeof FontAwesome>['name'];
  label: string;
  /** Short tile subtitle under the title. */
  subtitle: string;
  hint: string;
  action: HomeShortcutAction;
  highlight?: boolean;
};

export const HOME_SHORTCUTS: HomeShortcut[] = [
  {
    icon: 'file-text-o',
    label: 'Palm Report',
    subtitle: 'View your reading',
    hint: 'Your full reading and line scores',
    action: 'report',
  },
  {
    icon: 'comments-o',
    label: 'Ask Agastya',
    subtitle: 'Chat about your Blueprint',
    hint: 'Ask questions about your reading and journey',
    action: 'guide',
  },
  {
    icon: 'check-circle-o',
    label: 'Daily Rituals',
    subtitle: "Complete today’s focus",
    hint: 'Daily actions based on your reading',
    action: 'tasks',
  },
  {
    icon: 'heart-o',
    label: 'Compatibility',
    subtitle: 'Discover connections',
    hint: 'Compare palm readings',
    action: 'compat',
  },
];

export const FALLBACK_DAILY_TASKS = [
  'Send one message you have been putting off.',
  'Take a 10-minute walk without your phone.',
  'Write down one worry and one small next step.',
];

export const TASKS_EMPTY_NO_PALM = {
  title: 'Rituals unlock after your reading',
  body: 'Finish your palm scan to receive daily actions matched to your focus areas.',
  action: 'Continue setup',
} as const;

export const TASKS_LOADING = 'Preparing today’s rituals…';
export const TASKS_ALL_DONE = 'All rituals complete';
export const TASKS_PROGRESS_HINT = 'Open a ritual to begin, or mark it done when you finish.';
export const TASK_DETAIL_COMPLETE = 'Mark as complete';
export const TASK_DETAIL_COMPLETED = 'Completed';
export const TASK_DETAIL_MISSING = {
  title: 'Ritual not found',
  body: 'This ritual may have refreshed for a new day. Return to today’s list to continue.',
  action: 'Back to rituals',
} as const;
export const REFLECTION_COMPLETE = 'Complete reflection';
export const REFLECTION_COMPLETED = 'Reflection saved';

export const ANALYSIS_LOADING_PHRASES = [
  'Reading your palm lines',
  'Matching patterns to your focus areas',
  'Preparing your report',
];

export const ANALYSIS_LOADING_CHIPS: readonly [string, string] = [
  'Reading your palm',
  'Building your profile',
];

export const ANALYSIS_SEAL_STATUS = 'reading';
export const ANALYSIS_STATUS_ALMOST = 'Almost ready…';
export const ANALYSIS_STATUS_READY = 'Your reading is ready';

export const CAMERA_PERMISSION_LOADING = 'Preparing camera…';
export const GALLERY_OPENING = 'Opening gallery…';

export const HOME_GUIDANCE_LOADING = "Gathering today’s guidance…";
export const HOME_WEEKLY_LOADING = 'Writing your week…';
export const HOME_CTA_READING = 'Open your reading';
export const HOME_CTA_BEGIN = 'Begin your reading';

export const REPORT_HYDRATING = 'Restoring your reading…';
export const REPORT_PREDICTIONS_LOADING = 'Shaping your forecast…';
export const REPORT_EMPTY = {
  title: 'Your palm report isn’t ready yet',
  body: 'Complete your palm scan to unlock your report and scores.',
  action: 'Start palm scan',
} as const;

export const PROFILE_JOURNEY_LOADING = 'Gathering your journey…';
export const PROFILE_TIMELINE_EMPTY = {
  title: 'Your journey begins here',
  body: 'Complete rituals and return each day — moments from your path will collect here.',
} as const;
export const PROFILE_WEEKLY_EMPTY = {
  title: 'Your week is still forming',
  body: 'Keep a few rituals going. A short summary appears when there is enough to reflect on.',
} as const;

export const CHAT_PLACEHOLDER_EMPTY = 'Ask about your reading…';
export const CHAT_PLACEHOLDER_FOLLOW = 'Ask a follow-up…';
export const GUIDE_INTRO =
  "I'm here with your Life Blueprint — ask about today, a decision on your mind, or something from your reading.";

export const PALM_CAPTURE_FAILED =
  "We couldn't capture your palm. Try again in better light with your hand steady.";

export const PALM_CAPTURE_PREPARING = 'Preparing your photo…';

export const PALM_REVIEW_TITLE = 'Check your palm photo';
export const PALM_REVIEW_SUBTITLE =
  'We read your open palm with vision and lock life, heart, and head lines before your Life Blueprint.';
export const PALM_REVIEW_RETAKE = 'Retake';
export const PALM_REVIEW_ANALYZE = 'Analyze palm';
export const PALM_REVIEW_ANALYZING = 'Reading your palm…';
export const PALM_REVIEW_NEED_HAND =
  'We couldn’t read that palm yet. Keep the full open hand in frame with even light, then retake.';

export const PALM_LINES_CONFIRM_TITLE = 'Confirm your lines';
export const PALM_LINES_CONFIRM_SUBTITLE =
  'These are the major creases we locked from your photo. Confirm to continue your Life Blueprint.';
export const PALM_LINES_CONFIRM_CTA = 'Looks good — continue';
export const PALM_LINES_CONFIRM_RETAKE = 'Retake photo';
export const PALM_LINES_BUILDING = 'Building your Life Blueprint…';

export const PALM_CAMERA_COACHING =
  'Ask someone to hold the phone, or rest it and photograph your other hand.';
export const PALM_CAMERA_CAPTURING = 'Capturing…';
export const PALM_CAMERA_CENTER = 'Center your hand inside the frame';

export const PALM_RETAKE_DEFAULT =
  "We couldn't read that palm clearly. Try brighter light and an open palm.";

export const PALM_RETAKE_BANNER_PREFIX = "Last photo wasn't clear enough —";

export const PALM_SCAN_TIPS = [
  { icon: 'sunny-outline' as const, label: 'Good light' },
  { icon: 'hand-right-outline' as const, label: 'Open palm' },
  { icon: 'expand-outline' as const, label: 'Fill frame' },
] as const;

export const PARTNER_PALM_REVIEW_TITLE = "Check your partner's palm";
export const PARTNER_PALM_REVIEW_ANALYZE = 'Analyze match';

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
  long: "Deep thinker's line",
};

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function palmReadingChips(p: PalmAnalysisDto): [string, string] {
  const life =
    LIFE_LABELS[String(p.life_line).toLowerCase()] ?? `Life line - ${capitalize(String(p.life_line))}`;
  const heart = HEART_LABELS[String(p.heart_line).toLowerCase()];
  const head = HEAD_LABELS[String(p.head_line).toLowerCase()];
  const personality =
    typeof p.personality === 'string' && p.personality.trim().length > 0
      ? capitalize(p.personality.trim())
      : '';
  const second = personality || (heart ?? head ?? 'Personal signature');
  return [life, second];
}

export type DailyInsight = InsightSection & {
  /** Short mystical quote for the home hero. */
  quote: string;
};

const ENERGY_QUOTES = [
  'Independent minds create extraordinary paths.',
  'Quiet courage often opens the next door.',
  'Steady attention turns possibility into path.',
  'Your depth is not a burden — it is a compass.',
  'What you notice today can rewrite tomorrow.',
] as const;

function quoteForEnergy(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i) * (i + 1)) % ENERGY_QUOTES.length;
  return ENERGY_QUOTES[hash] ?? ENERGY_QUOTES[0];
}

export function buildDailyInsight(palm: PalmAnalysisDto | null): DailyInsight {
  if (!palm) {
    return {
      id: 'daily',
      title: 'Awakening',
      body: 'Take one small step toward what already matters to you. You do not need a perfect moment to start.',
      quote: ENERGY_QUOTES[0],
    };
  }

  const traits =
    palm.traits.length > 0
      ? palm.traits.slice(0, 2).map((t) => capitalize(t.replace(/_/g, ' '))).join(' and ')
      : 'curiosity and depth';
  const title = capitalize(palm.personality) || 'Visionary';

  return {
    id: 'daily',
    title,
    body: `Your reading points to ${traits}. Today is a good day for honest conversations and steady steps.`,
    quote: quoteForEnergy(title),
  };
}

export function displayNameOrDefault(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed?.length ? trimmed : PROFILE_DEFAULT_NAME;
}

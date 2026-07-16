import { persistentStorage } from '@/services/persistentStorage';
import { utcTodayIso } from '@/utils/calendarDay';
import { utcWeekKey } from '@/utils/calendarWeek';

const STORAGE_KEY = 'agastya-guidance-v1';
const WEEKLY_STORAGE_KEY = 'agastya-weekly-v1';

export type LocalGuidanceCache = {
  date: string;
  title: string;
  body: string;
  focusTheme?: string | null;
  continueHint?: string | null;
  consistencyNote?: string | null;
};

export type LocalWeeklyCache = {
  weekKey: string;
  title: string;
  body: string;
  topTheme?: string | null;
  consistencyNote?: string | null;
  currentChapter?: string | null;
};

/** Process-lifetime memo — invalidated on write / date rollover. */
let dailyMemo: LocalGuidanceCache | null | undefined;
let weeklyMemo: LocalWeeklyCache | null | undefined;

function invalidateDailyMemo() {
  dailyMemo = undefined;
}
function invalidateWeeklyMemo() {
  weeklyMemo = undefined;
}

export async function readLocalGuidance(): Promise<LocalGuidanceCache | null> {
  if (dailyMemo !== undefined) {
    return dailyMemo;
  }
  try {
    const raw = await persistentStorage.getItem(STORAGE_KEY);
    if (!raw) {
      dailyMemo = null;
      return null;
    }
    const parsed = JSON.parse(raw) as LocalGuidanceCache;
    if (!parsed?.date || !parsed?.title || !parsed?.body) {
      dailyMemo = null;
      return null;
    }
    dailyMemo = parsed;
    return parsed;
  } catch {
    dailyMemo = null;
    return null;
  }
}

export async function writeLocalGuidance(entry: LocalGuidanceCache): Promise<void> {
  try {
    const prev = dailyMemo;
    if (
      prev &&
      prev.date === entry.date &&
      prev.title === entry.title &&
      prev.body === entry.body &&
      (prev.focusTheme ?? null) === (entry.focusTheme ?? null) &&
      (prev.continueHint ?? null) === (entry.continueHint ?? null) &&
      (prev.consistencyNote ?? null) === (entry.consistencyNote ?? null)
    ) {
      return;
    }
    dailyMemo = entry;
    await persistentStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    invalidateDailyMemo();
    /* quota / private mode */
  }
}

/** Return today's mirrored guidance if present. */
export async function readTodaysLocalGuidance(): Promise<LocalGuidanceCache | null> {
  const cached = await readLocalGuidance();
  if (!cached || cached.date !== utcTodayIso()) return null;
  return cached;
}

export async function readLocalWeekly(): Promise<LocalWeeklyCache | null> {
  if (weeklyMemo !== undefined) {
    return weeklyMemo;
  }
  try {
    const raw = await persistentStorage.getItem(WEEKLY_STORAGE_KEY);
    if (!raw) {
      weeklyMemo = null;
      return null;
    }
    const parsed = JSON.parse(raw) as LocalWeeklyCache;
    if (!parsed?.weekKey || !parsed?.title || !parsed?.body) {
      weeklyMemo = null;
      return null;
    }
    weeklyMemo = parsed;
    return parsed;
  } catch {
    weeklyMemo = null;
    return null;
  }
}

export async function writeLocalWeekly(entry: LocalWeeklyCache): Promise<void> {
  try {
    const prev = weeklyMemo;
    if (
      prev &&
      prev.weekKey === entry.weekKey &&
      prev.title === entry.title &&
      prev.body === entry.body &&
      (prev.topTheme ?? null) === (entry.topTheme ?? null) &&
      (prev.consistencyNote ?? null) === (entry.consistencyNote ?? null) &&
      (prev.currentChapter ?? null) === (entry.currentChapter ?? null)
    ) {
      return;
    }
    weeklyMemo = entry;
    await persistentStorage.setItem(WEEKLY_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    invalidateWeeklyMemo();
    /* quota / private mode */
  }
}

/** Return this ISO week's mirrored summary if present. */
export async function readThisWeeksLocalSummary(): Promise<LocalWeeklyCache | null> {
  const cached = await readLocalWeekly();
  if (!cached || cached.weekKey !== utcWeekKey()) return null;
  return cached;
}

export type BootstrapContextSlice = {
  dailyContext?: {
    date?: string;
    title?: string;
    body?: string;
    focusTheme?: string | null;
  } | null;
  weeklyContext?: {
    weekKey?: string;
    title?: string;
    body?: string;
    topTheme?: string | null;
    consistencyNote?: string | null;
    currentChapter?: string | null;
  } | null;
};

/** Hydrate local mirrors from bootstrap when current day/week chapters exist. */
export async function applyBootstrapContext(data: BootstrapContextSlice): Promise<void> {
  const daily = data.dailyContext;
  if (daily?.date === utcTodayIso() && daily.title && daily.body) {
    const existing = await readTodaysLocalGuidance();
    await writeLocalGuidance({
      date: daily.date,
      title: daily.title,
      body: daily.body,
      focusTheme: daily.focusTheme ?? existing?.focusTheme ?? null,
      continueHint: existing?.continueHint ?? null,
      consistencyNote: existing?.consistencyNote ?? null,
    });
  }

  const weekly = data.weeklyContext;
  if (weekly?.weekKey === utcWeekKey() && weekly.title && weekly.body) {
    await writeLocalWeekly({
      weekKey: weekly.weekKey,
      title: weekly.title,
      body: weekly.body,
      topTheme: weekly.topTheme ?? null,
      consistencyNote: weekly.consistencyNote ?? null,
      currentChapter: weekly.currentChapter ?? null,
    });
  }
}

/** ISO week key aligned with backend day_context.utc_week_key (UTC). */
export function utcWeekKey(): string {
  const d = new Date();
  // ISO week via UTC date parts
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Show weekly summary on Home once this week's chapter exists (or can be loaded). */
export function shouldShowWeeklyOnHome(): boolean {
  return true;
}

/** @deprecated Prefer shouldShowWeeklyOnHome — kept for call-site compatibility during polish. */
export function isUtcWeekStart(): boolean {
  return shouldShowWeeklyOnHome();
}

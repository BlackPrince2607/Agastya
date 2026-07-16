/** Canonical Agastya calendar day — UTC YYYY-MM-DD (matches backend day_context). */
export function utcTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** First letter(s) of a display name for avatar badges. */
export function initialsFor(name?: string): string {
  const trimmed = name?.trim();
  if (!trimmed) return 'A';
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

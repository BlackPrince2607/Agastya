/** Build a JPEG data URI from a raw or prefixed base64 palm capture. */
export function palmCaptureDataUri(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith('data:')) return raw;
  return `data:image/jpeg;base64,${raw}`;
}

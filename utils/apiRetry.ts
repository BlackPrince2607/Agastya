/** Retry an async call once after a delay when the error looks transient. */

const TRANSIENT_RE = /503|502|504|timeout|network|fetch|aborted|guide_llm_unavailable/i;

export function isTransientApiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return TRANSIENT_RE.test(msg);
}

export async function withApiRetry<T>(
  fn: () => Promise<T>,
  options?: { delayMs?: number; shouldRetry?: (err: unknown) => boolean },
): Promise<T> {
  const delayMs = options?.delayMs ?? 2000;
  const shouldRetry = options?.shouldRetry ?? isTransientApiError;
  try {
    return await fn();
  } catch (err) {
    if (!shouldRetry(err)) throw err;
    await new Promise((r) => setTimeout(r, delayMs));
    return fn();
  }
}

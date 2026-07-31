/** Retry an async call once after a delay when the error looks transient. */

// Do not retry client timeouts/aborts — server LLM attempts are already budgeted;
// a second client call doubles OpenRouter cost while the first may still be running.
const TRANSIENT_RE = /503|502|504|network|fetch|guide_llm_unavailable/i;
const NO_RETRY_RE = /timeout|aborted/i;

export function isTransientApiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (NO_RETRY_RE.test(msg)) return false;
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

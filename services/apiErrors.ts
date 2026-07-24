/** Map backend / client errors to user-friendly copy. */

export class ApiHttpError extends Error {
  readonly status: number;
  readonly rawDetail: string;

  constructor(message: string, status: number, rawDetail: string) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
    this.rawDetail = rawDetail;
  }
}

export const ERRORS = {
  network: "We couldn't reach Agastya right now. Check your connection and try again.",
  guideNeedsPalm: 'Complete your palm reading first. Then the Guide can answer questions about your report.',
  guideLlmUnavailable:
    'The Guide is temporarily unavailable. Check that OPENROUTER_API_KEY is valid in backend/.env and that your OpenAI model slug is correct.',
  missingSession: 'Something went wrong starting your session. Please restart the app.',
  mergeMismatch: "This sign-in doesn't match your current reading. Try signing in with the account you used before.",
  authRequired: 'Please sign in to continue.',
  authInvalid: 'Sign-in failed. Please try again.',
  palmRequired: 'We need your palm reading before we can build your report.',
  generic: 'Something went wrong. Please try again.',
} as const;

export function mapApiError(detail: string): string {
  const d = detail.toLowerCase();
  // FastAPI unknown-route body only — not "No saved session found" etc.
  if (d.trim() === 'not found' || /"detail"\s*:\s*"not found"/i.test(detail)) {
    return 'This feature is not available on the server yet. Redeploy the backend, then try again.';
  }
  if (d.includes('failed to save session') || d.includes('session storage temporarily unavailable')) {
    return 'Could not save your session. Check your connection and try again.';
  }
  if (d.includes('rate limit')) {
    return 'Too many requests. Wait a moment and try again.';
  }
  if (d.includes('fastapi') || d.includes('expo_public') || d.includes('transmission frayed')) {
    return ERRORS.network;
  }
  if (d.includes('token subject') || d.includes('supabaseuserid')) {
    return ERRORS.mergeMismatch;
  }
  if (d.includes('authorization bearer') || d.includes('bearer token required')) {
    return ERRORS.authRequired;
  }
  if (d.includes('invalid supabase') || d.includes('token missing subject')) {
    return ERRORS.authInvalid;
  }
  if (d.includes('palm analysis failed') || d.includes('please try again')) {
    return 'Palm reading failed on the server. Please try again in a moment.';
  }
  if (d.includes('palm vision not configured') || d.includes('openrouter_api_key')) {
    return 'Palm reading is not configured on the server yet. Add OPENROUTER_API_KEY and redeploy.';
  }
  if (d.includes('palm vision temporarily unavailable')) {
    return 'Palm reading is temporarily unavailable. Please try again in a moment.';
  }
  if (d.includes('guide_llm_unavailable')) {
    return ERRORS.guideLlmUnavailable;
  }
  if (d.includes('palm analysis before') || d.includes('run palm analysis')) {
    return ERRORS.palmRequired;
  }
  if (d.includes('deviceinstallid does not match')) {
    return 'This device no longer matches your saved session. Clear app data or tap Start fresh in Profile, then scan your palm again.';
  }
  if (d.includes('device identity is not ready')) {
    return ERRORS.missingSession;
  }
  if (d.includes('missing_session')) {
    return ERRORS.missingSession;
  }
  if (d.includes('health ') || d.includes('fetch') || d.includes('network')) {
    return ERRORS.network;
  }
  if (d.includes('aborted') || d.includes('timeout')) {
    return 'The Guide took too long to respond. Check your connection and try again.';
  }
  return ERRORS.generic;
}

/** True when the API rejected the photo quality (not generic report/session errors). */
export function isPalmRetakeError(message: string): boolean {
  const d = message.toLowerCase();
  if (d.includes('palm analysis before') || d.includes('run palm analysis')) {
    return false;
  }
  return (
    d.includes('retake') ||
    d.includes('no clear palm') ||
    d.includes('creases not detected') ||
    d.includes('no_hand') ||
    d.includes('palm_unreadable') ||
    d.includes("couldn't clearly analyze") ||
    d.includes('palm image required')
  );
}

export type PalmUnreadablePayload = {
  code: string;
  message: string;
  reasons: string[];
};

/** Parse structured FastAPI detail for palm_unreadable (object or string). */
export function parsePalmUnreadable(err: unknown): PalmUnreadablePayload | null {
  const defaults: PalmUnreadablePayload = {
    code: 'palm_unreadable',
    message: "We couldn't clearly analyze your palm.",
    reasons: ['blurry image', 'low lighting', 'palm partially outside the frame'],
  };

  if (err instanceof ApiHttpError) {
    const raw = err.rawDetail?.trim() || '';
    try {
      const parsed = JSON.parse(raw) as { detail?: unknown };
      const detail = parsed.detail ?? parsed;
      if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
        const d = detail as Record<string, unknown>;
        const reasons = Array.isArray(d.reasons)
          ? d.reasons.filter((r): r is string => typeof r === 'string')
          : defaults.reasons;
        return {
          code: typeof d.code === 'string' ? d.code : defaults.code,
          message: typeof d.message === 'string' ? d.message : err.message || defaults.message,
          reasons: reasons.length ? reasons : defaults.reasons,
        };
      }
      if (typeof detail === 'string' && isPalmRetakeError(detail)) {
        return { ...defaults, message: err.message || detail };
      }
    } catch {
      if (isPalmRetakeError(err.message) || isPalmRetakeError(raw)) {
        return { ...defaults, message: err.message || defaults.message };
      }
    }
    if (err.status === 422 || isPalmRetakeError(err.message)) {
      return { ...defaults, message: err.message || defaults.message };
    }
  }

  if (err instanceof Error && isPalmRetakeError(err.message)) {
    return { ...defaults, message: err.message };
  }
  return null;
}

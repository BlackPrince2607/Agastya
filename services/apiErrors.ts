/** Map backend / client errors to user-friendly copy. */

export const ERRORS = {
  network: 'We couldn’t reach Agastya right now. Check your connection and try again.',
  guideNeedsPalm: 'Complete your palm reading first—then the Guide can personalize answers for you.',
  missingSession: 'Something went wrong starting your session. Please restart the app.',
  mergeMismatch: 'This sign-in doesn’t match your current reading. Try signing in with the account you used before.',
  authRequired: 'Please sign in to continue.',
  authInvalid: 'Sign-in failed. Please try again.',
  palmRequired: 'We need your palm reading before we can build your report.',
  generic: 'Something went wrong. Please try again.',
} as const;

export function mapApiError(detail: string): string {
  const d = detail.toLowerCase();
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
  if (d.includes('palm analysis before') || d.includes('run palm analysis')) {
    return ERRORS.palmRequired;
  }
  if (d.includes('missing_session')) {
    return ERRORS.missingSession;
  }
  if (d.includes('health ') || d.includes('fetch') || d.includes('network')) {
    return ERRORS.network;
  }
  return ERRORS.generic;
}

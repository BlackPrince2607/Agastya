/** Map Supabase Auth API errors to user-friendly copy. */

export function mapSupabaseAuthError(message: string): string {
  const m = message.toLowerCase();

  if (m.includes('network request failed') || m.includes('failed to fetch') || m.includes('network error')) {
    return 'Could not reach the sign-in service. Check your internet connection and try again.';
  }

  if (m.includes('invalid email') || m.includes('unable to validate email')) {
    return 'Enter a valid email address.';
  }

  if (
    m.includes('rate') ||
    m.includes('exceeded') ||
    m.includes('too many') ||
    m.includes('once every')
  ) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }

  if (m.includes('signup') && m.includes('disabled')) {
    return 'Email sign-up is not available right now.';
  }

  if (m.includes('redirect') || m.includes('redirect_uri') || m.includes('redirect url')) {
    return 'Sign-in link was blocked. Try signing in with your password instead.';
  }

  if (
    m.includes('provider is not enabled') ||
    m.includes('unsupported provider') ||
    m.includes('oauth provider not enabled') ||
    (m.includes('provider') && m.includes('not enabled'))
  ) {
    return 'That sign-in option isn’t available right now. Try email instead.';
  }

  if (
    m.includes('invalid api key') ||
    m.includes('invalid jwt') ||
    m.includes('no api key') ||
    m.includes('missing api key')
  ) {
    return 'App auth keys are misconfigured. Restart the app and try again.';
  }

  if (
    m.includes('invalid login credentials') ||
    m.includes('invalid credentials') ||
    m.includes('wrong password')
  ) {
    return 'Wrong email or password.';
  }

  if (
    m.includes('email address not authorized') ||
    m.includes('smtp') ||
    m.includes('sending email') ||
    m.includes('error sending confirmation email') ||
    m.includes('error sending magic link')
  ) {
    return 'We could not send email right now. Try signing in with your password, or wait a few minutes.';
  }

  if (m.includes('signups not allowed') || m.includes('signup is disabled')) {
    return 'New email sign-ups are not available right now.';
  }

  if (
    m.includes('user already registered') ||
    m.includes('already been registered') ||
    m.includes('already exists')
  ) {
    return 'An account exists with this email — sign in or reset your password.';
  }

  if (m.includes('email not confirmed') || m.includes('not confirmed')) {
    return 'Check your inbox to confirm your email first.';
  }

  if (m.includes('database error') || m.includes('saving new user')) {
    return 'Account could not be created. Please try again in a moment.';
  }

  if (m.includes('captcha')) {
    return 'Complete the security check and try again.';
  }

  if (
    m.includes('password') &&
    (m.includes('weak') || m.includes('short') || m.includes('at least') || m.includes('characters'))
  ) {
    return 'Choose a stronger password (at least 6 characters).';
  }

  if (m.includes('no sign-in token')) {
    return 'This sign-in link is invalid or has expired. Request a new one.';
  }

  if (__DEV__) {
    return message.trim() || 'Sign-in failed with an unknown error.';
  }

  return 'Something went wrong. Please try again.';
}

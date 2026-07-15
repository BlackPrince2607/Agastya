/** Marks recent successful sign-in navigation (prevents callback redirect loops). */
let authEstablishedAt = 0;
let oauthInProgress = false;

export function markAuthEstablished(): void {
  authEstablishedAt = Date.now();
}

export function isRecentAuthEstablished(): boolean {
  return Date.now() - authEstablishedAt < 10_000;
}

export function beginOAuthFlow(): void {
  oauthInProgress = true;
}

export function endOAuthFlow(): void {
  oauthInProgress = false;
}

export function isOAuthInProgress(): boolean {
  return oauthInProgress;
}

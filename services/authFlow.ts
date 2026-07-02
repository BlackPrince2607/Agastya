/** Native OAuth mutex — account screen owns WebBrowser completion (not time-based suppression). */
let accountOAuthActive = false;

export function beginAccountOAuth(): void {
  accountOAuthActive = true;
}

export function endAccountOAuth(): void {
  accountOAuthActive = false;
}

export function isAccountOAuthActive(): boolean {
  return accountOAuthActive;
}

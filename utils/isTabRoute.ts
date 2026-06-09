/** True when pathname is a main tab screen (handles group prefixes from Expo Router). */
export function isTabRoute(pathname: string, tab: 'home' | 'chat' | 'tasks' | 'profile'): boolean {
  return pathname === `/${tab}` || pathname.endsWith(`/${tab}`);
}

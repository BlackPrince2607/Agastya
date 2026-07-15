import type { Href } from 'expo-router';
import { router } from 'expo-router';

type PushHref = Parameters<typeof router.push>[0];
type ReplaceHref = Parameters<typeof router.replace>[0];

/** Run navigation on the next tick after async work (`await sync…`). */
function scheduleNavigation(run: () => void) {
  queueMicrotask(() => {
    try {
      run();
    } catch {
      setTimeout(run, 0);
    }
  });
}

export function deferRouterPush(href: PushHref) {
  scheduleNavigation(() => router.push(href));
}

export function deferRouterReplace(href: ReplaceHref) {
  scheduleNavigation(() => router.replace(href));
}

/**
 * Replace route after sign-in / onboarding completion.
 * Uses a single replace — dismissAll loops trigger POP_TO_TOP on expo-router stacks.
 */
export function resetAppNavigation(href: Href) {
  deferRouterReplace(href as ReplaceHref);
}

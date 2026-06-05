import { router } from 'expo-router';

type PushHref = Parameters<typeof router.push>[0];
type ReplaceHref = Parameters<typeof router.replace>[0];

/**
 * Run navigation on the next tick after async work (`await sync…`).
 * Avoids InteractionManager-only scheduling, which can never run if RN thinks interactions are perpetual.
 */
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

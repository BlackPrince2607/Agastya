import { syncAuthUserToStore } from '@/services/authSession';
import { useSessionStore } from '@/store/sessionStore';
import { routeAfterSignInIntent } from '@/utils/navigationFlow';

let finishSignInInFlight: Promise<void> | null = null;

type FinishSignInOptions = {
  userId?: string | null;
  recovery?: boolean;
};

/** Route once after sign-in; cloud merge + restore run before routing. */
export async function finishSignIn(options: FinishSignInOptions = {}): Promise<void> {
  if (finishSignInInFlight) {
    return finishSignInInFlight;
  }

  finishSignInInFlight = (async () => {
    if (options.userId) {
      syncAuthUserToStore(options.userId);
    }

    // A fresh sign-in is an explicit signal that the user wants their cloud data restored.
    // Clear any stale "skip cloud restore" flag left over from a prior "Start fresh" /
    // "Replay setup" so returning users get their previous palm reading and report back.
    if (useSessionStore.getState().skipCloudRestore) {
      useSessionStore.getState().setSkipCloudRestore(false);
    }

    if (options.recovery) {
      const { router } = await import('expo-router');
      router.replace('/auth/reset-password');
      return;
    }

    await routeAfterSignInIntent();
  })();

  try {
    await finishSignInInFlight;
  } finally {
    finishSignInInFlight = null;
  }
}

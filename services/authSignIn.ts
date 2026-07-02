import { syncAuthUserToStore } from '@/services/authSession';
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

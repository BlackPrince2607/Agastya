import { syncAuthUserToStore } from '@/services/authSession';
import { completeSignIn } from '@/services/authCoordinator';

export type FinishSignInOptions = {
  userId?: string | null;
  recovery?: boolean;
};

/** @deprecated Use completeSignIn from authCoordinator — kept for existing imports. */
export async function finishSignIn(options: FinishSignInOptions = {}): Promise<void> {
  if (options.userId) {
    syncAuthUserToStore(options.userId);
  }
  await completeSignIn(options);
}

import { ensureSessionMerged } from '@/services/authMerge';
import { waitForSupabaseAccessToken } from '@/services/supabase';
import { routeAfterSignInIntent } from '@/utils/navigationFlow';

/** Merge anonymous session + restore cloud data, then route after any successful sign-in. */
export async function finishSignIn(): Promise<void> {
  await waitForSupabaseAccessToken();
  await ensureSessionMerged();
  await routeAfterSignInIntent();
}

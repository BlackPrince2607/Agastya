import { fetchAuthenticatedSessionBootstrap, fetchSessionBootstrap } from '@/services/agastyaApi';
import { applyBootstrapContext } from '@/services/guidanceCache';
import { isApiConfigured } from '@/services/env';
import { track } from '@/services/analytics';
import { normalizeFullReport } from '@/services/normalizeReport';
import { getSupabaseAccessToken } from '@/services/supabase';
import type { FocusTopic, Gender } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { useChatStore } from '@/store/chatStore';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import { isEmailPremiumAllowlisted } from '@/utils/premiumAllowlist';

const FOCUS_SET = new Set<FocusTopic>(['love', 'career', 'money', 'growth', 'matching']);

function parseFocusTopics(raw: string[]): FocusTopic[] {
  const topics = raw.filter((t): t is FocusTopic => FOCUS_SET.has(t as FocusTopic));
  return topics.length ? topics : ['growth'];
}

function parseGender(raw: string | null | undefined): Gender | undefined {
  if (raw === 'female' || raw === 'male' || raw === 'non_binary' || raw === 'prefer_not') {
    return raw;
  }
  return undefined;
}

type RestoreOptions = {
  /** Fetch cloud session even when local preview/palm exists (sign-in, cold start). */
  force?: boolean;
};

type BootstrapDto = Awaited<ReturnType<typeof fetchSessionBootstrap>>;

let restoreInFlight: Promise<boolean> | null = null;
/** Skip back-to-back bootstrap GETs from identity + prepareReturningUser. */
let lastRestoreOkAt = 0;
const RESTORE_COOLDOWN_MS = 15_000;

function hasReadingData(data: BootstrapDto): boolean {
  return Boolean(data.palmAnalysis || data.previewReport || data.fullReport);
}

/** Pull palm + dossiers from API/Supabase when local ritual state is empty or `force`.
 *  Anonymous bootstrap is lightweight (profile/premium/guidance only).
 *  Full reading/chat require authenticated bootstrap (signed-in JWT).
 */
export async function restoreSessionFromServer(options?: RestoreOptions): Promise<boolean> {
  if (!isApiConfigured()) return false;
  const snap = useSessionStore.getState();
  if (!snap.sessionId && !snap.supabaseUserId) return false;
  const sessionId = snap.sessionId;

  if (snap.skipCloudRestore && options?.force !== true) {
    return false;
  }

  const needsContentRestore =
    options?.force === true ||
    !snap.palmAnalysis ||
    (!snap.previewReading && !snap.fullReading);

  // Warm path: identity bootstrap already restored seconds ago — avoid duplicate GET.
  if (
    options?.force !== true &&
    !needsContentRestore &&
    lastRestoreOkAt > 0 &&
    Date.now() - lastRestoreOkAt < RESTORE_COOLDOWN_MS
  ) {
    return true;
  }

  if (restoreInFlight) {
    return restoreInFlight;
  }

  restoreInFlight = (async () => {
    const loadBootstrap = async (): Promise<BootstrapDto> => {
      const token = await getSupabaseAccessToken();
      const canUseAuth = Boolean(token) && Boolean(snap.supabaseUserId || options?.force);

      if (canUseAuth) {
        try {
          return await fetchAuthenticatedSessionBootstrap();
        } catch {
          /* fall through to anonymous light bootstrap when possible */
        }
      }

      if (!sessionId || !snap.deviceInstallId) {
        if (canUseAuth) {
          return fetchAuthenticatedSessionBootstrap();
        }
        throw new Error('Missing sessionId or deviceInstallId for bootstrap');
      }

      return fetchSessionBootstrap(sessionId, snap.deviceInstallId);
    };

    try {
      const data = await loadBootstrap();

      const updates: {
        sessionId?: string;
        userDisplayName?: string;
        userGender?: Gender;
        focusTopics?: FocusTopic[];
        supabaseUserId?: string;
        palmAnalysis?: PalmAnalysisDto;
        previewReading?: ReturnType<typeof normalizeFullReport>;
        fullReading?: ReturnType<typeof normalizeFullReport>;
        hasUnlockedPremium?: boolean;
      } = {};

      // Profile / premium always safe from either bootstrap shape.
      if (data.sessionId && data.sessionId !== snap.sessionId) updates.sessionId = data.sessionId;
      if (data.displayName) updates.userDisplayName = data.displayName;
      const gender = parseGender(data.gender);
      if (gender) updates.userGender = gender;
      if (data.focusTopics?.length) updates.focusTopics = parseFocusTopics(data.focusTopics);
      if (data.supabaseUserId) updates.supabaseUserId = data.supabaseUserId;
      // Server is the authority for paid entitlement, but allowlisted founder emails stay premium.
      if (data.isPremium === true) {
        updates.hasUnlockedPremium = true;
      } else if (options?.force === true && data.isPremium === false) {
        if (!isEmailPremiumAllowlisted()) {
          updates.hasUnlockedPremium = false;
        }
      }

      if (needsContentRestore) {
        // Only apply reading fields when present — light anonymous bootstrap must not wipe local.
        if (data.palmAnalysis && (options?.force || !snap.palmAnalysis)) {
          updates.palmAnalysis = data.palmAnalysis;
        }
        if (data.previewReport && (options?.force || !snap.previewReading)) {
          updates.previewReading = normalizeFullReport(data.previewReport);
        }
        if (data.fullReport && (options?.force || !snap.fullReading)) {
          updates.fullReading = normalizeFullReport(data.fullReport);
        }

        if (data.chatTail?.length) {
          useChatStore.getState().hydrateFromServer(data.chatTail);
        }
      }

      if (Object.keys(updates).length > 0) {
        useSessionStore.setState(updates);
        if (hasReadingData(data)) {
          track('session_restore_ok', {
            palm: Boolean(data.palmAnalysis),
            preview: Boolean(data.previewReport),
            full: Boolean(data.fullReport),
          });
        }
      }

      if (data.dailyContext || data.weeklyContext) {
        await applyBootstrapContext({
          dailyContext: data.dailyContext,
          weeklyContext: data.weeklyContext,
        });
      }

      const applied =
        Object.keys(updates).length > 0 ||
        (needsContentRestore && Boolean(data.chatTail?.length)) ||
        Boolean(data.dailyContext) ||
        Boolean(data.weeklyContext);

      if (applied || hasReadingData(data) || data.isPremium === true) {
        lastRestoreOkAt = Date.now();
      }

      return applied || hasReadingData(data) || data.isPremium === true;
    } catch {
      track('session_restore_fail');
      if (useSessionStore.getState().supabaseUserId) {
        useSessionStore
          .getState()
          .setSyncNotice('We could not restore your saved reading. Check your connection and try again.');
      }
      if (__DEV__) {
        console.warn('[Agastya] session restore failed');
      }
      return false;
    }
  })();

  try {
    return await restoreInFlight;
  } finally {
    restoreInFlight = null;
  }
}

import { fetchAuthenticatedSessionBootstrap, fetchSessionBootstrap } from '@/services/agastyaApi';
import { isApiConfigured } from '@/services/env';
import { track } from '@/services/analytics';
import { normalizeFullReport } from '@/services/normalizeReport';
import type { FocusTopic, Gender } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { useChatStore } from '@/store/chatStore';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';

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

let restoreInFlight: Promise<boolean> | null = null;

function hasReadingData(data: Awaited<ReturnType<typeof fetchSessionBootstrap>>): boolean {
  return Boolean(data.palmAnalysis || data.previewReport || data.fullReport);
}

/** Pull palm + dossiers from API/Supabase when local ritual state is empty or `force`. */
export async function restoreSessionFromServer(options?: RestoreOptions): Promise<boolean> {
  if (!isApiConfigured()) return false;
  const snap = useSessionStore.getState();
  if (!snap.sessionId && !snap.supabaseUserId) return false;
  const sessionId = snap.sessionId;

  if (snap.skipCloudRestore && options?.force !== true) {
    return false;
  }

  const needsRestore =
    options?.force === true ||
    !snap.palmAnalysis ||
    (!snap.previewReading && !snap.fullReading);
  if (!needsRestore) return false;

  if (restoreInFlight) {
    return restoreInFlight;
  }

  restoreInFlight = (async () => {
    const loadBootstrap = async (deviceInstallId?: string | null) => {
      if (!sessionId) {
        return fetchAuthenticatedSessionBootstrap();
      }

      const current = await fetchSessionBootstrap(sessionId, deviceInstallId);
      if (options?.force === true && snap.supabaseUserId && !hasReadingData(current)) {
        try {
          const restored = await fetchAuthenticatedSessionBootstrap();
          if (hasReadingData(restored)) {
            return restored;
          }
        } catch {
          /* fall back to the current anonymous session */
        }
      }
      return current;
    };

    try {
      let data: Awaited<ReturnType<typeof fetchSessionBootstrap>>;
      try {
        data = await loadBootstrap(snap.deviceInstallId);
      } catch {
        data = await loadBootstrap(null);
      }
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

    if (data.sessionId && data.sessionId !== snap.sessionId) updates.sessionId = data.sessionId;
    if (data.displayName) updates.userDisplayName = data.displayName;
    const gender = parseGender(data.gender);
    if (gender) updates.userGender = gender;
    if (data.focusTopics?.length) updates.focusTopics = parseFocusTopics(data.focusTopics);
    if (data.supabaseUserId) updates.supabaseUserId = data.supabaseUserId;

    if (data.palmAnalysis && (options?.force || !snap.palmAnalysis)) {
      updates.palmAnalysis = data.palmAnalysis;
    }
    if (data.previewReport && (options?.force || !snap.previewReading)) {
      updates.previewReading = normalizeFullReport(data.previewReport);
    }
    if (data.fullReport && (options?.force || !snap.fullReading)) {
      updates.fullReading = normalizeFullReport(data.fullReport);
    }
    if (data.isPremium === true) {
      updates.hasUnlockedPremium = true;
    } else if (data.fullReport && (options?.force || !snap.fullReading)) {
      updates.hasUnlockedPremium = true;
    }

    if (Object.keys(updates).length > 0) {
      useSessionStore.setState(updates);
      track('session_restore_ok', {
        palm: Boolean(data.palmAnalysis),
        preview: Boolean(data.previewReport),
        full: Boolean(data.fullReport),
      });
    }

    if (data.chatTail?.length) {
      useChatStore.getState().hydrateFromServer(data.chatTail);
    }

    if (Object.keys(updates).length > 0 || data.chatTail?.length) {
      return true;
    }
    return false;
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

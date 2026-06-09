import { fetchSessionBootstrap } from '@/services/agastyaApi';
import { track } from '@/services/analytics';
import { normalizeFullReport } from '@/services/normalizeReport';
import { SYNC_NOTICE_FAILED } from '@/constants/userCopy';
import type { FocusTopic, Gender } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
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

/** Pull palm + dossiers from API/Supabase when local ritual state is empty or `force`. */
export async function restoreSessionFromServer(options?: RestoreOptions): Promise<boolean> {
  const snap = useSessionStore.getState();
  if (!snap.sessionId) return false;

  const needsRestore =
    options?.force === true ||
    !snap.palmAnalysis ||
    (!snap.previewReading && !snap.fullReading);
  if (!needsRestore) return false;

  try {
    const data = await fetchSessionBootstrap(snap.sessionId);
    const updates: {
      userDisplayName?: string;
      userGender?: Gender;
      focusTopics?: FocusTopic[];
      supabaseUserId?: string;
      palmAnalysis?: PalmAnalysisDto;
      previewReading?: ReturnType<typeof normalizeFullReport>;
      fullReading?: ReturnType<typeof normalizeFullReport>;
      hasUnlockedPremium?: boolean;
    } = {};

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
      updates.hasUnlockedPremium = true;
    }

    if (Object.keys(updates).length > 0) {
      useSessionStore.setState(updates);
      track('session_restore_ok', {
        palm: Boolean(data.palmAnalysis),
        preview: Boolean(data.previewReport),
        full: Boolean(data.fullReport),
      });
      return true;
    }
    return false;
  } catch {
    track('session_restore_fail');
    if (options?.force === true) {
      useSessionStore.getState().setSyncNotice(SYNC_NOTICE_FAILED);
    }
    return false;
  }
}

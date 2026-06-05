import type { FocusTopic } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';

import { ERRORS, mapApiError } from '@/services/apiErrors';
import { apiUrl } from '@/services/env';
import { getSupabaseAccessToken } from '@/services/supabase';
import { GUIDE_FINISH_PALM_FIRST } from '@/constants/userCopy';

export type ApiHealthDto = {
  status: string;
  service?: string;
  supabase?: boolean;
  groq?: boolean;
  palm_groq?: boolean;
};

/** Lightweight connectivity check — safe to call on bootstrap. */
export async function fetchApiHealth(signal?: AbortSignal): Promise<ApiHealthDto> {
  const res = await fetch(apiUrl('/v1/health'), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) {
    throw new Error(`health ${res.status}`);
  }
  return res.json() as Promise<ApiHealthDto>;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(mapApiError(detail));
  }
  return res.json() as Promise<T>;
}

export type SessionBootstrapDto = {
  sessionId: string;
  deviceInstallId?: string | null;
  displayName?: string | null;
  gender?: string | null;
  focusTopics: string[];
  supabaseUserId?: string | null;
  palmStoragePath?: string | null;
  palmAnalysis?: PalmAnalysisDto | null;
  previewReport?: Record<string, unknown> | null;
  fullReport?: Record<string, unknown> | null;
};

export async function fetchSessionBootstrap(sessionId: string) {
  return getJson<SessionBootstrapDto>(
    `/v1/sessions/bootstrap?sessionId=${encodeURIComponent(sessionId)}`,
  );
}

async function postJson<T>(
  path: string,
  body: unknown,
  auth = false,
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (auth) {
    const token = await getSupabaseAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(mapApiError(detail));
  }
  return res.json() as Promise<T>;
}

export async function registerSession(
  body: {
    sessionId: string;
    deviceInstallId: string;
    displayName?: string;
    gender?: string;
    focusTopics?: FocusTopic[];
  },
  opts?: { signal?: AbortSignal },
) {
  return postJson<{ ok: boolean }>(
    '/v1/sessions/register',
    {
      sessionId: body.sessionId,
      deviceInstallId: body.deviceInstallId,
      displayName: body.displayName,
      gender: body.gender,
      focusTopics: body.focusTopics,
    },
    false,
    opts?.signal,
  );
}

export async function mergeSessions(body: { anonymousSessionId: string; supabaseUserId: string }) {
  return postJson<{ ok: boolean; linked: boolean }>(
    '/v1/sessions/merge',
    {
      anonymousSessionId: body.anonymousSessionId,
      supabaseUserId: body.supabaseUserId,
    },
    true,
  );
}

export async function analyzePalm(body: {
  sessionId: string;
  seed: string;
  imageBase64?: string | null;
}) {
  return postJson<PalmAnalysisDto>('/v1/palm/analyze', body);
}

export async function generateReport(body: {
  sessionId: string;
  seed: string;
  palmAnalysis?: PalmAnalysisDto | null;
  focusTopics: FocusTopic[];
  mode: 'preview' | 'full';
  displayName?: string;
  gender?: string;
}) {
  return postJson<Record<string, unknown>>('/v1/reports/generate', body);
}

export async function chatWithGuide(body: {
  sessionId: string;
  messages: Array<{ role: string; content: string }>;
  palmAnalysis: PalmAnalysisDto;
  profileSummary: string;
  isPremium: boolean;
}) {
  return postJson<{ reply: string }>('/v1/chat', body);
}

export async function fetchDailyTasks(body: {
  sessionId: string;
  palmAnalysis: PalmAnalysisDto;
  isPremium: boolean;
}) {
  return postJson<{ tasks: string[]; variant: string }>('/v1/tasks/daily', body);
}

export type GuideReplyResult =
  | { ok: true; text: string }
  | { ok: false; error: string; needsPalm?: boolean };

export async function requestGuideReply(
  messages: Array<{ role: string; content: string }>,
): Promise<GuideReplyResult> {
  const {
    sessionId,
    palmAnalysis,
    hasUnlockedPremium,
    userDisplayName,
    userGender,
    focusTopics,
  } = useSessionStore.getState();

  if (!sessionId || !palmAnalysis) {
    return { ok: false, error: GUIDE_FINISH_PALM_FIRST, needsPalm: true };
  }

  const profileSummary = [
    userDisplayName ? `Name: ${userDisplayName}` : '',
    userGender ? `Gender: ${userGender}` : '',
    focusTopics.length ? `Focus areas: ${focusTopics.join(', ')}` : '',
    `Personality: ${palmAnalysis.personality}`,
    `Traits: ${palmAnalysis.traits.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const { reply } = await chatWithGuide({
      sessionId,
      messages,
      palmAnalysis,
      profileSummary,
      isPremium: hasUnlockedPremium,
    });
    return { ok: true, text: reply };
  } catch (e) {
    const msg = e instanceof Error ? e.message : ERRORS.network;
    return { ok: false, error: mapApiError(msg) };
  }
}

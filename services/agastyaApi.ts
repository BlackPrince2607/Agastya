import type { FocusTopic } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import type { HandLandmark } from '@/utils/palmLandmarks';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import type { PredictionPeriod, PredictionsResponse } from '@/types/predictions';

import { ERRORS, mapApiError } from '@/services/apiErrors';
import { apiUrl, isApiConfigured } from '@/services/env';
import { getSupabaseAccessToken } from '@/services/supabase';
import { GUIDE_FINISH_PALM_FIRST } from '@/constants/userCopy';

const DEFAULT_FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, signal: externalSignal, ...rest } = init;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort);

  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

export type ApiHealthDto = {
  status: string;
  service?: string;
  supabase?: boolean;
  groq?: boolean;
  palm_groq?: boolean;
};

export async function fetchApiHealth(signal?: AbortSignal): Promise<ApiHealthDto> {
  const res = await fetchWithTimeout(apiUrl('/v1/health'), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
    timeoutMs: 6000,
  });
  if (!res.ok) {
    throw new Error(`health ${res.status}`);
  }
  return res.json() as Promise<ApiHealthDto>;
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetchWithTimeout(apiUrl(path), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
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
  isPremium?: boolean;
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
  const res = await fetchWithTimeout(apiUrl(path), {
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

async function patchJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetchWithTimeout(apiUrl(path), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
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

export async function patchSessionProfile(body: {
  sessionId: string;
  deviceInstallId: string;
  displayName?: string;
  gender?: string;
  focusTopics?: FocusTopic[];
}) {
  return patchJson<{
    sessionId: string;
    displayName?: string | null;
    gender?: string | null;
    focusTopics: string[];
  }>('/v1/sessions/profile', body);
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

export async function createStripeCheckoutSession(body: {
  sessionId: string;
  deviceInstallId: string;
  billingPeriod: 'monthly' | 'annual';
  successUrl: string;
  cancelUrl: string;
}) {
  return postJson<{ checkoutUrl: string }>('/v1/billing/checkout', {
    sessionId: body.sessionId,
    deviceInstallId: body.deviceInstallId,
    billingPeriod: body.billingPeriod,
    successUrl: body.successUrl,
    cancelUrl: body.cancelUrl,
  });
}

export async function analyzePalm(body: {
  sessionId: string;
  deviceInstallId: string;
  seed: string;
  imageBase64?: string | null;
  dominantHand?: 'left' | 'right' | null;
  landmarks?: HandLandmark[] | null;
}) {
  return postJson<PalmAnalysisDto>('/v1/palm/analyze', {
    sessionId: body.sessionId,
    deviceInstallId: body.deviceInstallId,
    seed: body.seed,
    imageBase64: body.imageBase64,
    dominantHand: body.dominantHand ?? 'unknown',
    landmarks: body.landmarks ?? undefined,
  });
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
}) {
  return postJson<{ reply: string; suggestions?: string[] }>('/v1/chat', body);
}

export async function fetchDailyTasks(body: {
  sessionId: string;
  palmAnalysis: PalmAnalysisDto;
}) {
  return postJson<{ tasks: unknown[]; variant: string }>('/v1/tasks/daily', body);
}

export async function fetchPredictions(body: {
  sessionId: string;
  period: PredictionPeriod;
  seed?: string;
  palmAnalysis?: PalmAnalysisDto | null;
  focusTopics?: FocusTopic[];
}) {
  return postJson<PredictionsResponse>('/v1/predictions/generate', body);
}

export type GuideReplyResult =
  | { ok: true; text: string; suggestions: string[] }
  | { ok: false; error: string; needsPalm?: boolean; offline?: boolean };

export async function requestGuideReply(
  messages: Array<{ role: string; content: string }>,
): Promise<GuideReplyResult> {
  const {
    sessionId,
    deviceInstallId,
    palmAnalysis,
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
    const { reply, suggestions } = await chatWithGuide({
      sessionId,
      messages,
      palmAnalysis,
      profileSummary,
    });
    return { ok: true, text: reply, suggestions: suggestions ?? [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : ERRORS.network;
    return {
      ok: false,
      error: mapApiError(msg),
      offline: !isApiConfigured(),
    };
  }
}

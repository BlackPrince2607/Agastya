import type { FocusTopic } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import type { HandLandmark } from '@/utils/palmLandmarks';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import type { PredictionPeriod, PredictionsResponse } from '@/types/predictions';

import { ERRORS, mapApiError } from '@/services/apiErrors';
import { withApiRetry } from '@/utils/apiRetry';
import { AGASTYA_API_ROOT, apiUrl, getApiHostLabel, isApiConfigured, isMisconfiguredProductionApi } from '@/services/env';
import { getSupabaseAccessToken } from '@/services/supabase';
import { GUIDE_FINISH_PALM_FIRST } from '@/constants/userCopy';
import { captureException } from '@/services/sentry';

const DEFAULT_FETCH_TIMEOUT_MS = 8000;

function wrapFetchError(path: string, err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (lower.includes('aborted') || lower.includes('timeout')) {
    return new Error(`timeout ${path}`);
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return new Error(`Network request failed (${getApiHostLabel()}${path})`);
  }
  return err instanceof Error ? err : new Error(raw);
}

function apiRequestHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...extra,
  };
  if (AGASTYA_API_ROOT.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }
  return headers;
}

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
  llm?: boolean;
  palm_vision?: boolean;
  chat_model?: string | null;
  vision_model?: string | null;
};

export async function fetchApiHealth(signal?: AbortSignal): Promise<ApiHealthDto> {
  const res = await fetchWithTimeout(apiUrl('/v1/health'), {
    method: 'GET',
    headers: apiRequestHeaders(),
    signal,
    timeoutMs: 15000,
  });
  if (!res.ok) {
    throw new Error(`health ${res.status}`);
  }
  return res.json() as Promise<ApiHealthDto>;
}

/** Retry health on cold start / flaky mobile radios (browser may succeed while first fetch fails). */
export async function fetchApiHealthWithRetry(
  attempts = 4,
  pauseMs = 2000,
): Promise<ApiHealthDto> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, pauseMs));
      }
      const health = await fetchApiHealth();
      return health;
    } catch (err) {
      lastError = err;
      if (__DEV__) {
        console.warn(`[Agastya API] health attempt ${i + 1}/${attempts} failed`, err);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('health check failed');
}

async function getJson<T>(path: string, signal?: AbortSignal, auth = false): Promise<T> {
  const headers = apiRequestHeaders();
  if (auth) {
    const token = await getSupabaseAccessToken();
    if (!token) throw new Error(ERRORS.authRequired);
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetchWithTimeout(apiUrl(path), {
    method: 'GET',
    headers,
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
  chatTail?: Array<{ role: string; content: string }>;
};

export async function fetchSessionBootstrap(sessionId: string, deviceInstallId?: string | null) {
  const deviceQuery = deviceInstallId
    ? `&deviceInstallId=${encodeURIComponent(deviceInstallId)}`
    : '';
  return getJson<SessionBootstrapDto>(
    `/v1/sessions/bootstrap?sessionId=${encodeURIComponent(sessionId)}${deviceQuery}`,
  );
}

export async function fetchAuthenticatedSessionBootstrap(signal?: AbortSignal) {
  return getJson<SessionBootstrapDto>('/v1/sessions/bootstrap/authenticated', signal, true);
}

async function postJson<T>(
  path: string,
  body: unknown,
  auth = false,
  opts?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<T> {
  const { ensureDeviceIdentity } = await import('@/services/identity');
  await ensureDeviceIdentity();

  const headers = apiRequestHeaders({
    'Content-Type': 'application/json',
  });
  if (auth) {
    const token = await getSupabaseAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetchWithTimeout(apiUrl(path), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: opts?.signal,
    timeoutMs: opts?.timeoutMs,
  }).catch((err) => {
    throw wrapFetchError(path, err);
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
    headers: apiRequestHeaders({
      'Content-Type': 'application/json',
    }),
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
    { signal: opts?.signal },
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

export async function mergeSessions(body: {
  anonymousSessionId: string;
  supabaseUserId: string;
  deviceInstallId?: string;
}) {
  return postJson<{ ok: boolean; linked: boolean }>(
    '/v1/sessions/merge',
    {
      anonymousSessionId: body.anonymousSessionId,
      supabaseUserId: body.supabaseUserId,
      deviceInstallId: body.deviceInstallId,
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
  gender?: string | null;
  landmarks?: HandLandmark[] | null;
  landmarksSource?: 'mediapipe' | 'roi_estimate' | null;
}) {
  return postJson<PalmAnalysisDto>('/v1/palm/analyze', {
    sessionId: body.sessionId,
    deviceInstallId: body.deviceInstallId,
    seed: body.seed,
    imageBase64: body.imageBase64,
    dominantHand: body.dominantHand ?? 'unknown',
    gender: body.gender ?? undefined,
    landmarks: body.landmarks ?? undefined,
    landmarksSource: body.landmarksSource ?? undefined,
  });
}

export type PalmLandmarksDto = {
  landmarks: HandLandmark[] | null;
  source: 'mediapipe' | 'not_found' | 'unavailable' | 'roi_estimate';
};

export async function detectPalmLandmarks(body: {
  imageBase64: string;
  dominantHand?: 'left' | 'right';
}): Promise<PalmLandmarksDto> {
  return postJson<PalmLandmarksDto>(
    '/v1/palm/landmarks',
    {
      imageBase64: body.imageBase64,
      dominantHand: body.dominantHand ?? 'right',
    },
    false,
    { timeoutMs: 30_000 },
  );
}

export async function deleteAccountFromServer() {
  return postJson<{ ok: boolean; deletedSessions: number }>('/v1/auth/delete-account', {}, true);
}

export async function generateReport(body: {
  sessionId: string;
  deviceInstallId?: string;
  seed: string;
  palmAnalysis?: PalmAnalysisDto | null;
  focusTopics: FocusTopic[];
  mode: 'preview' | 'full';
  displayName?: string;
  gender?: string;
}) {
  const deviceInstallId = body.deviceInstallId ?? useSessionStore.getState().deviceInstallId;
  if (!deviceInstallId) {
    throw new Error('Device identity is not ready yet. Please try again.');
  }
  return postJson<Record<string, unknown>>('/v1/reports/generate', {
    ...body,
    deviceInstallId,
  });
}

export async function chatWithGuide(body: {
  sessionId: string;
  deviceInstallId?: string;
  messages: Array<{ role: string; content: string }>;
  palmAnalysis: PalmAnalysisDto;
  profileSummary: string;
}) {
  const deviceInstallId = body.deviceInstallId ?? useSessionStore.getState().deviceInstallId;
  if (!deviceInstallId) {
    throw new Error('Device identity is not ready yet. Please try again.');
  }
  return postJson<{ reply: string; suggestions?: string[] }>(
    '/v1/chat',
    {
      ...body,
      deviceInstallId,
    },
    false,
    { timeoutMs: 60_000 },
  );
}

export async function fetchDailyTasks(body: {
  sessionId: string;
  deviceInstallId?: string;
  palmAnalysis: PalmAnalysisDto;
}) {
  const deviceInstallId = body.deviceInstallId ?? useSessionStore.getState().deviceInstallId;
  if (!deviceInstallId) {
    throw new Error('Device identity is not ready yet. Please try again.');
  }
  return postJson<{ tasks: unknown[]; variant: string }>('/v1/tasks/daily', {
    ...body,
    deviceInstallId,
  });
}

export async function fetchPredictions(body: {
  sessionId: string;
  deviceInstallId?: string;
  period: PredictionPeriod;
  seed?: string;
  palmAnalysis?: PalmAnalysisDto | null;
  focusTopics?: FocusTopic[];
}) {
  const deviceInstallId = body.deviceInstallId ?? useSessionStore.getState().deviceInstallId;
  if (!deviceInstallId) {
    throw new Error('Device identity is not ready yet. Please try again.');
  }
  return postJson<PredictionsResponse>('/v1/predictions/generate', {
    ...body,
    deviceInstallId,
  });
}

export type GuideReplyResult =
  | { ok: true; text: string; suggestions: string[] }
  | { ok: false; error: string; needsPalm?: boolean; offline?: boolean };

export async function requestGuideReply(
  messages: Array<{ role: string; content: string }>,
): Promise<GuideReplyResult> {
  const { ensureDeviceIdentity, syncProfileRemote } = await import('@/services/identity');
  const { sessionId, deviceInstallId } = await ensureDeviceIdentity();

  const { palmAnalysis, userDisplayName, userGender, focusTopics } = useSessionStore.getState();

  if (!palmAnalysis) {
    return { ok: false, error: GUIDE_FINISH_PALM_FIRST, needsPalm: true };
  }

  if (!isApiConfigured() || isMisconfiguredProductionApi()) {
    return {
      ok: false,
      error:
        'This app build is missing the server URL. Ask your team for a fresh APK built with the production API.',
      offline: true,
    };
  }

  await syncProfileRemote();

  try {
    await fetchApiHealth();
  } catch (probeErr) {
    captureException(probeErr, { apiRoot: AGASTYA_API_ROOT, phase: 'chat_health_probe' });
    return {
      ok: false,
      error: `${ERRORS.network} (server: ${getApiHostLabel()})`,
      offline: true,
    };
  }

  const profileSummary = [
    userDisplayName ? `Name: ${userDisplayName}` : '',
    userGender ? `Gender: ${userGender}` : '',
    focusTopics.length ? `Focus areas: ${focusTopics.join(', ')}` : '',
    `Personality: ${palmAnalysis.personality}`,
    `Traits: ${palmAnalysis.traits.join(', ')}`,
    `Life line: ${palmAnalysis.life_line}`,
    `Heart line: ${palmAnalysis.heart_line}`,
    `Head line: ${palmAnalysis.head_line}`,
    palmAnalysis.fate_line ? `Fate line: ${palmAnalysis.fate_line}` : '',
    palmAnalysis.line_details
      ? `Line details: ${JSON.stringify(palmAnalysis.line_details)}`
      : '',
    palmAnalysis.mounts ? `Mounts: ${JSON.stringify(palmAnalysis.mounts)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const { reply, suggestions } = await withApiRetry(() =>
      chatWithGuide({
        sessionId,
        deviceInstallId,
        messages,
        palmAnalysis,
        profileSummary,
      }),
    );
    if (__DEV__) {
      const frontendPlaceholder = reply.includes('You often think things through before you speak');
      console.log(
        `[Agastya Guide] API reply (${frontendPlaceholder ? 'unexpected placeholder' : 'backend'})`,
        reply.slice(0, 80),
      );
    }
    return { ok: true, text: reply, suggestions: suggestions ?? [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : ERRORS.network;
    const friendly = mapApiError(msg);
    captureException(e, { apiRoot: AGASTYA_API_ROOT, phase: 'chat_reply', friendly });
    if (__DEV__) {
      console.warn('[Agastya Guide] API error:', friendly, e);
    }
    const hostHint =
      friendly === ERRORS.network || friendly.includes('too long')
        ? ` (server: ${getApiHostLabel()})`
        : '';
    return {
      ok: false,
      error: `${friendly}${hostHint}`,
      offline: friendly === ERRORS.network || friendly.includes('too long'),
    };
  }
}

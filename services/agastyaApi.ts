import type { FocusTopic } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { useTaskStore } from '@/store/taskStore';
import type { HandLandmark } from '@/utils/palmLandmarks';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import type { PredictionPeriod, PredictionsResponse } from '@/types/predictions';

import { ERRORS, ApiHttpError, mapApiError } from '@/services/apiErrors';
import { AnalyticsEvent, trackOncePerDay } from '@/services/analytics';
import { withApiRetry } from '@/utils/apiRetry';
import { AGASTYA_API_ROOT, apiUrl, getApiHostLabel, isApiConfigured, isMisconfiguredProductionApi } from '@/services/env';
import { getSupabaseAccessToken } from '@/services/supabase';
import { GUIDE_FINISH_PALM_FIRST } from '@/constants/userCopy';
import { captureException } from '@/services/sentry';

const DEFAULT_FETCH_TIMEOUT_MS = 8000;
/** Skip chat health probe for 60s after a successful probe/chat. */
let _chatHealthOkAt = 0;

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
    'X-Request-Id': extra['X-Request-Id'] ?? createRequestId(),
    ...extra,
  };
  if (AGASTYA_API_ROOT.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }
  return headers;
}

function createRequestId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readResponseRequestId(res: Response): string | undefined {
  return res.headers.get('X-Request-Id') ?? res.headers.get('x-request-id') ?? undefined;
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
    const requestId = readResponseRequestId(res);
    if (__DEV__) {
      console.warn(`[Agastya API] ${path} → ${res.status}`, detail.slice(0, 400), requestId);
    }
    throw new ApiHttpError(mapApiError(detail), res.status, detail, requestId);
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
  dailyContext?: {
    date?: string;
    title?: string;
    body?: string;
    focusTheme?: string | null;
  } | null;
  weeklyContext?: {
    weekKey?: string;
    title?: string;
    body?: string;
    topTheme?: string | null;
    consistencyNote?: string | null;
  } | null;
};

export async function fetchSessionBootstrap(sessionId: string, deviceInstallId: string) {
  const deviceQuery = `&deviceInstallId=${encodeURIComponent(deviceInstallId)}`;
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
    const requestId = readResponseRequestId(res);
    if (__DEV__) {
      console.warn(`[Agastya API] ${path} → ${res.status}`, detail.slice(0, 400), requestId);
    }
    throw new ApiHttpError(mapApiError(detail), res.status, detail, requestId);
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
    const requestId = readResponseRequestId(res);
    if (__DEV__) {
      console.warn(`[Agastya API] ${path} → ${res.status}`, detail.slice(0, 400), requestId);
    }
    throw new ApiHttpError(mapApiError(detail), res.status, detail, requestId);
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
  deviceInstallId: string;
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

export async function createRazorpayPaymentLink(body: {
  sessionId: string;
  deviceInstallId: string;
  billingPeriod: 'monthly' | 'annual' | 'lifetime';
  successUrl: string;
  cancelUrl: string;
  externalTransactionToken?: string;
  administrativeArea?: string;
  platform?: 'android';
}) {
  return postJson<{ checkoutUrl: string; checkoutIntentId: string }>(
    '/v1/billing/razorpay/create-payment-link',
    {
      sessionId: body.sessionId,
      deviceInstallId: body.deviceInstallId,
      billingPeriod: body.billingPeriod,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
      externalTransactionToken: body.externalTransactionToken,
      administrativeArea: body.administrativeArea,
      platform: body.platform ?? 'android',
    },
  );
}

export async function confirmRazorpayPayment(body: {
  sessionId: string;
  deviceInstallId: string;
  checkoutIntentId?: string;
  paymentLinkId?: string;
  paymentId?: string;
  paymentLinkReferenceId?: string;
  paymentLinkStatus?: string;
  razorpaySignature?: string;
}) {
  return postJson<{ isPremium: boolean; status: string; source?: 'razorpay' }>(
    '/v1/billing/razorpay/confirm-payment',
    {
      sessionId: body.sessionId,
      deviceInstallId: body.deviceInstallId,
      checkoutIntentId: body.checkoutIntentId,
      paymentLinkId: body.paymentLinkId,
      paymentId: body.paymentId,
      paymentLinkReferenceId: body.paymentLinkReferenceId,
      paymentLinkStatus: body.paymentLinkStatus,
      razorpaySignature: body.razorpaySignature,
    },
  );
}

export async function verifyGooglePlayPurchase(body: {
  sessionId: string;
  deviceInstallId: string;
  purchaseToken: string;
  productId: string;
}) {
  return postJson<{ isPremium: boolean; source: 'google_play' }>(
    '/v1/billing/google-play/verify-purchase',
    {
      sessionId: body.sessionId,
      deviceInstallId: body.deviceInstallId,
      purchaseToken: body.purchaseToken,
      productId: body.productId,
    },
  );
}

export async function fetchBillingConfig(platform: 'android' | 'ios' | 'web' = 'android') {
  return getJson<import('@/services/billing/billingService').BillingConfig>(
    `/v1/billing/config?platform=${encodeURIComponent(platform)}`,
  );
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
  // Vision + crease path often exceeds the default 8s client timeout.
  return postJson<PalmAnalysisDto>(
    '/v1/palm/analyze',
    {
      sessionId: body.sessionId,
      deviceInstallId: body.deviceInstallId,
      seed: body.seed,
      imageBase64: body.imageBase64,
      dominantHand: body.dominantHand ?? 'unknown',
      gender: body.gender ?? undefined,
      landmarks: body.landmarks ?? undefined,
      landmarksSource: body.landmarksSource ?? undefined,
    },
    false,
    // Single server vision attempt (~90s) + buffer; server no longer double-retries timeouts.
    { timeoutMs: 100_000 },
  );
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
  return postJson<Record<string, unknown>>(
    '/v1/reports/generate',
    {
      ...body,
      deviceInstallId,
    },
    false,
    // Single server chat-model attempt (~60s) + buffer.
    { timeoutMs: 70_000 },
  );
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
  return postJson<{ reply: string; suggestions?: string[]; memoryChanged?: boolean }>(
    '/v1/chat',
    {
      ...body,
      deviceInstallId,
    },
    false,
    // Memory extract is deferred server-side; budget matches one chat completion.
    { timeoutMs: 70_000 },
  );
}

export async function fetchDailyGuidance(body: {
  sessionId: string;
  deviceInstallId?: string;
  palmAnalysis: PalmAnalysisDto;
  focusTopics?: string[];
  streak?: number;
}) {
  const deviceInstallId = body.deviceInstallId ?? useSessionStore.getState().deviceInstallId;
  if (!deviceInstallId) {
    throw new Error('Device identity is not ready yet. Please try again.');
  }
  // LLM-backed; default 8s abort is too short vs OpenRouter (up to ~60s server-side).
  return postJson<{
    title: string;
    body: string;
    focusTheme?: string | null;
    cached?: boolean;
    date?: string | null;
    continueHint?: string | null;
    consistencyNote?: string | null;
    source?: 'llm' | 'fallback';
  }>(
    '/v1/insights/daily',
    {
      sessionId: body.sessionId,
      deviceInstallId,
      palmAnalysis: body.palmAnalysis,
      focusTopics: body.focusTopics ?? [],
      streak: body.streak,
    },
    false,
    { timeoutMs: 45_000 },
  );
}

export async function submitDailyReflection(body: {
  sessionId: string;
  deviceInstallId?: string;
  note?: string;
}) {
  const deviceInstallId = body.deviceInstallId ?? useSessionStore.getState().deviceInstallId;
  if (!deviceInstallId) {
    throw new Error('Device identity is not ready yet. Please try again.');
  }
  const result = await postJson<{ ok: boolean; persisted?: boolean }>('/v1/insights/reflect', {
    sessionId: body.sessionId,
    deviceInstallId,
    note: body.note,
  });
  trackOncePerDay(AnalyticsEvent.REFLECTION_SUBMITTED, {
    persisted: Boolean(result.persisted),
  });
  return result;
}

export async function fetchWeeklySummary(body: {
  sessionId: string;
  deviceInstallId?: string;
  palmAnalysis: PalmAnalysisDto;
  focusTopics?: string[];
  streak?: number;
  ritualsCompletedTotal?: number;
}) {
  const deviceInstallId = body.deviceInstallId ?? useSessionStore.getState().deviceInstallId;
  if (!deviceInstallId) {
    throw new Error('Device identity is not ready yet. Please try again.');
  }
  return postJson<{
    title: string;
    body: string;
    weekKey: string;
    cached?: boolean;
    topTheme?: string | null;
    consistencyNote?: string | null;
    currentChapter?: string | null;
    source?: 'llm' | 'fallback';
  }>(
    '/v1/insights/weekly',
    {
      sessionId: body.sessionId,
      deviceInstallId,
      palmAnalysis: body.palmAnalysis,
      focusTopics: body.focusTopics ?? [],
      streak: body.streak,
      ritualsCompletedTotal: body.ritualsCompletedTotal,
    },
    false,
    { timeoutMs: 45_000 },
  );
}

export async function fetchJourneyTimeline(body: {
  sessionId: string;
  deviceInstallId?: string;
  streak?: number;
  ritualsCompletedTotal?: number;
}) {
  const deviceInstallId = body.deviceInstallId ?? useSessionStore.getState().deviceInstallId;
  if (!deviceInstallId) {
    throw new Error('Device identity is not ready yet. Please try again.');
  }
  return postJson<{
    items: Array<{ id: string; label: string; detail: string; at?: string | null }>;
  }>('/v1/insights/journey', {
    sessionId: body.sessionId,
    deviceInstallId,
    streak: body.streak,
    ritualsCompletedTotal: body.ritualsCompletedTotal,
  });
}

export async function fetchDailyTasks(body: {
  sessionId: string;
  deviceInstallId?: string;
  palmAnalysis: PalmAnalysisDto;
  focusTopics?: string[];
  streak?: number;
}) {
  const deviceInstallId = body.deviceInstallId ?? useSessionStore.getState().deviceInstallId;
  if (!deviceInstallId) {
    throw new Error('Device identity is not ready yet. Please try again.');
  }
  return postJson<{ tasks: unknown[]; variant: string; focusTheme?: string | null; source?: 'llm' | 'fallback' }>(
    '/v1/tasks/daily',
    {
      ...body,
      deviceInstallId,
    },
    false,
    { timeoutMs: 45_000 },
  );
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
  // LLM-backed; default 8s abort is far below OpenRouter chat budget (~60s).
  return postJson<PredictionsResponse>(
    '/v1/predictions/generate',
    {
      ...body,
      deviceInstallId,
    },
    false,
    { timeoutMs: 60_000 },
  );
}

export type GuideReplyResult =
  | { ok: true; text: string; suggestions: string[]; memoryChanged?: boolean }
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

  // Skip health probe when we recently reached the API successfully (warm session).
  const now = Date.now();
  const lastOk = _chatHealthOkAt;
  if (!lastOk || now - lastOk > 60_000) {
    try {
      await fetchApiHealth();
      _chatHealthOkAt = Date.now();
    } catch (probeErr) {
      captureException(probeErr, { apiRoot: AGASTYA_API_ROOT, phase: 'chat_health_probe' });
      return {
        ok: false,
        error: `${ERRORS.network} (server: ${getApiHostLabel()})`,
        offline: true,
      };
    }
  }

  const focusTheme = useTaskStore.getState().focusTheme;

  const profileSummary = [
    userDisplayName ? `Name: ${userDisplayName}` : '',
    userGender ? `Gender: ${userGender}` : '',
    focusTopics.length ? `Focus areas: ${focusTopics.join(', ')}` : '',
    focusTheme ? `Today's focus: ${focusTheme}` : '',
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
    const { reply, suggestions, memoryChanged } = await withApiRetry(() =>
      chatWithGuide({
        sessionId,
        deviceInstallId,
        messages,
        palmAnalysis,
        profileSummary,
      }),
    );
    _chatHealthOkAt = Date.now();
    if (__DEV__) {
      const frontendPlaceholder = reply.includes('You often think things through before you speak');
      console.log(
        `[Agastya Guide] API reply (${frontendPlaceholder ? 'unexpected placeholder' : 'backend'})`,
        reply.slice(0, 80),
      );
    }
    return { ok: true, text: reply, suggestions: suggestions ?? [], memoryChanged: Boolean(memoryChanged) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : ERRORS.network;
    const friendly = mapApiError(msg);
    const requestId = e instanceof ApiHttpError ? e.requestId : undefined;
    captureException(e, {
      apiRoot: AGASTYA_API_ROOT,
      phase: 'chat_reply',
      friendly,
      ...(requestId ? { requestId } : {}),
    });
    if (__DEV__) {
      console.warn('[Agastya Guide] API error:', friendly, requestId, e);
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

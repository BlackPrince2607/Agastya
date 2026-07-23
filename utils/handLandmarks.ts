/**
 * Native hand landmarks — API MediaPipe only (no invented ROI mesh).
 * Web uses utils/handLandmarks.web.ts.
 */
import { detectPalmLandmarks } from '@/services/agastyaApi';
import { isApiConfigured } from '@/services/env';
import type { HandLandmark } from '@/utils/palmLandmarks';

export type LandmarkSource = 'mediapipe' | 'not_found';

export type HandLandmarkResult = {
  landmarks: HandLandmark[] | null;
  source: LandmarkSource;
};

async function detectViaApi(
  base64: string,
  hand: 'left' | 'right',
): Promise<HandLandmarkResult | null> {
  const api = await detectPalmLandmarks({
    imageBase64: base64,
    dominantHand: hand,
  });
  if (api.landmarks && api.landmarks.length >= 21 && api.source === 'mediapipe') {
    return { landmarks: api.landmarks.slice(0, 21), source: 'mediapipe' };
  }
  return null;
}

/** Palm is centered in PalmScanFrame — try API detection (both hands). No ROI invent. */
export async function detectHandLandmarksFromBase64(
  base64: string,
  hand: 'left' | 'right' = 'right',
): Promise<HandLandmarkResult> {
  if (!isApiConfigured()) {
    return { landmarks: null, source: 'not_found' };
  }

  const order: Array<'left' | 'right'> = [hand, hand === 'right' ? 'left' : 'right'];
  for (const tryHand of order) {
    try {
      const hit = await detectViaApi(base64, tryHand);
      if (hit) {
        if (__DEV__) {
          console.log('[Agastya palm] API MediaPipe landmarks detected', hit.landmarks?.length, tryHand);
        }
        return hit;
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('[Agastya palm] API landmark detection failed', tryHand, err);
      }
    }
  }

  return { landmarks: null, source: 'not_found' };
}

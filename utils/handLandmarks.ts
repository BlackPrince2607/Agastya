/**
 * Native hand landmarks — API MediaPipe when backend is reachable, else ROI estimate.
 * Web uses utils/handLandmarks.web.ts (MediaPipe Tasks Vision in-browser).
 */
import { Image } from 'react-native';

import { detectPalmLandmarks } from '@/services/agastyaApi';
import { isApiConfigured } from '@/services/env';
import type { HandLandmark } from '@/utils/palmLandmarks';
import { estimateLandmarksFromRoi } from '@/utils/palmLandmarks';

export type LandmarkSource = 'mediapipe' | 'roi_estimate';

export type HandLandmarkResult = {
  landmarks: HandLandmark[];
  source: LandmarkSource;
};

function toImageUri(base64: string): string {
  if (base64.startsWith('data:')) return base64;
  return `data:image/jpeg;base64,${base64}`;
}

function imageSizeFromUri(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null),
    );
  });
}

/** Bias ROI center for typical portrait palm photos. */
function roiCenterFromAspect(width: number, height: number): { cx: number; cy: number; scale: number } {
  const aspect = width / height;
  if (aspect < 0.85) {
    return { cx: 0.5, cy: 0.54, scale: 0.26 };
  }
  if (aspect > 1.2) {
    return { cx: 0.5, cy: 0.5, scale: 0.22 };
  }
  return { cx: 0.5, cy: 0.52, scale: 0.24 };
}

/** Palm is centered in PalmScanFrame — try API detection first on native. */
export async function detectHandLandmarksFromBase64(
  base64: string,
  hand: 'left' | 'right' = 'right',
): Promise<HandLandmarkResult> {
  if (isApiConfigured()) {
    try {
      const api = await detectPalmLandmarks({
        imageBase64: base64,
        dominantHand: hand,
      });
      if (api.landmarks && api.landmarks.length >= 21 && api.source === 'mediapipe') {
        if (__DEV__) {
          console.log('[Agastya palm] API MediaPipe landmarks detected', api.landmarks.length);
        }
        return { landmarks: api.landmarks.slice(0, 21), source: 'mediapipe' };
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('[Agastya palm] API landmark detection failed, using ROI estimate', err);
      }
    }
  }

  const size = await imageSizeFromUri(toImageUri(base64));
  const { cx, cy, scale } = size
    ? roiCenterFromAspect(size.width, size.height)
    : { cx: 0.5, cy: 0.52, scale: 0.24 };

  return {
    landmarks: estimateLandmarksFromRoi(cx, cy, scale, hand),
    source: 'roi_estimate',
  };
}

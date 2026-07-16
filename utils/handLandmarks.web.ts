/**
 * Web hand landmarks via MediaPipe Tasks Vision (static palm photo).
 */
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

import type { HandLandmark } from '@/utils/palmLandmarks';
import { estimateLandmarksFromRoi } from '@/utils/palmLandmarks';

export type LandmarkSource = 'mediapipe' | 'roi_estimate';

export type HandLandmarkResult = {
  landmarks: HandLandmark[];
  source: LandmarkSource;
};

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let landmarkerPromise: Promise<HandLandmarker | null> | null = null;

async function getHandLandmarker(): Promise<HandLandmarker | null> {
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
      return HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: 'IMAGE',
        numHands: 2,
        minHandDetectionConfidence: 0.3,
        minHandPresenceConfidence: 0.3,
        minTrackingConfidence: 0.3,
      });
    } catch (err) {
      if (__DEV__) console.warn('[Agastya palm] MediaPipe init failed', err);
      return null;
    }
  })();
  return landmarkerPromise;
}

function base64ToImage(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_decode_failed'));
    const payload = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
    img.src = payload;
  });
}

function mediapipeToLandmarks(
  points: Array<{ x: number; y: number }> | undefined,
): HandLandmark[] | null {
  if (!points || points.length < 21) return null;
  return points.slice(0, 21).map((p) => [p.x, p.y] as HandLandmark);
}

function pickHandIndex(
  result: { landmarks: unknown[]; handedness?: Array<Array<{ categoryName?: string }> | undefined> },
  hand: 'left' | 'right',
): number {
  if (!result.landmarks?.length) return 0;
  if (result.landmarks.length > 1 && result.handedness?.length) {
    const targetHand = hand.toLowerCase();
    const matchIdx = result.handedness.findIndex((entries) => {
      const label = entries?.[0]?.categoryName?.toLowerCase() ?? '';
      return targetHand === 'left' ? label.includes('left') : label.includes('right');
    });
    if (matchIdx >= 0) return matchIdx;
  }
  return 0;
}

function flipImageHorizontal(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function detectHandLandmarksFromBase64(
  base64: string,
  hand: 'left' | 'right' = 'right',
): Promise<HandLandmarkResult> {
  const fallback = (): HandLandmarkResult => ({
    landmarks: estimateLandmarksFromRoi(0.5, 0.52, 0.24, hand),
    source: 'roi_estimate',
  });

  try {
    const landmarker = await getHandLandmarker();
    if (!landmarker) return fallback();

    const image = await base64ToImage(base64);
    let result = landmarker.detect(image);
    let mirrored = false;

    if (!result.landmarks?.length) {
      const flipped = flipImageHorizontal(image);
      result = landmarker.detect(flipped);
      mirrored = Boolean(result.landmarks?.length);
    }

    if (!result.landmarks?.length) return fallback();

    const handIdx = pickHandIndex(result, hand);
    const detected = mediapipeToLandmarks(result.landmarks[handIdx]);
    if (!detected) return fallback();

    const landmarks = mirrored
      ? (detected.map(([x, y]) => [1 - x, y] as HandLandmark))
      : detected;

    if (__DEV__) {
      console.log(
        '[Agastya palm] MediaPipe landmarks detected',
        landmarks.length,
        'hand=',
        hand,
        mirrored ? '(mirrored retry)' : '',
      );
    }
    return { landmarks, source: 'mediapipe' };
  } catch (err) {
    if (__DEV__) console.warn('[Agastya palm] MediaPipe detect failed, using ROI estimate', err);
    return fallback();
  }
}

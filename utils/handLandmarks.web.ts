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
        minHandDetectionConfidence: 0.2,
        minHandPresenceConfidence: 0.2,
        minTrackingConfidence: 0.2,
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

type CanvasVariant = {
  canvas: HTMLCanvasElement;
  /** Map normalized crop coords → full image coords; then optional mirror undo. */
  remap: (pts: HandLandmark[]) => HandLandmark[];
};

function drawImageToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
  opts?: { mirror?: boolean; brightness?: number; contrast?: number },
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  if (opts?.mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, width, height);
  if (opts?.brightness != null || opts?.contrast != null) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const b = opts.brightness ?? 1;
    const c = opts.contrast ?? 1;
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      for (let ch = 0; ch < 3; ch++) {
        let v = data[i + ch] / 255;
        v = (v - 0.5) * c + 0.5;
        v *= b;
        data[i + ch] = Math.max(0, Math.min(255, Math.round(v * 255)));
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }
  return canvas;
}

function buildVariants(image: HTMLImageElement): CanvasVariant[] {
  const fullW = image.naturalWidth || image.width;
  const fullH = image.naturalHeight || image.height;
  const identity = (pts: HandLandmark[]) => pts;
  const unmirror = (pts: HandLandmark[]) => pts.map(([x, y]) => [1 - x, y] as HandLandmark);

  const variants: CanvasVariant[] = [
    { canvas: drawImageToCanvas(image, fullW, fullH), remap: identity },
    { canvas: drawImageToCanvas(image, fullW, fullH, { mirror: true }), remap: unmirror },
    {
      canvas: drawImageToCanvas(image, fullW, fullH, { brightness: 1.15, contrast: 1.12 }),
      remap: identity,
    },
    {
      canvas: drawImageToCanvas(image, fullW, fullH, { mirror: true, brightness: 1.15, contrast: 1.12 }),
      remap: unmirror,
    },
  ];

  const mx = Math.floor(fullW * 0.12);
  const my = Math.floor(fullH * 0.1);
  const cropW = fullW - mx * 2;
  const cropH = fullH - my * 2;
  if (cropW >= 64 && cropH >= 64) {
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const ctx = cropCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(image, mx, my, cropW, cropH, 0, 0, cropW, cropH);
      const remapCrop = (pts: HandLandmark[]): HandLandmark[] =>
        pts.map(
          ([x, y]) =>
            [(x * cropW + mx) / fullW, (y * cropH + my) / fullH] as HandLandmark,
        );
      variants.push({ canvas: cropCanvas, remap: remapCrop });
      variants.push({
        canvas: drawImageToCanvas(cropCanvas, cropW, cropH, { mirror: true }),
        remap: (pts) => remapCrop(unmirror(pts)),
      });
    }
  }

  return variants;
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
    const variants = buildVariants(image);

    for (const variant of variants) {
      const result = landmarker.detect(variant.canvas);
      if (!result.landmarks?.length) continue;

      const handIdx = pickHandIndex(result, hand);
      const detected = mediapipeToLandmarks(result.landmarks[handIdx]);
      if (!detected) continue;

      const landmarks = variant.remap(detected);
      if (__DEV__) {
        console.log('[Agastya palm] MediaPipe landmarks detected', landmarks.length, 'hand=', hand);
      }
      return { landmarks, source: 'mediapipe' };
    }

    return fallback();
  } catch (err) {
    if (__DEV__) console.warn('[Agastya palm] MediaPipe detect failed, using ROI estimate', err);
    return fallback();
  }
}

/**
 * Web hand landmarks via MediaPipe Tasks Vision (static palm photo).
 * Falls back to backend MediaPipe. Never invents ROI landmarks.
 */
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

import { detectPalmLandmarks } from '@/services/agastyaApi';
import { isApiConfigured } from '@/services/env';
import type { HandLandmark } from '@/utils/palmLandmarks';

export type LandmarkSource = 'mediapipe' | 'not_found';

export type HandLandmarkResult = {
  landmarks: HandLandmark[] | null;
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
        minHandDetectionConfidence: 0.12,
        minHandPresenceConfidence: 0.12,
        minTrackingConfidence: 0.12,
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

function letterbox(
  image: HTMLImageElement,
  padRatio: number,
  mirror = false,
): CanvasVariant {
  const fullW = image.naturalWidth || image.width;
  const fullH = image.naturalHeight || image.height;
  const padX = Math.floor(fullW * padRatio);
  const padY = Math.floor(fullH * padRatio);
  const canvasW = fullW + padX * 2;
  const canvasH = fullH + padY * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#303030';
    ctx.fillRect(0, 0, canvasW, canvasH);
    if (mirror) {
      ctx.translate(canvasW, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(image, padX, padY, fullW, fullH);
    } else {
      ctx.drawImage(image, padX, padY, fullW, fullH);
    }
  }
  const unmirror = (pts: HandLandmark[]) => pts.map(([x, y]) => [1 - x, y] as HandLandmark);
  const remapPad = (pts: HandLandmark[]): HandLandmark[] =>
    pts.map(([x, y]) => {
      const nx = (x * canvasW - padX) / fullW;
      const ny = (y * canvasH - padY) / fullH;
      return [Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny))] as HandLandmark;
    });
  return {
    canvas,
    remap: mirror ? (pts) => remapPad(unmirror(pts)) : remapPad,
  };
}

function buildVariants(image: HTMLImageElement): CanvasVariant[] {
  const fullW = image.naturalWidth || image.width;
  const fullH = image.naturalHeight || image.height;
  const identity = (pts: HandLandmark[]) => pts;
  const unmirror = (pts: HandLandmark[]) => pts.map(([x, y]) => [1 - x, y] as HandLandmark);

  const variants: CanvasVariant[] = [
    // Letterbox first — fill-frame palms are the most common miss.
    letterbox(image, 0.22),
    letterbox(image, 0.22, true),
    letterbox(image, 0.35),
    letterbox(image, 0.35, true),
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

  const cropMargins = [
    { mx: 0.12, my: 0.1 },
    { mx: 0.18, my: 0.14 },
  ];
  for (const { mx: mxRatio, my: myRatio } of cropMargins) {
    const mx = Math.floor(fullW * mxRatio);
    const my = Math.floor(fullH * myRatio);
    const cropW = fullW - mx * 2;
    const cropH = fullH - my * 2;
    if (cropW < 64 || cropH < 64) continue;
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const ctx = cropCanvas.getContext('2d');
    if (!ctx) continue;
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

  return variants;
}

async function detectViaApi(
  base64: string,
  hand: 'left' | 'right',
): Promise<HandLandmarkResult | null> {
  if (!isApiConfigured()) return null;
  try {
    const api = await detectPalmLandmarks({
      imageBase64: base64,
      dominantHand: hand,
    });
    if (api.landmarks && api.landmarks.length >= 21 && api.source === 'mediapipe') {
      return { landmarks: api.landmarks.slice(0, 21), source: 'mediapipe' };
    }
  } catch (err) {
    if (__DEV__) console.warn('[Agastya palm] API landmark fallback failed', err);
  }
  return null;
}

export async function detectHandLandmarksFromBase64(
  base64: string,
  hand: 'left' | 'right' = 'right',
): Promise<HandLandmarkResult> {
  const handOrder: Array<'left' | 'right'> = [hand, hand === 'right' ? 'left' : 'right'];

  try {
    const landmarker = await getHandLandmarker();
    if (landmarker) {
      const image = await base64ToImage(base64);
      const variants = buildVariants(image);

      for (const variant of variants) {
        const result = landmarker.detect(variant.canvas);
        if (!result.landmarks?.length) continue;

        for (const tryHand of handOrder) {
          const handIdx = pickHandIndex(result, tryHand);
          const detected = mediapipeToLandmarks(result.landmarks[handIdx]);
          if (!detected) continue;

          const landmarks = variant.remap(detected);
          if (__DEV__) {
            console.log('[Agastya palm] MediaPipe landmarks detected', landmarks.length, tryHand);
          }
          return { landmarks, source: 'mediapipe' };
        }
      }
    }

    for (const tryHand of handOrder) {
      const api = await detectViaApi(base64, tryHand);
      if (api) {
        if (__DEV__) console.log('[Agastya palm] API MediaPipe landmarks (web fallback)', tryHand);
        return api;
      }
    }

    return { landmarks: null, source: 'not_found' };
  } catch (err) {
    if (__DEV__) console.warn('[Agastya palm] MediaPipe detect failed, trying API', err);
    for (const tryHand of handOrder) {
      const api = await detectViaApi(base64, tryHand);
      if (api) return api;
    }
    return { landmarks: null, source: 'not_found' };
  }
}

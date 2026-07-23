/**
 * Single-shot palm auto-capture for expo-camera.
 * Hold guidance → exactly one HQ photo. No probe shutters.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CameraView } from 'expo-camera';

export type AutoPalmPhase = 'idle' | 'holding' | 'capturing' | 'ready';

export type AutoPalmStatus = {
  phase: AutoPalmPhase;
  /** 0–1 progress through the hold window. */
  progress: number;
  message: string;
};

type Options = {
  enabled: boolean;
  cameraRef: React.RefObject<CameraView | null>;
  onCaptured: (base64: string) => void;
  /** Hold duration before the single capture (ms). */
  holdMs?: number;
};

const DEFAULT_HOLD_MS = 2200;

async function takeFinal(camera: CameraView): Promise<string | null> {
  try {
    const photo = await camera.takePictureAsync({
      base64: true,
      quality: 0.88,
      shutterSound: false,
    } as never);
    return photo?.base64 ?? null;
  } catch {
    return null;
  }
}

export function useAutoPalmCapture({
  enabled,
  cameraRef,
  onCaptured,
  holdMs = DEFAULT_HOLD_MS,
}: Options): AutoPalmStatus {
  const [phase, setPhase] = useState<AutoPalmPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Open your palm inside the frame');

  const capturedRef = useRef(false);
  const capturingRef = useRef(false);
  const onCapturedRef = useRef(onCaptured);
  onCapturedRef.current = onCaptured;

  const finishCapture = useCallback(async () => {
    if (capturedRef.current || capturingRef.current) return;
    const cam = cameraRef.current;
    if (!cam) return;

    capturingRef.current = true;
    capturedRef.current = true;
    setPhase('capturing');
    setProgress(1);
    setMessage('Capturing your palm…');

    try {
      const base64 = await takeFinal(cam);
      if (!base64) {
        capturedRef.current = false;
        capturingRef.current = false;
        setPhase('holding');
        setProgress(0);
        setMessage('Couldn’t capture — hold steady…');
        return;
      }
      setPhase('ready');
      setMessage('Photo captured');
      onCapturedRef.current(base64);
    } finally {
      capturingRef.current = false;
    }
  }, [cameraRef]);

  useEffect(() => {
    if (!enabled) {
      setPhase('idle');
      setProgress(0);
      setMessage('Open your palm inside the frame');
      capturedRef.current = false;
      capturingRef.current = false;
      return;
    }

    capturedRef.current = false;
    capturingRef.current = false;
    setPhase('holding');
    setProgress(0);
    setMessage('Hold your open palm steady…');

    const started = Date.now();
    let cancelled = false;
    let captureArmed = false;

    const progressId = setInterval(() => {
      if (cancelled || capturedRef.current) return;
      const elapsed = Date.now() - started;
      const pct = Math.min(1, elapsed / holdMs);
      setProgress(pct);
      if (pct >= 1 && !captureArmed) {
        captureArmed = true;
        void finishCapture();
      }
    }, 50);

    const holdTimer = setTimeout(() => {
      if (cancelled || captureArmed) return;
      captureArmed = true;
      void finishCapture();
    }, holdMs);

    return () => {
      cancelled = true;
      clearInterval(progressId);
      clearTimeout(holdTimer);
    };
  }, [enabled, cameraRef, holdMs, finishCapture]);

  return { phase, progress, message };
}

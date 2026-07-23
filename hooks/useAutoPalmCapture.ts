/**
 * Live palm auto-capture for expo-camera.
 * Polls quiet low-res snapshots → MediaPipe landmarks → stable lock → HQ capture.
 * If landmarks never lock, falls back to a short hold-still auto-capture.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CameraView } from 'expo-camera';

import { isApiConfigured } from '@/services/env';
import { detectHandLandmarksFromBase64 } from '@/utils/handLandmarks';
import type { HandLandmark } from '@/utils/palmLandmarks';

export type AutoPalmPhase =
  | 'idle'
  | 'searching'
  | 'locking'
  | 'capturing'
  | 'ready'
  | 'timed_hold';

export type AutoPalmStatus = {
  phase: AutoPalmPhase;
  hits: number;
  message: string;
};

type Options = {
  enabled: boolean;
  hand: 'left' | 'right';
  cameraRef: React.RefObject<CameraView | null>;
  onCaptured: (base64: string) => void;
  requiredHits?: number;
  pollMs?: number;
  fallbackHoldAfterMs?: number;
};

const DEFAULT_HITS = 2;
const DEFAULT_POLL_MS = 950;
const FALLBACK_HOLD_MS = 9_000;
const HOLD_COUNTDOWN_MS = 1600;

function landmarksLookLikeOpenPalm(lm: HandLandmark[]): boolean {
  if (lm.length < 21) return false;
  const wrist = lm[0];
  const middleTip = lm[12];
  const indexMcp = lm[5];
  const pinkyMcp = lm[17];
  if (!wrist || !middleTip || !indexMcp || !pinkyMcp) return false;
  const verticalSpan = Math.abs(wrist[1] - middleTip[1]);
  const palmWidth = Math.abs(pinkyMcp[0] - indexMcp[0]);
  return verticalSpan >= 0.22 && palmWidth >= 0.12 && wrist[1] > middleTip[1] - 0.05;
}

async function takeProbe(camera: CameraView): Promise<string | null> {
  try {
    const photo = await camera.takePictureAsync({
      base64: true,
      quality: 0.35,
      shutterSound: false,
      skipProcessing: true,
    } as never);
    return photo?.base64 ?? null;
  } catch {
    return null;
  }
}

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
  hand,
  cameraRef,
  onCaptured,
  requiredHits = DEFAULT_HITS,
  pollMs = DEFAULT_POLL_MS,
  fallbackHoldAfterMs = FALLBACK_HOLD_MS,
}: Options): AutoPalmStatus {
  const [phase, setPhase] = useState<AutoPalmPhase>('idle');
  const [hits, setHits] = useState(0);
  const [message, setMessage] = useState('Open your palm inside the frame');

  const busyRef = useRef(false);
  const hitsRef = useRef(0);
  const startedAtRef = useRef(0);
  const capturedRef = useRef(false);
  const fallbackArmedRef = useRef(false);
  const onCapturedRef = useRef(onCaptured);
  onCapturedRef.current = onCaptured;

  const finishCapture = useCallback(async () => {
    if (capturedRef.current || busyRef.current) return false;
    const cam = cameraRef.current;
    if (!cam) return false;
    busyRef.current = true;
    capturedRef.current = true;
    setPhase('capturing');
    setMessage('Palm locked — capturing…');
    try {
      const base64 = await takeFinal(cam);
      if (!base64) {
        capturedRef.current = false;
        setPhase('searching');
        setMessage('Couldn’t capture — hold steady…');
        return false;
      }
      setPhase('ready');
      setMessage('Photo captured');
      onCapturedRef.current(base64);
      return true;
    } finally {
      busyRef.current = false;
    }
  }, [cameraRef]);

  useEffect(() => {
    if (!enabled) {
      setPhase('idle');
      setMessage('Open your palm inside the frame');
      hitsRef.current = 0;
      setHits(0);
      capturedRef.current = false;
      busyRef.current = false;
      fallbackArmedRef.current = false;
      return;
    }

    const apiOk = isApiConfigured();
    setPhase(apiOk ? 'searching' : 'timed_hold');
    setMessage(apiOk ? 'Searching for your open palm…' : 'Hold your open palm steady — capturing shortly');
    hitsRef.current = 0;
    setHits(0);
    capturedRef.current = false;
    busyRef.current = false;
    fallbackArmedRef.current = !apiOk;
    startedAtRef.current = Date.now();

    let cancelled = false;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const armFallbackHold = () => {
      if (fallbackArmedRef.current || capturedRef.current || cancelled) return;
      fallbackArmedRef.current = true;
      setPhase('timed_hold');
      setMessage('Hold still — capturing your palm…');
      holdTimer = setTimeout(() => {
        void finishCapture();
      }, HOLD_COUNTDOWN_MS);
    };

    if (!apiOk) {
      armFallbackHold();
    }

    const tick = async () => {
      if (cancelled || capturedRef.current || busyRef.current) return;
      if (fallbackArmedRef.current) return;

      const cam = cameraRef.current;
      if (!cam) return;

      const elapsed = Date.now() - startedAtRef.current;
      if (elapsed >= fallbackHoldAfterMs) {
        armFallbackHold();
        return;
      }

      if (!isApiConfigured()) {
        armFallbackHold();
        return;
      }

      busyRef.current = true;
      try {
        const probe = await takeProbe(cam);
        if (cancelled || capturedRef.current || !probe) return;

        const result = await detectHandLandmarksFromBase64(probe, hand);
        if (cancelled || capturedRef.current) return;

        const ok =
          result.source === 'mediapipe' &&
          Boolean(result.landmarks) &&
          landmarksLookLikeOpenPalm(result.landmarks!);

        if (ok) {
          hitsRef.current += 1;
          setHits(hitsRef.current);
          if (hitsRef.current >= requiredHits) {
            setPhase('locking');
            setMessage('Palm detected — hold still…');
            await finishCapture();
            return;
          }
          setPhase('locking');
          setMessage(`Palm found — hold steady (${hitsRef.current}/${requiredHits})…`);
        } else {
          hitsRef.current = 0;
          setHits(0);
          setPhase('searching');
          setMessage('Open your palm and fill the frame…');
        }
      } catch {
        if (!cancelled && !capturedRef.current) {
          setPhase('searching');
          setMessage('Looking for your palm…');
        }
      } finally {
        busyRef.current = false;
      }
    };

    intervalId = setInterval(() => {
      void tick();
    }, pollMs);
    void tick();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (holdTimer) clearTimeout(holdTimer);
    };
  }, [enabled, hand, cameraRef, requiredHits, pollMs, fallbackHoldAfterMs, finishCapture]);

  return { phase, hits, message };
}

/**
 * Lightweight capture heuristics — no MediaPipe / OpenCV / pixel decode.
 * Soft warn only; caller always offers "Use anyway".
 */
export type PalmCaptureQuality = {
  ok: boolean;
  reasons: string[];
  approxBytes: number;
};

/** Strip data-URL prefix if present. */
export function stripBase64Prefix(raw: string): string {
  const i = raw.indexOf('base64,');
  return i >= 0 ? raw.slice(i + 7) : raw;
}

/**
 * Cheap pre-upload checks from payload size.
 * Pixel brightness/blur stay on the backend — device only flags obviously bad files.
 */
export function assessPalmCaptureQuality(imageBase64: string): PalmCaptureQuality {
  const reasons: string[] = [];
  try {
    const payload = stripBase64Prefix(imageBase64).replace(/\s/g, '');
    const approxBytes = Math.floor((payload.length * 3) / 4);
    if (approxBytes < 18_000) reasons.push('photo looks too small or heavily compressed');
    if (approxBytes > 12_000_000) reasons.push('photo is unusually large');
    return { ok: reasons.length === 0, reasons, approxBytes };
  } catch {
    return { ok: true, reasons: [], approxBytes: 0 };
  }
}

/** Confirm soft quality; resolves true to proceed, false to abort. */
export function confirmSoftQualityOrProceed(
  quality: PalmCaptureQuality,
  alertFn: (
    title: string,
    message: string,
    buttons: Array<{ text: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void }>,
  ) => void,
): Promise<boolean> {
  if (quality.ok) return Promise.resolve(true);
  const bullets = quality.reasons.map((r) => `• ${r}`).join('\n');
  return new Promise((resolve) => {
    alertFn(
      'Photo may be hard to read',
      `${bullets}\n\nYou can retake for a clearer shot, or continue anyway.`,
      [
        { text: 'Retake', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Use anyway', onPress: () => resolve(true) },
      ],
    );
  });
}

import { useState } from 'react';
import { Alert } from 'react-native';

import { PalmScanBriefing } from '@/components/onboarding/PalmScanBriefing';
import type { PalmScanHand } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { pickPalmImage } from '@/utils/pickPalmImage';
import { deferRouterPush } from '@/utils/routerDefer';

/** Web: file upload instead of native camera. */
export default function PalmScanWebScreen() {
  const palmScanHand = useSessionStore((s) => s.palmScanHand);
  const setPalmScanHand = useSessionStore((s) => s.setPalmScanHand);
  const setPalmCaptureBase64 = useSessionStore((s) => s.setPalmCaptureBase64);
  const [uploadBusy, setUploadBusy] = useState(false);

  const uploadAndContinue = async () => {
    if (uploadBusy) return;
    setUploadBusy(true);
    try {
      const hand: PalmScanHand = palmScanHand ?? 'right';
      const seed = `${hand}-${Date.now()}`;
      const base64 = await pickPalmImage();
      if (!base64) return;
      setPalmCaptureBase64(base64);
      deferRouterPush({
        pathname: '/onboarding/analysis',
        params: { seed },
      });
    } catch {
      Alert.alert('Upload failed', 'We couldn’t read that image. Try a JPG or PNG of your open palm.');
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <PalmScanBriefing
      hand={palmScanHand}
      onHandChange={setPalmScanHand}
      primaryLabel={uploadBusy ? 'Opening…' : 'Upload palm photo'}
      primaryIcon="image"
      onPrimaryPress={() => void uploadAndContinue()}
    />
  );
}

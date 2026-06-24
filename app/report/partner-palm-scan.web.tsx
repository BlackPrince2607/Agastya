import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { HandToggleRow } from '@/components/onboarding/HandToggle';
import { PalmScanFrame } from '@/components/onboarding/PalmScanFrame';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { CosmicButton } from '@/components/primitives';
import { Icon } from '@/components/ui';
import { PAGE_PADDING } from '@/constants/layout';
import type { PalmScanHand } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { pickPalmImage } from '@/utils/pickPalmImage';
import { deferRouterPush } from '@/utils/routerDefer';

/** Web: upload partner palm photo for compatibility matching. */
export default function PartnerPalmScanWebScreen() {
  const partnerPalmScanHand = useSessionStore((s) => s.partnerPalmScanHand);
  const setPartnerPalmScanHand = useSessionStore((s) => s.setPartnerPalmScanHand);
  const setPartnerPalmCaptureBase64 = useSessionStore((s) => s.setPartnerPalmCaptureBase64);
  const [uploadBusy, setUploadBusy] = useState(false);

  const hand: PalmScanHand = partnerPalmScanHand ?? 'right';

  const uploadAndContinue = async () => {
    if (uploadBusy) return;
    setUploadBusy(true);
    try {
      const seed = `partner-${hand}-${Date.now()}`;
      const base64 = await pickPalmImage();
      if (!base64) return;
      setPartnerPalmCaptureBase64(base64);
      deferRouterPush({
        pathname: '/report/partner-palm-analysis' as never,
        params: { seed },
      });
    } catch {
      Alert.alert('Upload failed', 'We couldn’t read that image. Try a JPG or PNG of their open palm.');
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <CosmicScreen variant="stitch">
      <View className="flex-1 pb-8 pt-2" style={{ paddingHorizontal: PAGE_PADDING }}>
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
            <Icon name="chevron_left" size={24} color="#22d3ee" />
          </Pressable>
          <Text className="min-w-0 flex-1 font-headline text-[20px] text-on-surface" numberOfLines={1}>
            Upload partner&apos;s palm
          </Text>
        </View>

        <View className="mt-6 gap-5">
          <Text className="font-inter text-[15px] leading-6 text-md-on-surface-variant">
            Choose a clear photo of your partner&apos;s open {hand} palm. Good lighting helps us read the lines accurately.
          </Text>

          <View className="items-center py-2">
            <PalmScanFrame size={260} hand={hand} showScanLine={false} />
          </View>

          <HandToggleRow hand={partnerPalmScanHand} onSelect={setPartnerPalmScanHand} />

          <CosmicButton
            gradient="nebulaMd3"
            label={uploadBusy ? 'Opening…' : 'Choose palm photo'}
            disabled={uploadBusy}
            onPress={() => void uploadAndContinue()}
          />
        </View>
      </View>
    </CosmicScreen>
  );
}

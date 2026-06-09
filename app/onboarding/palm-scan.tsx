import FontAwesome from '@expo/vector-icons/FontAwesome';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { ScanFrameCorners } from '@/components/onboarding/ScanFrameCorners';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { PalmScanBriefing } from '@/components/onboarding/PalmScanBriefing';
import { ScanLine } from '@/components/onboarding/ScanLine';
import { BlurContainer, CosmicButton, GradientText } from '@/components/primitives';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { PALM_CAPTURE_FAILED } from '@/constants/userCopy';
import { stitchSignal } from '@/constants/theme';
import type { PalmScanHand } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { deferRouterPush } from '@/utils/routerDefer';

const FRAME = 300;

function HandToggle({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="min-w-[48%] flex-1">
      <View
        className={
          selected
            ? 'rounded-full border border-stitch-magenta bg-stitch-magenta/15 px-4 py-3 shadow-glow'
            : 'rounded-full border border-white/15 bg-black/45 px-4 py-3'
        }>
        <Text className="text-center font-space-grotesk text-[11px] font-semibold uppercase tracking-[0.14em] text-mist">
          {label}
        </Text>
        <Text className="mt-1 text-center font-inter text-[11px] text-md-on-surface-variant">{sub}</Text>
      </View>
    </Pressable>
  );
}

export default function PalmScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [pastBriefing, setPastBriefing] = useState(false);
  const palmScanHand = useSessionStore((s) => s.palmScanHand);
  const setPalmScanHand = useSessionStore((s) => s.setPalmScanHand);
  const setPalmCaptureBase64 = useSessionStore((s) => s.setPalmCaptureBase64);
  const camRef = useRef<any>(null);

  if (!permission) {
    return (
      <CosmicScreen insetTop={false}>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="font-inter text-mist">Gathering optics…</Text>
        </View>
      </CosmicScreen>
    );
  }

  const requestAndContinue = async () => {
    setPastBriefing(true);
    await requestPermission();
  };

  if (!pastBriefing) {
    return (
      <PalmScanBriefing
        primaryLabel="Scan Your Palm"
        primaryIcon="camera"
        onPrimaryPress={() => void requestAndContinue()}
      />
    );
  }

  if (!permission.granted) {
    return (
      <CosmicScreen>
        <View className="flex-1">
          <CosmicDotGrid />
          <View className="flex-1 justify-center gap-10 px-7 pb-8">
            <OnboardingHeader step={ONBOARDING_STEPS.palmScan} total={ONBOARDING_TOTAL_STEPS} />
            <View>
              <GradientText className="font-space-grotesk text-[12px] uppercase tracking-[0.45em] text-stitch-signal">
                Camera access
              </GradientText>
              <Text className="mt-4 font-noto-serif text-[26px] leading-8 text-mist">
                We need your camera for the palm scan
              </Text>
              <Text className="mt-4 font-inter text-[15px] leading-7 text-md-on-surface-variant">
                Use a well-lit space and hold your palm steady. We only capture your hand—not your face.
              </Text>
            </View>
            <CosmicButton variant="ghost" label="Allow camera" onPress={() => requestPermission()} />
            <CosmicButton variant="ghost" label="Back to checklist" onPress={() => setPastBriefing(false)} />
          </View>
        </View>
      </CosmicScreen>
    );
  }

  const startScan = async () => {
    const hand: PalmScanHand = palmScanHand ?? 'right';
    const seed = `${hand}-${Date.now()}`;
    try {
      const photo = await camRef.current?.takePictureAsync({
        base64: true,
        quality: 0.55,
      });
      if (!photo?.base64) {
        Alert.alert('Couldn’t capture palm', PALM_CAPTURE_FAILED);
        return;
      }
      setPalmCaptureBase64(photo.base64);
    } catch {
      Alert.alert('Couldn’t capture palm', PALM_CAPTURE_FAILED);
      return;
    }

    deferRouterPush({
      pathname: '/onboarding/analysis',
      params: { seed },
    });
  };

  return (
    <CosmicScreen insetTop={false}>
      <CameraView ref={camRef} facing="back" style={{ flex: 1 }}>
        <View className="flex-1 bg-black/45">
          <CosmicDotGrid />
          <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
            <View className="flex-1 px-7 pb-4 pt-2">
              <OnboardingHeader step={ONBOARDING_STEPS.palmScan} total={ONBOARDING_TOTAL_STEPS} />

              <View className="mt-2 gap-2">
                <Text className="font-noto-serif text-[28px] leading-8 text-mist">Palm scan</Text>
                <Text className="font-inter text-[14px] leading-6 text-md-on-surface-variant">
                  Align your palm with the guide, choose your dominant hand, then tap capture.
                </Text>
              </View>

              <View className="flex-1 items-center justify-center py-6">
                <View className="items-center justify-center" style={{ width: FRAME, height: FRAME * 1.05 }}>
                  <ScanFrameCorners size={FRAME} color={stitchSignal} bracket={32} />
                  <View
                    pointerEvents="none"
                    className="absolute"
                    style={{
                      width: FRAME - 48,
                      height: (FRAME - 48) * 1.2,
                      borderRadius: 22,
                      overflow: 'hidden',
                      borderWidth: 2,
                      borderColor: 'rgba(34,211,238,0.4)',
                    }}>
                    <LinearGradient
                      colors={['rgba(34,211,238,0.18)', 'transparent', 'rgba(168,85,247,0.14)']}
                      start={{ x: 0.2, y: 0 }}
                      end={{ x: 0.8, y: 1 }}
                      style={{ flex: 1 }}
                    />
                    <ScanLine width={FRAME - 48} height={(FRAME - 48) * 1.2} color="#22d3ee" />
                  </View>
                </View>
              </View>

              <View className="gap-4">
                <View className="flex-row gap-3">
                  <HandToggle
                    label="Left hand"
                    sub="Often receptive energy"
                    selected={palmScanHand === 'left'}
                    onPress={() => setPalmScanHand('left')}
                  />
                  <HandToggle
                    label="Right hand"
                    sub="Often active energy"
                    selected={palmScanHand === 'right' || palmScanHand === null}
                    onPress={() => setPalmScanHand('right')}
                  />
                </View>

                <BlurContainer intensity={48} className="rounded-3xl border border-white/12 bg-cosmic-void/65 p-5">
                  <CosmicButton gradient="nebulaMd3" label="Start scan" onPress={() => void startScan()} />
                  <Text className="mt-5 text-center font-inter text-[11px] leading-5 text-md-on-primary-container">
                    By scanning, you agree to our celestial privacy terms. v1 keeps captures ephemeral on-device until Supabase Storage
                    wiring ships — PRD v2 adds MediaPipe mesh fidelity.
                  </Text>
                </BlurContainer>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </CameraView>
    </CosmicScreen>
  );
}

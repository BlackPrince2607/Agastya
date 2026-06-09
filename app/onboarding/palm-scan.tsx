import { Ionicons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { Alert, Image, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { ScanFrameCorners } from '@/components/onboarding/ScanFrameCorners';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { ScanLine } from '@/components/onboarding/ScanLine';
import { BlurContainer, CosmicButton, GradientText } from '@/components/primitives';
import { triggerLightTap } from '@/hooks/useHapticTap';
import type { PalmScanHand } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { PALM_CAPTURE_FAILED } from '@/constants/userCopy';
import { pickPalmImageWeb } from '@/utils/pickPalmImageWeb';
import { deferRouterPush } from '@/utils/routerDefer';
import { stitchMd3, STITCH_READY_SCAN_PALM_URI } from '@/constants/stitchWelcome';
import { stitchSignal } from '@/constants/theme';

const FRAME = 300;
const BRIEF_FRAME = 288;
const isWeb = Platform.OS === 'web';

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

  const uploadAndContinueWeb = async () => {
    const hand: PalmScanHand = palmScanHand ?? 'right';
    const seed = `${hand}-${Date.now()}`;
    const base64 = await pickPalmImageWeb();
    if (!base64) return;
    setPalmCaptureBase64(base64);
    deferRouterPush({
      pathname: '/onboarding/analysis',
      params: { seed },
    });
  };

  const requestAndContinue = async () => {
    setPastBriefing(true);
    await requestPermission();
  };

  if (!pastBriefing) {
    return (
      <CosmicScreen>
        <View className="flex-1">
          <CosmicDotGrid />
          <View className="flex-1 justify-between px-7 pb-10 pt-2">
            <OnboardingHeader step={ONBOARDING_STEPS.palmScan} total={ONBOARDING_TOTAL_STEPS} />

            <View className="gap-3">
              <Text className="font-noto-serif text-[32px] leading-[36px] tracking-tight text-mist">The stars are aligned.</Text>
              <Text className="font-inter text-[17px] leading-7 text-mist/72">
                Take a clear photo of your palm in a well-lit area for the most accurate reading.
              </Text>
            </View>

            <View className="mt-4 items-center">
              <View
                className="relative overflow-hidden rounded-2xl border border-white/20 bg-black/30"
                style={{
                  width: Math.min(BRIEF_FRAME + 16, 340),
                  aspectRatio: 3 / 4,
                }}>
                <Image
                  accessibilityIgnoresInvertColors
                  source={{ uri: STITCH_READY_SCAN_PALM_URI }}
                  className="absolute inset-0 h-full w-full"
                  resizeMode="cover"
                  style={{ opacity: 0.58 }}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(20,19,21,0.35)']}
                  style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' }}
                />
                <View className="absolute inset-0 items-center justify-center">
                  <View
                    className="absolute overflow-hidden rounded-[2rem] border-2 border-dashed border-white/25"
                    style={{ width: 248, height: 312 }}>
                    <LinearGradient
                      colors={['rgba(34,211,238,0.15)', 'transparent']}
                      style={{ position: 'absolute', left: 0, right: 0, top: '62%', height: 3 }}
                    />
                  </View>
                  <View pointerEvents="none" className="absolute items-center justify-center">
                    <ScanFrameCorners size={BRIEF_FRAME} color={stitchMd3.primary} bracket={26} />
                  </View>
                </View>
                <View className="absolute bottom-6 left-0 right-0 flex-row justify-center">
                  <View className="flex-row items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-2">
                    <Ionicons name="sunny-outline" size={17} color={stitchMd3.primary} />
                    <Text className="font-space-grotesk text-[11px] uppercase tracking-[0.18em] text-mist">Perfect Lighting</Text>
                  </View>
                </View>
              </View>
            </View>

            <View className="mt-2 flex-row gap-3">
              <View className="flex-1 rounded-2xl border border-white/12 bg-white/5 p-4">
                <View
                  className="mb-3 h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: 'rgba(211,190,235,0.12)', borderWidth: 1, borderColor: 'rgba(211,190,235,0.28)' }}>
                  <FontAwesome name="hand-paper-o" size={19} color={stitchMd3.primary} />
                </View>
                <Text className="font-space-grotesk text-[11px] font-semibold uppercase tracking-[0.14em] text-mist">Open Hand</Text>
                <Text className="mt-2 font-inter text-[11px] leading-4 text-md-on-surface-variant">Keep fingers together</Text>
              </View>
              <View className="flex-1 rounded-2xl border border-white/12 bg-white/5 p-4">
                <View
                  className="mb-3 h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: 'rgba(211,190,235,0.12)', borderWidth: 1, borderColor: 'rgba(211,190,235,0.28)' }}>
                  <Ionicons name="scan-outline" size={21} color={stitchMd3.primary} />
                </View>
                <Text className="font-space-grotesk text-[11px] font-semibold uppercase tracking-[0.14em] text-mist">Steady Focus</Text>
                <Text className="mt-2 font-inter text-[11px] leading-4 text-md-on-surface-variant">Avoid blurry capture</Text>
              </View>
            </View>

            <View className="mt-auto gap-5 pt-8">
              <CosmicButton
                gradient="nebulaMd3"
                label={isWeb ? 'Upload palm photo' : 'Scan Your Palm'}
                icon={<FontAwesome name={isWeb ? 'image' : 'camera'} size={18} color={stitchMd3.onPrimary} />}
                onPress={() => void (isWeb ? uploadAndContinueWeb() : requestAndContinue())}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void triggerLightTap();
                  Alert.alert(
                    'Tips for a better reading',
                    'Use natural daylight or a bright lamp, keep the full palm inside the frame, and remove gloves or heavy rings so lines stay visible.',
                  );
                }}
                className="items-center py-2">
                <Text className="font-space-grotesk text-[12px] uppercase tracking-[0.16em] text-mist/55">Tips for a better reading</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </CosmicScreen>
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

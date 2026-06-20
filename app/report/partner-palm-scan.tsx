import FontAwesome from '@expo/vector-icons/FontAwesome';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { ScanFrameCorners } from '@/components/onboarding/ScanFrameCorners';
import { ScanLine } from '@/components/onboarding/ScanLine';
import { CosmicButton, GradientText } from '@/components/primitives';
import { Icon } from '@/components/ui';
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

/** Scan a partner's palm for compatibility matching. */
export default function PartnerPalmScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const partnerPalmScanHand = useSessionStore((s) => s.partnerPalmScanHand);
  const setPartnerPalmScanHand = useSessionStore((s) => s.setPartnerPalmScanHand);
  const setPartnerPalmCaptureBase64 = useSessionStore((s) => s.setPartnerPalmCaptureBase64);
  const camRef = useRef<CameraView>(null);

  if (!permission) {
    return (
      <CosmicScreen insetTop={false}>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="font-inter text-mist">Gathering optics…</Text>
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
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Back"
                className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
                <Icon name="chevron_left" size={24} color="#22d3ee" />
              </Pressable>
              <Text className="font-headline text-[20px] text-on-surface">Partner palm scan</Text>
            </View>
            <View>
              <GradientText className="font-space-grotesk text-[12px] uppercase tracking-[0.45em] text-stitch-signal">
                Camera access
              </GradientText>
              <Text className="mt-4 font-noto-serif text-[26px] leading-8 text-mist">
                We need your camera to scan their palm
              </Text>
              <Text className="mt-4 font-inter text-[15px] leading-7 text-md-on-surface-variant">
                Ask your partner to hold their palm steady in a well-lit space. We only capture the hand—not their face.
              </Text>
            </View>
            <CosmicButton variant="ghost" label="Allow camera" onPress={() => requestPermission()} />
          </View>
        </View>
      </CosmicScreen>
    );
  }

  const startScan = async () => {
    const hand: PalmScanHand = partnerPalmScanHand ?? 'right';
    const seed = `partner-${hand}-${Date.now()}`;
    try {
      const photo = await camRef.current?.takePictureAsync({
        base64: true,
        quality: 0.55,
      });
      if (!photo?.base64) {
        Alert.alert('Couldn’t capture palm', PALM_CAPTURE_FAILED);
        return;
      }
      setPartnerPalmCaptureBase64(photo.base64);
    } catch {
      Alert.alert('Couldn’t capture palm', PALM_CAPTURE_FAILED);
      return;
    }

    deferRouterPush({
      pathname: '/report/partner-palm-analysis' as never,
      params: { seed },
    });
  };

  return (
    <CosmicScreen insetTop={false}>
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="flex-1">
          <CosmicDotGrid />
          <View className="flex-row items-center gap-3 px-6 pt-2">
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
              <Icon name="chevron_left" size={24} color="#22d3ee" />
            </Pressable>
            <Text className="min-w-0 flex-1 font-headline text-[20px] text-on-surface" numberOfLines={1}>
              Scan partner&apos;s palm
            </Text>
          </View>

          <View className="flex-1 items-center justify-center px-6">
            <View style={{ width: FRAME, height: FRAME }} className="relative items-center justify-center">
              <CameraView ref={camRef} facing="back" style={{ width: FRAME, height: FRAME, borderRadius: 24 }} />
              <View className="pointer-events-none absolute inset-0 items-center justify-center">
                <ScanFrameCorners size={FRAME} />
                <ScanLine width={FRAME - 48} height={FRAME - 48} />
              </View>
            </View>

            <Text className="mt-6 text-center font-inter text-[14px] leading-6 text-md-on-surface-variant">
              Center their palm inside the frame. Hold steady for a clear read.
            </Text>

            <View className="mt-6 w-full flex-row gap-3">
              <HandToggle
                label="Left hand"
                sub="Receptive energy"
                selected={partnerPalmScanHand === 'left'}
                onPress={() => setPartnerPalmScanHand('left')}
              />
              <HandToggle
                label="Right hand"
                sub="Active energy"
                selected={partnerPalmScanHand === 'right' || partnerPalmScanHand === null}
                onPress={() => setPartnerPalmScanHand('right')}
              />
            </View>
          </View>

          <View className="px-6 pb-6">
            <Pressable onPress={() => void startScan()} className="active:opacity-90">
              <LinearGradient
                colors={['#d392f6', '#a855f7', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 999, paddingVertical: 18, alignItems: 'center' }}>
                <View className="flex-row items-center gap-3">
                  <FontAwesome name="camera" size={18} color="#fff" />
                  <Text className="font-space-grotesk text-[13px] font-semibold uppercase tracking-[0.2em] text-white">
                    Capture palm
                  </Text>
                </View>
              </LinearGradient>
            </Pressable>
            <Text className="mt-3 text-center font-inter text-[12px] text-stitch-signal/80">
              Palm data is analyzed locally for matching only.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </CosmicScreen>
  );
}

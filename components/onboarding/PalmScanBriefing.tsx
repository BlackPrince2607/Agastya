import { Ionicons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { ScanFrameCorners } from '@/components/onboarding/ScanFrameCorners';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { CosmicButton } from '@/components/primitives';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { stitchMd3, STITCH_READY_SCAN_PALM_URI } from '@/constants/stitchWelcome';
import { triggerLightTap } from '@/hooks/useHapticTap';

const BRIEF_FRAME = 288;

type PalmScanBriefingProps = {
  primaryLabel: string;
  primaryIcon: 'camera' | 'image';
  onPrimaryPress: () => void;
  /** Optional slot above the primary CTA (e.g. hand picker on web). */
  beforePrimary?: ReactNode;
};

export function PalmScanBriefing({ primaryLabel, primaryIcon, onPrimaryPress, beforePrimary }: PalmScanBriefingProps) {
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
            {beforePrimary}
            <CosmicButton
              gradient="nebulaMd3"
              label={primaryLabel}
              icon={<FontAwesome name={primaryIcon} size={18} color={stitchMd3.onPrimary} />}
              onPress={onPrimaryPress}
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

import { Ionicons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { HandToggleRow } from '@/components/onboarding/HandToggle';
import { PalmScanFrame } from '@/components/onboarding/PalmScanFrame';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { CosmicButton } from '@/components/primitives';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { PAGE_PADDING } from '@/constants/layout';
import { stitchMd3, STITCH_READY_SCAN_PALM_URI } from '@/constants/stitchWelcome';
import { triggerLightTap } from '@/hooks/useHapticTap';
import type { PalmScanHand } from '@/store/sessionStore';

const BRIEF_FRAME = 288;

type PalmScanBriefingProps = {
  primaryLabel: string;
  primaryIcon: 'camera' | 'image';
  onPrimaryPress: () => void;
  hand: PalmScanHand | null;
  onHandChange: (hand: PalmScanHand) => void;
  /** Optional slot above the primary CTA (e.g. secondary upload button). */
  beforePrimary?: ReactNode;
};

export function PalmScanBriefing({
  primaryLabel,
  primaryIcon,
  onPrimaryPress,
  hand,
  onHandChange,
  beforePrimary,
}: PalmScanBriefingProps) {
  return (
    <CosmicScreen>
      <View className="flex-1">
        <CosmicDotGrid />
        <View className="flex-1 justify-between pb-10 pt-2" style={{ paddingHorizontal: PAGE_PADDING }}>
          <OnboardingHeader step={ONBOARDING_STEPS.palmScan} total={ONBOARDING_TOTAL_STEPS} />

          <View className="mt-4 gap-3">
            <Text className="font-noto-serif text-[30px] leading-[34px] tracking-tight text-mist">
              Position your palm
            </Text>
            <Text className="font-inter text-[16px] leading-7 text-mist/75">
              Choose your hand, then capture or upload a clear photo in good light.
            </Text>
          </View>

          <View className="my-5 items-center">
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
                style={{ opacity: 0.55 }}
              />
              <LinearGradient
                colors={['transparent', 'rgba(20,19,21,0.4)']}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' }}
              />
              <View className="absolute inset-0 items-center justify-center">
                <PalmScanFrame size={BRIEF_FRAME} hand={hand} showScanLine={false} cornerColor={stitchMd3.primary} />
              </View>
              <View className="absolute bottom-5 left-0 right-0 flex-row justify-center">
                <View className="flex-row items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-2">
                  <Ionicons name="sunny-outline" size={17} color={stitchMd3.primary} />
                  <Text className="font-space-grotesk text-[11px] uppercase tracking-[0.16em] text-mist">Good lighting</Text>
                </View>
              </View>
            </View>
          </View>

          <HandToggleRow hand={hand} onSelect={onHandChange} />

          <View className="mt-4 flex-row gap-3">
            <View className="flex-1 rounded-2xl border border-white/12 bg-white/5 p-4">
              <View
                className="mb-2.5 h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(211,190,235,0.12)', borderWidth: 1, borderColor: 'rgba(211,190,235,0.28)' }}>
                <FontAwesome name="hand-paper-o" size={19} color={stitchMd3.primary} />
              </View>
              <Text className="font-space-grotesk text-[11px] font-semibold uppercase tracking-[0.12em] text-mist">Open hand</Text>
              <Text className="mt-1.5 font-inter text-[11px] leading-4 text-md-on-surface-variant">Fingers relaxed, palm flat</Text>
            </View>
            <View className="flex-1 rounded-2xl border border-white/12 bg-white/5 p-4">
              <View
                className="mb-2.5 h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(211,190,235,0.12)', borderWidth: 1, borderColor: 'rgba(211,190,235,0.28)' }}>
                <Ionicons name="scan-outline" size={21} color={stitchMd3.primary} />
              </View>
              <Text className="font-space-grotesk text-[11px] font-semibold uppercase tracking-[0.12em] text-mist">Fill the frame</Text>
              <Text className="mt-1.5 font-inter text-[11px] leading-4 text-md-on-surface-variant">Wrist to fingertips visible</Text>
            </View>
          </View>

          <View className="mt-auto gap-4 pt-6">
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
                  'Use natural daylight or a bright lamp. Keep your full palm inside the guide, and remove gloves or heavy rings so lines stay visible.',
                );
              }}
              className="items-center py-1">
              <Text className="font-space-grotesk text-[12px] uppercase tracking-[0.14em] text-mist/55">Tips for a better reading</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </CosmicScreen>
  );
}

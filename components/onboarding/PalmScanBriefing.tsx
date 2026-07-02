import { Ionicons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { HandToggleRow } from '@/components/onboarding/HandToggle';
import { PalmScanFrame } from '@/components/onboarding/PalmScanFrame';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { CosmicButton } from '@/components/primitives';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { PAGE_PADDING } from '@/constants/layout';
import { stitchMd3 } from '@/constants/stitchWelcome';
import { triggerLightTap } from '@/hooks/useHapticTap';
import type { PalmScanHand } from '@/store/sessionStore';

const SCAN_TIPS = [
  { icon: 'sunny-outline' as const, label: 'Good light' },
  { icon: 'hand-right-outline' as const, label: 'Open palm' },
  { icon: 'expand-outline' as const, label: 'Fill frame' },
];

type PalmScanBriefingProps = {
  primaryLabel: string;
  primaryIcon: 'camera' | 'image';
  onPrimaryPress: (hand: PalmScanHand) => void;
  hand: PalmScanHand | null;
  onHandChange?: (hand: PalmScanHand) => void;
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
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [selectedHand, setSelectedHand] = useState<PalmScanHand>(hand ?? 'right');

  useEffect(() => {
    if (hand) setSelectedHand(hand);
  }, [hand]);

  const frameSize = Math.min(272, Math.max(200, Math.round(windowHeight * 0.26)));

  const pickHand = (next: PalmScanHand) => {
    setSelectedHand(next);
    onHandChange?.(next);
  };

  return (
    <CosmicScreen>
      <View className="flex-1">
        <CosmicDotGrid />
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: PAGE_PADDING,
            paddingTop: 8,
            paddingBottom: 16,
          }}>
          <OnboardingHeader step={ONBOARDING_STEPS.palmScan} total={ONBOARDING_TOTAL_STEPS} />

          <View className="mt-2 gap-2">
            <Text className="font-headline text-[28px] leading-[32px] tracking-tight text-on-surface">
              Scan your palm
            </Text>
            <Text className="font-body text-[15px] leading-6 text-on-surface-variant">
              Pick your hand, then open the camera or upload a photo.
            </Text>
          </View>

          <View className="my-5 items-center">
            <View
              className="items-center justify-center rounded-2xl border border-white/15 bg-black/25"
              style={{
                width: Math.min(frameSize + 12, 320),
                aspectRatio: 3 / 4,
              }}>
              <PalmScanFrame
                size={frameSize}
                hand={selectedHand}
                showScanLine={false}
                showInnerGuide
                cornerColor={stitchMd3.primary}
              />
            </View>
          </View>

          <HandToggleRow hand={selectedHand} onSelect={pickHand} />

          <View className="mt-4 flex-row justify-between gap-2">
            {SCAN_TIPS.map((tip) => (
              <View
                key={tip.label}
                className="flex-1 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-3">
                <Ionicons name={tip.icon} size={20} color={stitchMd3.primary} />
                <Text className="mt-2 text-center font-space-grotesk text-[10px] uppercase tracking-[0.1em] text-mist">
                  {tip.label}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <View
          className="gap-3 border-t border-white/10 bg-cosmic-void/90 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16), paddingHorizontal: PAGE_PADDING }}>
          {beforePrimary}
          <CosmicButton
            gradient="nebulaMd3"
            label={primaryLabel}
            icon={<FontAwesome name={primaryIcon} size={18} color={stitchMd3.onPrimary} />}
            onPress={() => onPrimaryPress(selectedHand)}
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
            <Text className="font-space-grotesk text-[12px] uppercase tracking-[0.14em] text-mist/55">
              More tips
            </Text>
          </Pressable>
        </View>
      </View>
    </CosmicScreen>
  );
}

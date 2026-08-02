import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { StickyActionBar, STICKY_ACTION_BAR_COMFORTABLE } from '@/components/layout/StickyActionBar';
import { HandToggleRow } from '@/components/onboarding/HandToggle';
import { PalmScanFrame } from '@/components/onboarding/PalmScanFrame';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { PalmScanCoachingTips } from '@/components/onboarding/PalmScanCoachingTips';
import { CosmicButton } from '@/components/primitives';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { PAGE_PADDING } from '@/constants/layout';
import { stitchMd3 } from '@/constants/stitchWelcome';
import { triggerLightTap } from '@/hooks/useHapticTap';
import type { Gender, PalmScanHand } from '@/store/sessionStore';
import {
  isPalmHandLockedByGender,
  palmHandForGender,
  palmHandGuidanceLabel,
} from '@/utils/palmHand';

type PalmScanBriefingProps = {
  primaryLabel: string;
  primaryIcon: 'camera' | 'image';
  onPrimaryPress: (hand: PalmScanHand) => void;
  hand: PalmScanHand | null;
  gender?: Gender | null;
  onHandChange?: (hand: PalmScanHand) => void;
  beforePrimary?: ReactNode;
};

export function PalmScanBriefing({
  primaryLabel,
  primaryIcon,
  onPrimaryPress,
  hand,
  gender,
  onHandChange,
  beforePrimary,
}: PalmScanBriefingProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const locked = isPalmHandLockedByGender(gender);
  const recommended = palmHandForGender(gender);
  const [selectedHand, setSelectedHand] = useState<PalmScanHand>(hand ?? recommended);

  useEffect(() => {
    if (locked) {
      setSelectedHand(recommended);
      return;
    }
    if (hand) setSelectedHand(hand);
  }, [hand, locked, recommended]);

  const frameSize = Math.min(272, Math.max(200, Math.round(windowHeight * 0.26)));

  const pickHand = (next: PalmScanHand) => {
    if (locked) return;
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
            paddingBottom: STICKY_ACTION_BAR_COMFORTABLE + insets.bottom,
          }}>
          <OnboardingHeader step={ONBOARDING_STEPS.palmScan} total={ONBOARDING_TOTAL_STEPS} />

          <View className="mt-2 gap-2">
            <Text className="font-headline text-[28px] leading-[32px] tracking-tight text-on-surface">
              Scan your palm
            </Text>
            <Text className="font-body text-[15px] leading-6 text-on-surface-variant">
              {locked
                ? `Use your ${recommended} hand for the clearest reading, then open the camera or upload a photo.`
                : 'Pick your hand, then open the camera or upload a photo.'}
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

          {locked ? (
            <View className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3.5">
              <Text className="font-label text-[11px] uppercase tracking-[0.12em] text-cyan">
                Hand for your reading
              </Text>
              <Text className="mt-1.5 font-headline-md text-[18px] text-on-surface">
                {palmHandGuidanceLabel(selectedHand, gender)}
              </Text>
            </View>
          ) : (
            <HandToggleRow hand={selectedHand} onSelect={pickHand} />
          )}

          <View className="mt-4">
            <PalmScanCoachingTips />
          </View>
        </ScrollView>

        <StickyActionBar contentStyle={{ gap: 12 }}>
          {beforePrimary}
          <CosmicButton
            gradient="nebulaMd3"
            label={primaryLabel}
            icon={<FontAwesome name={primaryIcon} size={18} color={stitchMd3.onPrimary} />}
            onPress={() => onPrimaryPress(selectedHand)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More tips for a better palm reading"
            onPress={() => {
              void triggerLightTap();
              Alert.alert(
                'Tips for a better reading',
                'Use natural daylight or a bright lamp. Keep your full palm inside the guide, and remove gloves or heavy rings so lines stay visible.',
              );
            }}
            className="items-center py-1">
            <Text className="font-label text-[12px] uppercase tracking-[0.14em] text-on-surface/55">
              More tips
            </Text>
          </Pressable>
        </StickyActionBar>
      </View>
    </CosmicScreen>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { StickyActionBar, STICKY_ACTION_BAR_SINGLE } from '@/components/layout/StickyActionBar';
import { DecorativePalmArt } from '@/components/onboarding/DecorativePalmArt';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { CosmicButton } from '@/components/primitives';
import { colors } from '@/constants/theme';
import { deferRouterPush } from '@/utils/routerDefer';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { PAGE_PADDING } from '@/constants/layout';

/** Stitch "Trust" beat - intro before profile capture (not the live palm scan step). */
export default function TrustOnboardingScreen() {
  const insets = useSafeAreaInsets();

  return (
    <CosmicScreen>
      <View className="flex-1 overflow-hidden">
        <CosmicDotGrid />
        <View
          className="flex-1"
          style={{
            paddingHorizontal: PAGE_PADDING,
            paddingTop: 8,
            paddingBottom: insets.bottom + STICKY_ACTION_BAR_SINGLE,
          }}>
          <OnboardingHeader step={ONBOARDING_STEPS.trust} total={ONBOARDING_TOTAL_STEPS} />

          <View className="flex-1 justify-between gap-5 pt-1">
            <View className="gap-5">
              <View
                className="w-full max-w-sm self-center overflow-hidden rounded-3xl border border-white/12 bg-black/35"
                style={{ height: 148 }}>
                <DecorativePalmArt
                  opacity={1}
                  resizeMode="cover"
                  imageStyle={{ transform: [{ scale: 1.04 }] }}
                  style={{ width: '100%', height: '100%' }}
                />
                <View className="absolute inset-0" style={{ backgroundColor: 'rgba(5,4,12,0.08)' }} />
                <View
                  className="absolute bottom-3 right-3"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants">
                  <View
                    className="h-10 w-10 items-center justify-center rounded-full border border-white/15"
                    style={{ backgroundColor: 'rgba(10,10,20,0.54)' }}>
                    <Ionicons name="sparkles" size={20} color={colors.primary} />
                  </View>
                </View>
              </View>

              <View className="items-center gap-3 px-1">
                <Text className="text-center font-headline text-[28px] leading-9 tracking-tight text-on-surface">
                  Palm reading, made for today.
                </Text>
                <Text className="max-w-md text-center font-body text-[15px] leading-6 text-on-surface-variant">
                  We read your palm lines and goals to build a report that fits you.
                </Text>
              </View>
            </View>

            <View className="gap-3">
              <View className="flex-row items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <View className="h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary-container">
                  <Ionicons name="lock-closed" size={20} color={colors.primary} />
                </View>
                <View className="min-w-0 flex-1 pt-0.5">
                  <Text className="font-label text-[11px] uppercase leading-4 tracking-[0.12em] text-on-surface">
                    Privacy first
                  </Text>
                  <Text className="mt-1.5 font-body text-[14px] leading-5 text-on-surface-variant">
                    Your palm photo is encrypted and never shared.
                  </Text>
                </View>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1 items-start rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <View className="h-9 w-9 items-center justify-center rounded-full border border-tertiary/30 bg-primary-container/75">
                    <Ionicons name="hand-left-outline" size={18} color={colors.tertiary} />
                  </View>
                  <Text className="mt-3 font-label text-[11px] uppercase leading-4 tracking-[0.12em] text-on-surface">
                    Detailed reading
                  </Text>
                </View>
                <View className="flex-1 items-start rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <View className="h-9 w-9 items-center justify-center rounded-full border border-on-secondary-container/30 bg-primary-container/75">
                    <Ionicons name="sparkles-outline" size={18} color={colors.onSecondaryContainer} />
                  </View>
                  <Text className="mt-3 font-label text-[11px] uppercase leading-4 tracking-[0.12em] text-on-surface">
                    Daily guidance
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <StickyActionBar>
          <CosmicButton gradient="nebulaMd3" label="Continue" onPress={() => deferRouterPush('/onboarding/profile')} />
        </StickyActionBar>
      </View>
    </CosmicScreen>
  );
}

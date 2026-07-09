import { Ionicons } from '@expo/vector-icons';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { StickyActionBar, STICKY_ACTION_BAR_SINGLE } from '@/components/layout/StickyActionBar';
import { DecorativePalmArt } from '@/components/onboarding/DecorativePalmArt';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { CosmicButton } from '@/components/primitives';
import { deferRouterPush } from '@/utils/routerDefer';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { PAGE_PADDING } from '@/constants/layout';
import { stitchMd3 } from '@/constants/stitchWelcome';

/** Stitch "Trust" beat - intro before profile capture (not the live palm scan step). */
export default function TrustOnboardingScreen() {
  const insets = useSafeAreaInsets();

  return (
    <CosmicScreen>
      <View className="flex-1">
        <CosmicDotGrid />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: PAGE_PADDING,
            paddingBottom: insets.bottom + STICKY_ACTION_BAR_SINGLE,
            paddingTop: 8,
          }}
          keyboardShouldPersistTaps="handled">
          <OnboardingHeader step={ONBOARDING_STEPS.trust} total={ONBOARDING_TOTAL_STEPS} />

          <View
            className="mb-8 mt-2 w-full max-w-sm self-center overflow-hidden rounded-3xl border border-white/12 bg-black/35"
            style={{ aspectRatio: 4 / 3 }}>
            <DecorativePalmArt
              opacity={1}
              resizeMode="cover"
              imageStyle={{ transform: [{ scale: 1.04 }] }}
              style={{ width: '100%', height: '100%' }}
            />
            <View className="absolute inset-0" style={{ backgroundColor: 'rgba(5,4,12,0.08)' }} />
            <View className="absolute bottom-4 right-4">
              <View
                className="h-12 w-12 items-center justify-center rounded-full border border-white/15"
                style={{ backgroundColor: 'rgba(10,10,20,0.54)' }}>
                <Ionicons name="sparkles" size={22} color={stitchMd3.primary} />
              </View>
            </View>
          </View>

          <View className="mb-10 items-center gap-4 px-1">
            <Text className="text-center font-headline text-[30px] leading-[34px] tracking-tight text-on-surface">
              Palm reading, made for today.
            </Text>
            <Text className="max-w-md text-center font-body text-[15px] leading-6 text-on-surface-variant">
              We read your palm lines and the goals you share to build a report that fits you.
            </Text>
          </View>

          <View className="mb-10 gap-3">
            <View className="flex-row items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <View
                className="h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: '#1a0b2e', borderWidth: 1, borderColor: 'rgba(211,190,235,0.25)' }}>
                <Ionicons name="lock-closed" size={22} color={stitchMd3.primary} />
              </View>
              <View className="min-w-0 flex-1 pt-0.5">
                <Text className="font-label text-[12px] uppercase tracking-[0.12em] text-on-surface">
                  Privacy first
                </Text>
                <Text className="mt-2 font-body text-[13px] leading-5 text-on-surface-variant">
                  Your palm photo is encrypted and never shared.
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="min-h-[124px] flex-1 justify-between rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <View
                  className="h-11 w-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: 'rgba(26,11,46,0.75)', borderWidth: 1, borderColor: 'rgba(219,195,159,0.28)' }}>
                  <Ionicons name="hand-left-outline" size={22} color="#dbc39f" />
                </View>
                <Text className="font-label text-[12px] uppercase leading-4 tracking-[0.12em] text-on-surface">
                  Detailed palm reading
                </Text>
              </View>
              <View className="min-h-[124px] flex-1 justify-between rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <View
                  className="h-11 w-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: 'rgba(26,11,46,0.75)', borderWidth: 1, borderColor: 'rgba(192,179,207,0.28)' }}>
                  <Ionicons name="sparkles-outline" size={22} color="#c0b3cf" />
                </View>
                <Text className="font-label text-[12px] uppercase leading-4 tracking-[0.12em] text-on-surface">
                  Daily guidance
                </Text>
              </View>
            </View>
          </View>

        </ScrollView>

        <StickyActionBar>
          <CosmicButton gradient="nebulaMd3" label="Continue" onPress={() => deferRouterPush('/onboarding/profile')} />
        </StickyActionBar>
      </View>
    </CosmicScreen>
  );
}

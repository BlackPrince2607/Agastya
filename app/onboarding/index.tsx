import { Ionicons } from '@expo/vector-icons';
import { Image, ScrollView, Text, View } from 'react-native';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { CosmicButton } from '@/components/primitives';
import { deferRouterPush } from '@/utils/routerDefer';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { PAGE_PADDING } from '@/constants/layout';
import { stitchMd3, STITCH_PALM_ART_URI } from '@/constants/stitchWelcome';

/** Stitch “Trust” beat — intro before profile capture (not the live palm scan step). */
export default function TrustOnboardingScreen() {
  return (
    <CosmicScreen>
      <View className="flex-1">
        <CosmicDotGrid />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: PAGE_PADDING, paddingBottom: 112, paddingTop: 8 }}
          keyboardShouldPersistTaps="handled">
          <OnboardingHeader step={ONBOARDING_STEPS.trust} total={ONBOARDING_TOTAL_STEPS} />

          <View
            className="mb-8 mt-2 w-full max-w-sm items-center justify-center self-center overflow-hidden rounded-2xl border border-white/10 bg-black/25"
            style={{ aspectRatio: 1 }}>
            <Image
              accessibilityIgnoresInvertColors
              source={{ uri: STITCH_PALM_ART_URI }}
              className="h-full w-full"
              resizeMode="cover"
              style={{ opacity: 0.55 }}
            />
            <View className="absolute inset-0 items-center justify-center">
              <View
                className="h-16 w-16 items-center justify-center rounded-full border border-white/15"
                style={{ backgroundColor: 'rgba(211,190,235,0.12)' }}>
                <Ionicons name="sparkles" size={28} color={stitchMd3.primary} />
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
            <View className="flex-row gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <View
                className="h-11 w-11 items-center justify-center rounded-full"
                style={{ backgroundColor: '#1a0b2e', borderWidth: 1, borderColor: 'rgba(211,190,235,0.25)' }}>
                <Ionicons name="lock-closed" size={22} color={stitchMd3.primary} />
              </View>
              <View className="flex-1">
                <Text className="font-label text-[12px] uppercase tracking-[0.12em] text-on-surface">
                  Privacy first
                </Text>
                <Text className="mt-2 font-body text-[13px] leading-5 text-on-surface-variant">
                  Your palm photo is encrypted and never shared.
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="min-h-[120px] flex-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <Ionicons name="hand-left-outline" size={24} color="#dbc39f" />
                <Text className="font-label text-[12px] uppercase leading-tight tracking-[0.12em] text-on-surface">
                  Detailed palm reading
                </Text>
              </View>
              <View className="min-h-[120px] flex-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <Ionicons name="sparkles-outline" size={24} color="#c0b3cf" />
                <Text className="font-label text-[12px] uppercase tracking-[0.12em] text-on-surface">
                  Daily guidance
                </Text>
              </View>
            </View>
          </View>

          <View className="gap-4">
            <CosmicButton
              gradient="nebulaMd3"
              label="Continue"
              onPress={() => deferRouterPush('/onboarding/profile')}
            />
          </View>
        </ScrollView>
      </View>
    </CosmicScreen>
  );
}

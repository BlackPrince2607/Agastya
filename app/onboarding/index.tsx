import { Ionicons } from '@expo/vector-icons';
import { Image, ScrollView, Text, View } from 'react-native';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { StitchOnboardingHeader } from '@/components/onboarding/StitchOnboardingHeader';
import { CosmicButton } from '@/components/primitives';
import { deferRouterPush } from '@/utils/routerDefer';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { STITCH_TRUST_PALM_URI, stitchMd3 } from '@/constants/stitchWelcome';

/** Stitch “Trust” beat — MD3 glass cards + palm hero before profile capture */
export default function TrustOnboardingScreen() {
  return (
    <CosmicScreen>
      <View className="flex-1">
        <CosmicDotGrid />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28, paddingBottom: 112, paddingTop: 8 }}
          keyboardShouldPersistTaps="handled">
          <StitchOnboardingHeader ritualStep={{ current: ONBOARDING_STEPS.trust, total: ONBOARDING_TOTAL_STEPS }} />

          <View
            className="mb-8 mt-2 w-full max-w-sm self-center overflow-hidden rounded-2xl border border-white/10"
            style={{ aspectRatio: 1 }}>
            <Image
              accessibilityIgnoresInvertColors
              source={{ uri: STITCH_TRUST_PALM_URI }}
              className="h-full w-full"
              resizeMode="contain"
              style={{ opacity: 0.92 }}
            />
          </View>

          <View className="mb-10 items-center gap-4 px-1">
            <Text className="text-center font-noto-serif text-[34px] leading-[38px] tracking-tight text-mist">
              Guided by AI, rooted in tradition.
            </Text>
            <Text className="max-w-md text-center font-inter text-[17px] leading-7 text-md-on-surface-variant">
              We analyze your palm lines and behavioral patterns to provide personalized life guidance.
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
                <Text className="font-space-grotesk text-[12px] font-semibold uppercase tracking-[0.14em] text-mist">
                  Privacy first
                </Text>
                <Text className="mt-2 font-inter text-[13px] leading-5 text-md-on-surface-variant">
                  Biometric data is encrypted and never shared.
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="min-h-[120px] flex-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <Ionicons name="pulse" size={24} color="#dbc39f" />
                <Text className="font-space-grotesk text-[12px] font-semibold uppercase leading-tight tracking-[0.08em] text-mist">
                  Advanced neural scanning
                </Text>
              </View>
              <View className="min-h-[120px] flex-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <Ionicons name="analytics" size={24} color="#c0b3cf" />
                <Text className="font-space-grotesk text-[12px] font-semibold uppercase leading-tight tracking-[0.08em] text-mist">
                  Pattern-first palm read
                </Text>
              </View>
            </View>
          </View>

          <View className="gap-4">
            <CosmicButton
              gradient="nebulaMd3"
              label="CONTINUE"
              onPress={() => deferRouterPush('/onboarding/profile')}
            />
            <Text className="text-center font-inter text-[11px] uppercase tracking-[0.22em] text-md-on-primary-container">
              Step {ONBOARDING_STEPS.trust} of {ONBOARDING_TOTAL_STEPS}
            </Text>
          </View>
        </ScrollView>
      </View>
    </CosmicScreen>
  );
}

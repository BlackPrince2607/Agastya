import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MotiView } from 'moti';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { BlurContainer, CosmicButton } from '@/components/primitives';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { stitchMd3 } from '@/constants/stitchWelcome';
import { stitchSignal } from '@/constants/theme';
import { track } from '@/services/analytics';
import { unlockPremiumFromStore, finalizeStripeCheckout } from '@/services/premiumUnlock';
import { isPremiumBypassEnabled, isRevenueCatConfigured, isStripeCheckoutEnabled, isWebPremiumUnlockAvailable } from '@/services/revenuecat';
import { isWebDemoMode } from '@/utils/webDemo';
import { useSessionStore } from '@/store/sessionStore';

const TRUST_HIGHLIGHTS = [
  'Personalized palm insights tied to your focus areas',
  'Unlimited Guide conversations when you need clarity',
  'Full compatibility breakdowns and report chapters',
];

const FEATURES = [
  {
    icon: 'sparkles' as const,
    title: 'Your full palm report',
    body: 'The complete reading across love, career, money, and growth.',
  },
  {
    icon: 'heart-outline' as const,
    title: 'Compatibility insights',
    body: 'See how you connect with someone across emotion, trust, and values.',
  },
  {
    icon: 'chatbubble-ellipses-outline' as const,
    title: 'Unlimited Guide',
    body: 'Ask your Guide anything, anytime—answers personalized to your reading.',
  },
  {
    icon: 'checkmark-done-outline' as const,
    title: 'Daily guidance',
    body: 'Small, personalized actions to keep your momentum going each day.',
  },
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { seed, checkout } = useLocalSearchParams<{ seed?: string; checkout?: string }>();
  const period = useSessionStore((s) => s.billingPeriod);
  const setPeriod = useSessionStore((s) => s.setBillingPeriod);
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    track('paywall_viewed');
  }, []);

  const mergedSeed = seed ?? useSessionStore.getState().readingSeed ?? 'stillness';

  useEffect(() => {
    if (checkout !== 'success') return;
    let cancelled = false;
    setBusy(true);
    void (async () => {
      const result = await finalizeStripeCheckout(mergedSeed);
      if (cancelled) return;
      if (result.ok) {
        track('paywall_unlock_success', { source: result.source });
        Alert.alert('Welcome to full access', 'Your subscription is active. Sign in to enter the app.', [
          { text: 'Sign in', onPress: goToAccountSync },
        ]);
      } else {
        Alert.alert(
          'Verifying subscription',
          'Payment received — premium may take a moment to activate. Try again shortly.',
        );
      }
      setBusy(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [checkout, mergedSeed]);

  const goToAccountSync = () => {
    router.push({
      pathname: '/onboarding/account',
      params: { seed: mergedSeed, fromPaywall: '1' },
    });
  };

  const handleSubscribe = async () => {
    if (busy) return;
    setBusy(true);
    track('paywall_primary_cta');

    try {
      const result = await unlockPremiumFromStore({ mode: 'purchase', seed: mergedSeed });

      if (!result.ok) {
        if (result.reason === 'unavailable') {
          Alert.alert(
            'Subscriptions unavailable',
            'Purchases aren’t available right now. Sign in to save your preview, or tap Restore if you already subscribed.',
          );
        } else if (result.reason === 'not_entitled') {
          Alert.alert('Purchase incomplete', 'We could not verify your subscription. Try Restore purchases or contact support.');
        }
        return;
      }

      if (result.source === 'stripe') {
        return;
      }

      track('paywall_unlock_success', { source: result.source });
      Alert.alert(
        'Welcome to full access',
        'Your full reading is unlocked. Sign in to save it across devices and enter the app.',
        [
          {
            text: 'Sign in',
            onPress: goToAccountSync,
          },
        ],
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await unlockPremiumFromStore({ mode: 'restore', seed: mergedSeed });
      if (result.ok) {
        Alert.alert('Restored', 'Your subscription is active again. Sign in to enter the app.', [
          { text: 'Sign in', onPress: goToAccountSync },
        ]);
      } else {
        Alert.alert('No subscription found', 'We could not find an active plan for this store account.');
      }
    } finally {
      setBusy(false);
    }
  };

  const backToPreview = () => {
    router.replace('/onboarding/report-preview');
  };

  return (
    <CosmicScreen variant="stitch">
      <View className="flex-1">
        <CosmicDotGrid />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 8,
            paddingBottom: 280 + insets.bottom,
            gap: 22,
          }}>
          <OnboardingHeader step={ONBOARDING_STEPS.paywall} total={ONBOARDING_TOTAL_STEPS} />

          <View>
            <Text className="font-space-grotesk text-[11px] font-semibold uppercase tracking-[0.38em] text-md-on-primary-container">
              Step {ONBOARDING_STEPS.paywall} of {ONBOARDING_TOTAL_STEPS}
            </Text>
            <Text className="mt-4 font-noto-serif text-[32px] leading-[40px] tracking-tight text-mist">
              Unlock your full reading
            </Text>
            <Text className="mt-4 font-inter text-[15px] leading-6 text-md-on-surface-variant">
              Get your complete palm report, daily guidance, and unlimited conversations with Agastya.
            </Text>
            {premium ? (
              <View className="mt-4 rounded-2xl border border-stitch-signal/35 bg-stitch-signal/10 px-4 py-3">
                <Text className="font-inter text-[14px] text-stitch-signal">You already have full access on this device.</Text>
              </View>
            ) : null}
            {isWebPremiumUnlockAvailable() ? (
              <Text className="mt-3 font-inter text-[13px] leading-5 text-stitch-signal">
                {isWebDemoMode()
                  ? 'Web demo — tap below to unlock the full experience without a real purchase.'
                  : isStripeCheckoutEnabled()
                    ? 'Subscribe securely with Stripe — billed on the web, synced to your account.'
                    : 'On web, tap below to unlock the full experience — no app-store purchase required.'}
              </Text>
            ) : null}
            {Platform.OS !== 'web' && !isRevenueCatConfigured() && !isPremiumBypassEnabled() ? (
              <Text className="mt-3 font-inter text-[13px] leading-5 text-md-on-surface-variant">
                Subscriptions aren’t available in this version yet. You can continue with the free preview from the previous
                screen.
              </Text>
            ) : null}
          </View>

          <View className="gap-2 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-4">
            {TRUST_HIGHLIGHTS.map((line) => (
              <View key={line} className="flex-row gap-3 py-1">
                <Ionicons name="checkmark-circle" size={18} color={stitchSignal} />
                <Text className="flex-1 font-inter text-[14px] leading-5 text-mist/90">{line}</Text>
              </View>
            ))}
          </View>

          <LinearGradient
            colors={['rgba(211,190,235,0.14)', 'rgba(20,19,21,0.92)', 'rgba(0,206,209,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="gap-5 rounded-3xl border border-white/14 p-5">
            {FEATURES.map((f) => (
              <View key={f.title} className="flex-row gap-4">
                <View className="h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-black/40">
                  <Ionicons name={f.icon} size={20} color={stitchMd3.primary} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="font-space-grotesk text-[15px] font-semibold text-mist">{f.title}</Text>
                  <Text className="mt-1 font-inter text-[13px] leading-5 text-md-on-surface-variant">{f.body}</Text>
                </View>
              </View>
            ))}
          </LinearGradient>

          <View className="gap-3">
            <PlanRow
              label="Yearly Access"
              badge="Most popular"
              price="$59.99/year"
              sub="only $4.99/mo"
              tag="Save 50%"
              active={period === 'annual'}
              onPress={() => setPeriod('annual')}
            />
            <PlanRow
              label="Monthly Access"
              price="$9.99/month"
              active={period === 'monthly'}
              onPress={() => setPeriod('monthly')}
            />
          </View>

          <View className="items-center gap-2 py-2">
            <Text className="font-space-grotesk text-[20px] font-bold tracking-wide text-mist">7-Day FREE Trial</Text>
            <Text className="font-inter text-[13px] text-md-on-surface-variant">Risk-free · Cancel anytime</Text>
          </View>

          <Pressable onPress={() => void handleRestore()} disabled={busy} className="items-center py-2 active:opacity-80">
            <Text className="font-inter text-[14px] font-medium text-stitch-signal underline">Restore purchases</Text>
          </Pressable>
        </ScrollView>

        <BlurContainer
          intensity={56}
          className="absolute bottom-0 left-0 right-0 z-20 rounded-none border-t border-white/14 bg-[#0f0e10]/94 px-6 pt-4"
          style={{ elevation: 24 }}>
          <View style={{ paddingBottom: Math.max(insets.bottom, 16) }} className="gap-y-2.5">
            {premium ? (
              <CosmicButton gradient="nebulaMd3" label="Sign in to enter" onPress={goToAccountSync} />
            ) : (
              <MotiView
                from={{ scale: 1 }}
                animate={{ scale: 1.02 }}
                transition={{ type: 'timing', duration: 1100, loop: true, repeatReverse: true }}>
                <CosmicButton
                  gradient="nebulaMd3"
                  label={
                    busy
                      ? 'Processing…'
                      : isStripeCheckoutEnabled()
                        ? 'Subscribe with Stripe'
                        : isWebPremiumUnlockAvailable()
                          ? 'Unlock full access'
                          : 'Start 7-Day Free Trial'
                  }
                  onPress={() => void handleSubscribe()}
                />
              </MotiView>
            )}
            <CosmicButton variant="ghost" label="Back to preview" onPress={backToPreview} />
            <CosmicButton variant="ghost" label="Save & sign in" onPress={goToAccountSync} />
            <View className="mt-1 flex-row items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5">
              <Ionicons name="shield-checkmark" size={16} color="#4ade80" />
              <Text className="font-inter text-[12px] text-mist/85">Cancel anytime · Restore from Profile</Text>
            </View>
          </View>
        </BlurContainer>
      </View>
    </CosmicScreen>
  );
}

function PlanRow({
  label,
  badge,
  price,
  sub,
  tag,
  active,
  onPress,
}: {
  label: string;
  badge?: string;
  price: string;
  sub?: string;
  tag?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <View
        className={
          active
            ? 'rounded-3xl border border-stitch-violet/55 bg-stitch-violet/10 px-5 py-4'
            : 'rounded-3xl border border-white/12 bg-black/35 px-5 py-4'
        }
        style={active ? { shadowColor: stitchSignal, shadowOpacity: 0.25, shadowRadius: 12 } : undefined}>
        {badge ? (
          <View className="mb-3 self-start rounded-full border border-stitch-violet/40 bg-stitch-violet/20 px-3 py-1">
            <Text className="font-space-grotesk text-[9px] font-bold uppercase tracking-[0.22em] text-stitch-signal">
              {badge}
            </Text>
          </View>
        ) : null}
        <View className="flex-row items-center gap-3">
          <View
            className={`h-5 w-5 rounded-full border-2 ${active ? 'border-stitch-signal bg-stitch-signal/30' : 'border-white/25'}`}
          />
          <View className="min-w-0 flex-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="font-space-grotesk text-[17px] font-semibold text-mist">{label}</Text>
              {tag ? (
                <View className="rounded-md bg-stitch-violet/25 px-2 py-0.5">
                  <Text className="font-space-grotesk text-[10px] font-bold uppercase tracking-wide text-stitch-signal">
                    {tag}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text className="mt-1 font-inter text-[14px] text-md-on-surface-variant">
              {price}
              {sub ? <Text className="text-md-on-primary-container"> ({sub})</Text> : null}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, usePathname, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MotiView } from 'moti';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { BlurContainer, CosmicButton } from '@/components/primitives';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { stitchMd3 } from '@/constants/stitchWelcome';
import { stitchSignal } from '@/constants/theme';
import { AnalyticsEvent, track, trackOnce } from '@/services/analytics';
import { getBillingConfig } from '@/services/billing/billingService';
import type { BillingConfig } from '@/services/billing/billingService';
import { isPlayUserChoiceAvailable } from '@/services/billing/playUserChoice';
import {
  unlockPremium,
  checkPremiumStatus,
  finalizeRazorpayCheckout,
} from '@/services/premiumUnlock';
import { useSessionStore } from '@/store/sessionStore';
import { enterMainApp } from '@/utils/navigationFlow';
import { goBack, normalizeRouteParams } from '@/utils/navigationBack';
import { hasPremiumAccess } from '@/utils/premiumAccess';

const TRUST_HIGHLIGHTS = [
  'Full Life Blueprint chapters grounded in your palm scan',
  'Unlimited Agastya chat about your Blueprint and journey',
  'Longer-range forecasts and compatibility insights',
];

const FEATURES = [
  {
    icon: 'sparkles' as const,
    title: 'Your full palm report',
    body: 'Deeper chapters across love, career, money, and growth — citing your measured lines.',
  },
  {
    icon: 'heart-outline' as const,
    title: 'Compatibility insights',
    body: 'See how you connect with someone across emotion, trust, and values.',
  },
  {
    icon: 'chatbubble-ellipses-outline' as const,
    title: 'Unlimited Guide',
    body: 'Ask your Guide anything. Answers are based on your reading.',
  },
  {
    icon: 'checkmark-done-outline' as const,
    title: 'Daily guidance',
    body: 'Small daily actions to keep your momentum going.',
  },
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const segments = useSegments();
  const searchParams = useLocalSearchParams<{
    seed?: string;
    checkout?: string;
    provider?: string;
    returnTo?: string;
  }>();
  const { seed, checkout, returnTo } = searchParams;
  const routeParams = normalizeRouteParams(searchParams);
  const period = useSessionStore((s) => s.billingPeriod);
  const setPeriod = useSessionStore((s) => s.setBillingPeriod);
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const [busy, setBusy] = useState(false);
  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(null);

  const testBypass =
    (process.env.EXPO_PUBLIC_BILLING_RAZORPAY_TEST_BYPASS || '').trim() === 'true';
  const billingAvailable =
    Platform.OS === 'android' && (testBypass || isPlayUserChoiceAvailable());

  useEffect(() => {
    trackOnce('paywall_viewed', AnalyticsEvent.PAYWALL_VIEWED);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const config = await getBillingConfig();
      if (!cancelled) setBillingConfig(config);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mergedSeed = seed ?? useSessionStore.getState().readingSeed ?? 'stillness';

  const formatPlanPrice = (key: 'monthly' | 'annual', fallback: string) => {
    const plan = billingConfig?.plans?.[key];
    if (!plan) return fallback;
    const major = plan.amount / 100;
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: plan.currency,
        maximumFractionDigits: plan.currency === 'INR' ? 0 : 2,
      }).format(major);
    } catch {
      return `${plan.currency} ${major}`;
    }
  };

  const subscribeLabel = () => {
    if (busy) return 'Processing...';
    return 'Unlock Premium';
  };

  useEffect(() => {
    if (checkout === 'cancelled') {
      Alert.alert('Checkout cancelled', 'No charge was completed. You can try again when ready.');
      return;
    }
    if (checkout !== 'success') return;
    let cancelled = false;
    setBusy(true);
    void (async () => {
      const result = await finalizeRazorpayCheckout(mergedSeed);
      if (cancelled) return;
      if (result.ok) {
        goToAccountSync();
      } else {
        Alert.alert(
          'Purchase pending',
          result.reason === 'report_failed'
            ? 'Payment may have succeeded, but we could not load your full report yet. Try checking subscription status or sign in again.'
            : 'We could not confirm your payment yet. Wait a moment and tap Check subscription status, or contact support if this continues.',
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

  const unlockFailureMessage = (reason: string) => {
    switch (reason) {
      case 'cancelled':
        return 'Purchase was cancelled.';
      case 'unavailable':
        return 'Billing is not available on this device. Use a production Android build enrolled in Google Play User Choice.';
      case 'not_entitled':
        return 'No active subscription was found for this account.';
      case 'report_failed':
        return 'Purchase succeeded, but we could not generate your full report. Please try again.';
      default:
        return 'Something went wrong. Please try again.';
    }
  };

  const handleSubscribe = async () => {
    if (busy) return;
    setBusy(true);
    track(AnalyticsEvent.PURCHASE_STARTED, { billing_period: period });

    try {
      const result = await unlockPremium({ seed: mergedSeed });

      if (!result.ok) {
        if (result.reason !== 'cancelled') {
          Alert.alert('Could not unlock Premium', unlockFailureMessage(result.reason));
        }
        return;
      }

      if (result.source === 'razorpay') {
        return;
      }

      goToAccountSync();
    } finally {
      setBusy(false);
    }
  };

  const handleCheckStatus = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await checkPremiumStatus({ seed: mergedSeed });
      if (result.ok) {
        goToAccountSync();
      } else if (result.reason !== 'cancelled') {
        Alert.alert('No subscription found', unlockFailureMessage(result.reason));
      }
    } finally {
      setBusy(false);
    }
  };

  const backFromPaywall = () => {
    goBack({ pathname, segments: [...segments], params: routeParams });
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
            paddingBottom: 320 + insets.bottom,
            gap: 22,
          }}>
          <OnboardingHeader step={ONBOARDING_STEPS.paywall} total={ONBOARDING_TOTAL_STEPS} />

          <View>
            <Text className="font-headline text-[30px] leading-9 tracking-tight text-on-surface">
              Unlock your full Life Blueprint
            </Text>
            <Text className="mt-4 font-body text-[15px] leading-6 text-on-surface-variant">
              Deeper dossier chapters grounded in your palm scan, longer-range forecasts, unlimited chat, and daily
              rituals. Today&apos;s guidance stays free.
            </Text>
            {premium ? (
              <View className="mt-4 rounded-2xl border border-cyan/35 bg-cyan/10 px-4 py-3">
                <Text className="font-body text-[14px] text-cyan">You already have full access on this device.</Text>
              </View>
            ) : null}
            {billingAvailable ? (
              <Text className="mt-3 font-body text-[13px] leading-5 text-cyan">
                {testBypass
                  ? 'Test mode — Razorpay checkout opens without Play User Choice.'
                  : 'Google Play will show a secure payment choice — UPI/cards via Razorpay or Google Play billing.'}
              </Text>
            ) : !billingAvailable && Platform.OS === 'android' ? (
              <Text className="mt-3 font-body text-[13px] leading-5 text-on-surface-variant">
                Premium unlock requires a production Android build with Google Play User Choice billing.
              </Text>
            ) : Platform.OS !== 'android' ? (
              <Text className="mt-3 font-body text-[13px] leading-5 text-on-surface-variant">
                Premium is available on Android (India). Continue with the free preview on this platform.
              </Text>
            ) : null}
          </View>

          <View className="gap-2 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-4">
            {TRUST_HIGHLIGHTS.map((line) => (
              <View key={line} className="flex-row items-start gap-3 py-1">
                <Ionicons name="checkmark-circle" size={18} color={stitchSignal} style={{ marginTop: 2 }} />
                <Text className="flex-1 font-body text-[14px] leading-6 text-on-surface/90">{line}</Text>
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
                <View className="h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-black/40">
                  <Ionicons name={f.icon} size={20} color={stitchMd3.primary} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="font-label text-[15px] font-semibold leading-6 text-on-surface">{f.title}</Text>
                  <Text className="mt-1 shrink font-body text-[13px] leading-5 text-on-surface-variant">{f.body}</Text>
                </View>
              </View>
            ))}
          </LinearGradient>

          <View className="gap-3">
            <PlanRow
              label="Yearly Access"
              badge="Most popular"
              price={`${formatPlanPrice('annual', '₹4,999')}/year`}
              tag="Save 50%"
              active={period === 'annual'}
              onPress={() => setPeriod('annual')}
            />
            <PlanRow
              label="Monthly Access"
              price={`${formatPlanPrice('monthly', '₹799')}/month`}
              active={period === 'monthly'}
              onPress={() => setPeriod('monthly')}
            />
          </View>

          <View className="items-center gap-2 py-2">
            <Text className="font-body text-[13px] text-on-surface-variant text-center">
              Period access after payment. Check subscription status if the app was closed during checkout.
            </Text>
          </View>

          <Pressable onPress={() => void handleCheckStatus()} disabled={busy} className="items-center py-2 active:opacity-80">
            <Text className="font-body text-[14px] font-medium text-cyan underline">Check subscription status</Text>
          </Pressable>
        </ScrollView>

        <BlurContainer
          intensity={56}
          className="absolute bottom-0 left-0 right-0 z-20 rounded-none border-t border-white/14 bg-[#0f0e10]/94 px-6 pt-4"
          style={{ elevation: 24 }}>
          <View style={{ paddingBottom: Math.max(insets.bottom, 16) }} className="gap-y-3.5">
            {premium ? (
              <CosmicButton
                gradient="nebulaMd3"
                label="Enter Agastya"
                onPress={() => (hasPremiumAccess() ? enterMainApp() : goToAccountSync())}
              />
            ) : (
              <MotiView
                from={{ scale: 1 }}
                animate={{ scale: 1.02 }}
                transition={{ type: 'timing', duration: 1100, loop: true, repeatReverse: true }}>
                <CosmicButton
                  gradient="nebulaMd3"
                  label={subscribeLabel()}
                  onPress={() => void handleSubscribe()}
                />
              </MotiView>
            )}
            <CosmicButton variant="ghost" label="Go back" onPress={backFromPaywall} />
            <CosmicButton variant="ghost" label="Save & sign in" onPress={goToAccountSync} />
            <View className="mt-1 flex-row items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5">
              <Ionicons name="shield-checkmark" size={16} color="#4ade80" />
              <Text className="font-body text-[12px] text-on-surface/85">Secure payment via Google Play or Razorpay.</Text>
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
            ? 'rounded-3xl border border-primary/55 bg-primary/10 px-5 py-4'
            : 'rounded-3xl border border-white/12 bg-black/35 px-5 py-4'
        }
        style={active ? { shadowColor: stitchSignal, shadowOpacity: 0.25, shadowRadius: 12 } : undefined}>
        {badge ? (
          <View className="mb-3 self-start rounded-full border border-primary/40 bg-primary/20 px-3 py-1">
            <Text className="font-label text-[9px] font-bold uppercase tracking-[0.22em] text-cyan">
              {badge}
            </Text>
          </View>
        ) : null}
        <View className="flex-row items-center gap-3">
          <View
            className={`h-5 w-5 rounded-full border-2 ${active ? 'border-cyan bg-cyan/30' : 'border-white/25'}`}
          />
          <View className="min-w-0 flex-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="font-label text-[17px] font-semibold text-on-surface">{label}</Text>
              {tag ? (
                <View className="rounded-md bg-primary/25 px-2 py-0.5">
                  <Text className="font-label text-[10px] font-bold uppercase tracking-wide text-cyan">
                    {tag}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text className="mt-1 font-body text-[14px] text-on-surface-variant">
              {price}
              {sub ? <Text className="text-on-primary-container"> ({sub})</Text> : null}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

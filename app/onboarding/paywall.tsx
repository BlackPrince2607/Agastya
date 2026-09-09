import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, usePathname, useSegments } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, Text, View, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MotiView } from 'moti';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { StickyActionBar, STICKY_ACTION_BAR_TALL } from '@/components/layout/StickyActionBar';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { CosmicButton } from '@/components/primitives';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { colors, stitchSignal } from '@/constants/theme';
import { AnalyticsEvent, track, trackOnce } from '@/services/analytics';
import {
  clearLastCheckoutIntentId,
  getBillingConfig,
  isCheckoutReturnPending,
} from '@/services/billing/billingService';
import type { BillingConfig } from '@/services/billing/billingService';
import { isPlayUserChoiceAvailable } from '@/services/billing/playUserChoice';
import {
  unlockPremium,
  checkPremiumStatus,
  finalizeRazorpayCheckout,
} from '@/services/premiumUnlock';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useSessionStore } from '@/store/sessionStore';
import { enterMainApp } from '@/utils/navigationFlow';
import { goBack, normalizeRouteParams } from '@/utils/navigationBack';
import { hasPremiumAccess } from '@/utils/premiumAccess';

const TRUST_HIGHLIGHTS = [
  'Full Life Blueprint chapters from your palm scan',
  'Unlimited Agastya chat about your reading',
  'Longer-range forecasts and compatibility insights',
];

/** Retries while Razorpay webhook / confirm API catch up after browser return. */
const MAX_RESUME_ATTEMPTS = 8;
const RESUME_COOLDOWN_MS = 3500;
const RESUME_POLL_MS = 4000;

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const segments = useSegments();
  const searchParams = useLocalSearchParams<{
    seed?: string;
    checkout?: string;
    provider?: string;
    returnTo?: string;
    razorpay_payment_id?: string;
    razorpay_payment_link_id?: string;
    razorpay_payment_link_reference_id?: string;
    razorpay_payment_link_status?: string;
    razorpay_signature?: string;
  }>();
  const {
    seed,
    checkout,
    razorpay_payment_id,
    razorpay_payment_link_id,
    razorpay_payment_link_reference_id,
    razorpay_payment_link_status,
    razorpay_signature,
  } = searchParams;
  const routeParams = normalizeRouteParams(searchParams);
  const period = useSessionStore((s) => s.billingPeriod);
  const setPeriod = useSessionStore((s) => s.setBillingPeriod);
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const storeUserId = useSessionStore((s) => s.supabaseUserId);
  const { isSignedIn, email: authEmail, loading: authLoading } = useAuthSession();
  const signedIn = Boolean(isSignedIn || storeUserId);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(null);
  const [awaitingCheckoutReturn, setAwaitingCheckoutReturn] = useState(false);
  const resumeInFlightRef = useRef(false);
  const enteredAfterUnlockRef = useRef(false);
  /** Auto-confirm attempts after returning from browser checkout. */
  const resumeAttemptsRef = useRef(0);
  const lastResumeAtRef = useRef(0);
  const afterUnlockRef = useRef<() => void>(() => {});
  const confirmOptsRef = useRef({
    paymentLinkId: razorpay_payment_link_id,
    paymentId: razorpay_payment_id,
    paymentLinkReferenceId: razorpay_payment_link_reference_id,
    paymentLinkStatus: razorpay_payment_link_status,
    razorpaySignature: razorpay_signature,
  });
  confirmOptsRef.current = {
    paymentLinkId: razorpay_payment_link_id,
    paymentId: razorpay_payment_id,
    paymentLinkReferenceId: razorpay_payment_link_reference_id,
    paymentLinkStatus: razorpay_payment_link_status,
    razorpaySignature: razorpay_signature,
  };

  const testBypass =
    (process.env.EXPO_PUBLIC_BILLING_RAZORPAY_TEST_BYPASS || '').trim() === 'true';
  const billingAvailable =
    Platform.OS === 'android' && (testBypass || isPlayUserChoiceAvailable());

  const mergedSeed = seed ?? useSessionStore.getState().readingSeed ?? 'stillness';

  const goToSignInForPaywall = () => {
    router.push({
      pathname: '/onboarding/account',
      params: { seed: mergedSeed, toPaywall: '1' },
    });
  };

  const afterUnlockSuccess = useCallback(() => {
    if (enteredAfterUnlockRef.current) return;
    enteredAfterUnlockRef.current = true;
    clearLastCheckoutIntentId();
    setAwaitingCheckoutReturn(false);
    setBusy(false);
    setBusyLabel(null);
    // Already signed in before payment — enter the app directly.
    if (signedIn || useSessionStore.getState().supabaseUserId) {
      enterMainApp();
      return;
    }
    router.push({
      pathname: '/onboarding/account',
      params: { seed: mergedSeed, fromPaywall: '1' },
    });
  }, [signedIn, mergedSeed]);

  afterUnlockRef.current = afterUnlockSuccess;

  useEffect(() => {
    trackOnce('paywall_viewed', AnalyticsEvent.PAYWALL_VIEWED);
  }, []);

  // Require sign-in before starting a new purchase (not while returning from Razorpay).
  useEffect(() => {
    if (authLoading) return;
    if (checkout === 'success' || checkout === 'cancelled') return;
    if (awaitingCheckoutReturn) return;
    if (signedIn) return;
    router.replace({
      pathname: '/onboarding/account',
      params: { seed: mergedSeed, toPaywall: '1' },
    });
  }, [authLoading, signedIn, checkout, mergedSeed, awaitingCheckoutReturn]);

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

  // Restore pending-checkout UX after process death / remount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (checkout === 'cancelled') return;
      if (!(await isCheckoutReturnPending())) return;
      if (cancelled) return;
      setAwaitingCheckoutReturn(true);
      setBusyLabel('Confirming payment...');
      setBusy(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [checkout]);

  // Never leave a paid user on the paywall — navigate as soon as premium flips.
  useEffect(() => {
    if (!premium && !hasPremiumAccess()) return;
    if (checkout === 'cancelled') return;
    if (!awaitingCheckoutReturn && checkout !== 'success') return;
    afterUnlockRef.current();
  }, [premium, awaitingCheckoutReturn, checkout]);

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

  const unlockLabel = () => {
    if (busy || awaitingCheckoutReturn) return busyLabel ?? 'Confirming payment...';
    if (!signedIn) return 'Sign in to unlock';
    return 'Unlock Premium';
  };

  const finishUnlockAttempt = useCallback(
    (result: Awaited<ReturnType<typeof finalizeRazorpayCheckout>>, { alertOnFail }: { alertOnFail: boolean }) => {
      // Payment may have granted premium even when report materialization lagged.
      if (result.ok || useSessionStore.getState().hasUnlockedPremium || hasPremiumAccess()) {
        afterUnlockRef.current();
        return true;
      }
      if (!alertOnFail) return false;
      Alert.alert(
        'Purchase pending',
        result.reason === 'report_failed'
          ? 'Payment may have succeeded, but we could not load your full report yet. Try checking premium status or sign in again.'
          : 'We could not confirm your payment yet. Wait a moment and tap Check premium status, or contact support if this continues.',
      );
      void import('@/services/notifications').then(({ notifyPushEvent }) => {
        void notifyPushEvent(
          'payment_pending',
          `pending:${useSessionStore.getState().sessionId ?? 'unknown'}`,
        );
      });
      return false;
    },
    [],
  );

  // Deep-link cancel, or mark success UX. Confirm runs only in the resume/poll effect below
  // so effect remounts cannot cancel navigation after premium is granted.
  useEffect(() => {
    if (checkout === 'cancelled') {
      clearLastCheckoutIntentId();
      resumeAttemptsRef.current = 0;
      setAwaitingCheckoutReturn(false);
      setBusy(false);
      setBusyLabel(null);
      Alert.alert('Checkout cancelled', 'No charge was completed. You can try again when ready.');
      return;
    }
    if (checkout !== 'success') return;
    resumeAttemptsRef.current = 0;
    lastResumeAtRef.current = 0;
    setAwaitingCheckoutReturn(true);
    setBusyLabel('Confirming payment...');
    setBusy(true);
  }, [checkout]);

  // Confirm on: deep link success, Android back without deep link, remount, and poll while pending.
  useEffect(() => {
    if (checkout === 'cancelled') return;

    const tryResumeAfterCheckout = async (bypassCooldown = false) => {
      if (enteredAfterUnlockRef.current) return;
      if (resumeInFlightRef.current) return;
      if (useSessionStore.getState().hasUnlockedPremium || hasPremiumAccess()) {
        afterUnlockRef.current();
        return;
      }

      const pending = checkout === 'success' || (await isCheckoutReturnPending());
      if (!pending) return;
      if (resumeAttemptsRef.current >= MAX_RESUME_ATTEMPTS) return;

      const now = Date.now();
      if (!bypassCooldown && now - lastResumeAtRef.current < RESUME_COOLDOWN_MS) return;
      lastResumeAtRef.current = now;

      resumeAttemptsRef.current += 1;
      resumeInFlightRef.current = true;
      setAwaitingCheckoutReturn(true);
      setBusyLabel('Confirming payment...');
      setBusy(true);
      try {
        const deepLinkOpts = checkout === 'success' ? confirmOptsRef.current : undefined;
        const result = await finalizeRazorpayCheckout(mergedSeed, deepLinkOpts);
        // Always navigate if premium was granted — even if this effect later cleans up.
        const unlocked = finishUnlockAttempt(result, {
          alertOnFail:
            !result.ok &&
            !useSessionStore.getState().hasUnlockedPremium &&
            resumeAttemptsRef.current >= MAX_RESUME_ATTEMPTS,
        });
        if (!unlocked && resumeAttemptsRef.current < MAX_RESUME_ATTEMPTS) {
          setBusyLabel('Confirming payment...');
          setBusy(true);
        } else if (!unlocked) {
          setBusy(false);
          setBusyLabel(null);
        }
      } finally {
        resumeInFlightRef.current = false;
      }
    };

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void tryResumeAfterCheckout(true);
      }
    });

    // Immediate attempt on mount / deep-link success / pending remount.
    void tryResumeAfterCheckout(true);

    // Poll while pending — Custom Tabs sometimes resume without a reliable AppState edge.
    const poll = setInterval(() => {
      if (enteredAfterUnlockRef.current) return;
      if (AppState.currentState !== 'active') return;
      void tryResumeAfterCheckout(false);
    }, RESUME_POLL_MS);

    return () => {
      sub.remove();
      clearInterval(poll);
    };
  }, [checkout, mergedSeed, finishUnlockAttempt]);

  const unlockFailureMessage = (reason: string) => {
    switch (reason) {
      case 'cancelled':
        return 'Purchase was cancelled.';
      case 'need_sign_in':
        return 'Sign in with your email first so we can unlock Premium on your account.';
      case 'unavailable':
        return 'Billing is not available on this device. Use a production Android build enrolled in Google Play User Choice.';
      case 'not_entitled':
        return 'No Premium purchase was found for this account.';
      case 'report_failed':
        return 'Purchase succeeded, but we could not generate your full report. Please try again.';
      default:
        return 'Something went wrong. Please try again.';
    }
  };

  const handleSubscribe = async () => {
    if (busy || awaitingCheckoutReturn) return;
    if (!signedIn) {
      goToSignInForPaywall();
      return;
    }
    setBusy(true);
    setBusyLabel('Opening checkout…');
    track(AnalyticsEvent.PURCHASE_STARTED, { billing_period: period });

    try {
      const result = await unlockPremium({ seed: mergedSeed });

      if (!result.ok) {
        if (result.reason === 'need_sign_in') {
          goToSignInForPaywall();
          return;
        }
        if (result.reason !== 'cancelled') {
          Alert.alert('Could not unlock Premium', unlockFailureMessage(result.reason));
        }
        setBusy(false);
        setBusyLabel(null);
        return;
      }

      if (result.source === 'razorpay') {
        // Browser checkout opened — resume/poll confirms when the app returns.
        enteredAfterUnlockRef.current = false;
        resumeAttemptsRef.current = 0;
        lastResumeAtRef.current = 0;
        setAwaitingCheckoutReturn(true);
        setBusyLabel('Complete payment in browser…');
        setBusy(true);
        return;
      }

      afterUnlockSuccess();
    } finally {
      // Keep busy while browser checkout is pending confirmation.
      if (!useSessionStore.getState().hasUnlockedPremium) {
        const pending = await isCheckoutReturnPending();
        if (pending) {
          setAwaitingCheckoutReturn(true);
          setBusy(true);
          setBusyLabel((prev) => prev ?? 'Complete payment in browser…');
          return;
        }
      }
      if (!enteredAfterUnlockRef.current) {
        setBusy(false);
        setBusyLabel(null);
      }
    }
  };

  const handleCheckStatus = async () => {
    if (busy && !awaitingCheckoutReturn) return;
    setBusy(true);
    setBusyLabel('Confirming payment...');
    try {
      const result = await checkPremiumStatus({ seed: mergedSeed });
      if (result.ok || useSessionStore.getState().hasUnlockedPremium || hasPremiumAccess()) {
        afterUnlockSuccess();
      } else if (result.reason !== 'cancelled') {
        Alert.alert('No Premium found', unlockFailureMessage(result.reason));
      }
    } finally {
      if (!enteredAfterUnlockRef.current) {
        setBusy(false);
        setBusyLabel(null);
      }
    }
  };

  const backFromPaywall = () => {
    goBack({ pathname, segments: [...segments], params: routeParams });
  };

  const ctaBusy = busy || awaitingCheckoutReturn;

  return (
    <CosmicScreen variant="stitch">
      <View className="flex-1 overflow-hidden">
        <CosmicDotGrid />
        <View
          className="flex-1 gap-4"
          style={{
            paddingHorizontal: 24,
            paddingTop: 8,
            paddingBottom: STICKY_ACTION_BAR_TALL + insets.bottom,
          }}>
          <OnboardingHeader step={ONBOARDING_STEPS.paywall} total={ONBOARDING_TOTAL_STEPS} />

          <View>
            <Text className="font-headline text-[26px] leading-8 tracking-tight text-on-surface">
              Unlock your full Life Blueprint
            </Text>
            <Text className="mt-2 font-body text-[14px] leading-5 text-on-surface-variant">
              Full report chapters, unlimited chat, and daily rituals. Today&apos;s guidance stays free.
            </Text>
            {premium ? (
              <View className="mt-3 rounded-2xl border border-cyan/35 bg-cyan/10 px-4 py-2.5">
                <Text className="font-body text-[13px] text-cyan">You already have full access on this device.</Text>
              </View>
            ) : null}
            {awaitingCheckoutReturn && !premium ? (
              <View className="mt-3 rounded-2xl border border-cyan/35 bg-cyan/10 px-4 py-2.5">
                <Text className="font-body text-[13px] text-cyan">
                  Confirming payment… you&apos;ll enter Agastya automatically once it clears.
                </Text>
              </View>
            ) : null}
            {signedIn && authEmail ? (
              <Text className="mt-2 font-body text-[12px] leading-5 text-on-surface-variant">
                Paying as {authEmail}
              </Text>
            ) : null}
          </View>

          <View className="gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
            {TRUST_HIGHLIGHTS.map((line) => (
              <View key={line} className="flex-row items-start gap-2.5 py-0.5">
                <Ionicons name="checkmark-circle" size={16} color={stitchSignal} style={{ marginTop: 2 }} />
                <Text className="flex-1 font-body text-[13px] leading-5 text-on-surface/90">{line}</Text>
              </View>
            ))}
          </View>

          <View className="mt-auto gap-2.5">
            <PlanRow
              label="Yearly Access"
              badge="Best value"
              price={`${formatPlanPrice('annual', '₹349')}/year`}
              active={period === 'annual'}
              onPress={() => setPeriod('annual')}
            />
            <PlanRow
              label="Monthly Access"
              price={`${formatPlanPrice('monthly', '₹149')}/month`}
              active={period === 'monthly'}
              onPress={() => setPeriod('monthly')}
            />
          </View>
        </View>

        <StickyActionBar contentStyle={{ gap: 12 }}>
          {premium ? (
            <CosmicButton
              gradient="nebulaMd3"
              label="Enter Agastya"
              onPress={() => (hasPremiumAccess() ? enterMainApp() : afterUnlockSuccess())}
            />
          ) : ctaBusy ? (
            <CosmicButton
              gradient="nebulaMd3"
              label={unlockLabel()}
              onPress={() => void handleSubscribe()}
              disabled
            />
          ) : (
            <MotiView
              from={{ scale: 1 }}
              animate={{ scale: 1.02 }}
              transition={{ type: 'timing', duration: 1100, loop: true, repeatReverse: true }}>
              <CosmicButton
                gradient="nebulaMd3"
                label={unlockLabel()}
                onPress={() => void handleSubscribe()}
                disabled={ctaBusy}
              />
            </MotiView>
          )}
          <CosmicButton variant="ghost" label="Go back" onPress={backFromPaywall} />
          {!premium ? (
            <Pressable
              onPress={() => void handleCheckStatus()}
              disabled={ctaBusy && !awaitingCheckoutReturn}
              accessibilityRole="button"
              accessibilityLabel="Check premium status"
              accessibilityState={{ disabled: ctaBusy && !awaitingCheckoutReturn }}
              className="items-center py-1 active:opacity-80">
              <Text className="font-body text-[13px] font-medium text-cyan underline">Check premium status</Text>
            </Pressable>
          ) : null}
          {!signedIn ? (
            <CosmicButton variant="ghost" label="Sign in to unlock" onPress={goToSignInForPaywall} />
          ) : null}
          <View className="flex-row items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
            <Ionicons name="shield-checkmark" size={14} color={colors.health} />
            <Text className="font-body text-[11px] text-on-surface/85">Secure payment via Google Play or Razorpay</Text>
          </View>
        </StickyActionBar>
      </View>
    </CosmicScreen>
  );
}

function PlanRow({
  label,
  badge,
  price,
  active,
  onPress,
}: {
  label: string;
  badge?: string;
  price: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={`${label}${badge ? `, ${badge}` : ''}, ${price}`}>
      <View
        className={
          active
            ? 'rounded-3xl border border-primary/55 bg-primary/10 px-5 py-4'
            : 'rounded-3xl border border-white/12 bg-black/35 px-5 py-4'
        }
        style={active ? { shadowColor: stitchSignal, shadowOpacity: 0.25, shadowRadius: 12 } : undefined}>
        {badge ? (
          <View className="mb-3 self-start rounded-full border border-primary/40 bg-primary/20 px-3 py-1">
            <Text className="font-label text-[9px] font-bold uppercase tracking-[0.22em] text-cyan">{badge}</Text>
          </View>
        ) : null}
        <View className="flex-row items-center gap-3">
          <View
            className={`h-5 w-5 rounded-full border-2 ${active ? 'border-cyan bg-cyan/30' : 'border-white/25'}`}
          />
          <View className="min-w-0 flex-1">
            <Text className="font-label text-[17px] font-semibold text-on-surface">{label}</Text>
            <Text className="mt-1 font-body text-[14px] text-on-surface-variant">{price}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

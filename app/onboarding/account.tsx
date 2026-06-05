import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { StitchOnboardingHeader } from '@/components/onboarding/StitchOnboardingHeader';
import { BlurContainer, CosmicButton, GradientText } from '@/components/primitives';
import { LEGAL_URLS } from '@/constants/legal';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { SIGN_IN_UNAVAILABLE } from '@/constants/userCopy';
import { STITCH_PALM_ART_URI, stitchMd3 } from '@/constants/stitchWelcome';
import { track } from '@/services/analytics';
import { restoreSessionFromServer } from '@/services/sessionRestore';
import { getSupabase, isSupabaseEnabled } from '@/services/supabase';
import { useSessionStore } from '@/store/sessionStore';
import { useAuthSession } from '@/hooks/useAuthSession';
import { enterMainApp as goToMainApp, hasRitualReading, resolveResumeHref } from '@/utils/navigationFlow';

const TRUST_BADGES = [
  { icon: 'cloud-done-outline' as const, label: 'Secure backup' },
  { icon: 'shield-checkmark-outline' as const, label: 'Private & safe' },
  { icon: 'phone-portrait-outline' as const, label: 'Any device' },
];

export default function SaveJourneyScreen() {
  const insets = useSafeAreaInsets();
  const { seed, fromPaywall } = useLocalSearchParams<{ seed?: string; fromPaywall?: string }>();
  const storeSeed = useSessionStore((s) => s.readingSeed);
  const mergedSeed = seed ?? storeSeed ?? 'stillness';
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const hasEnteredMain = useSessionStore((s) => s.hasEnteredMain);
  const { isSignedIn, email: authEmail } = useAuthSession();
  const afterPaywall = fromPaywall === '1';

  const [email, setEmail] = useState('');

  const redirectUri = Linking.createURL('/');

  const openLegal = (url: string) => {
    void Linking.openURL(url).catch(() => {
      Alert.alert('Could not open link', url);
    });
  };

  const magicLink = async () => {
    const supabase = getSupabase();
    if (!isSupabaseEnabled || !supabase) {
      Alert.alert('Sign-in unavailable', SIGN_IN_UNAVAILABLE);
      return;
    }
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) {
      Alert.alert('Check your email', 'Enter a valid address and we’ll send a one-tap sign-in link.');
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: redirectUri },
    });

    if (error) {
      Alert.alert('Something went wrong', error.message);
      return;
    }

    track('auth_magic_link_dispatched');
    Alert.alert('Check your inbox', 'We sent a sign-in link. After you sign in, your reading syncs across devices.');
  };

  const oauth = async (provider: 'apple' | 'google') => {
    const supabase = getSupabase();
    if (!isSupabaseEnabled || !supabase) {
      Alert.alert('Sign-in unavailable', SIGN_IN_UNAVAILABLE);
      return;
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: Platform.OS !== 'web',
      },
    });

    if (error) {
      Alert.alert(`${provider === 'apple' ? 'Apple' : 'Google'} sign-in`, error.message);
      return;
    }

    if (Platform.OS !== 'web' && data.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
      if (result.type === 'success') {
        await restoreSessionFromServer({ force: true });
      }
    }

    track('auth_oauth_attempt', { provider });
  };

  return (
    <CosmicScreen variant="stitch">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="flex-1">
          <CosmicDotGrid />
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingTop: 8,
              paddingBottom: 220 + insets.bottom,
              gap: 22,
            }}>
            <StitchOnboardingHeader ritualStep={{ current: ONBOARDING_STEPS.account, total: ONBOARDING_TOTAL_STEPS }} />

            <View className="overflow-hidden rounded-3xl border border-white/12">
              <Image
                accessibilityIgnoresInvertColors
                source={{ uri: STITCH_PALM_ART_URI }}
                className="h-44 w-full"
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', stitchMd3.background]}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 }}
              />
            </View>

            <View>
              <GradientText className="font-space-grotesk text-[11px] uppercase tracking-[0.38em] text-stitch-signal">
                {afterPaywall ? 'Almost there' : 'Save your journey'}
              </GradientText>
              <Text className="mt-4 font-noto-serif text-[30px] leading-9 tracking-tight text-mist">
                Save your reading
              </Text>
              <Text className="mt-3 font-inter text-[15px] leading-6 text-md-on-surface-variant">
                Create an account to access your palm report, chat, and daily guidance on any device.
              </Text>
              {isSignedIn ? (
                <View className="mt-4 rounded-2xl border border-stitch-signal/35 bg-stitch-signal/10 px-4 py-3">
                  <Text className="font-inter text-[14px] leading-6 text-stitch-signal">
                    {authEmail ? `Signed in as ${authEmail}.` : 'You’re signed in.'}{' '}
                    {hasEnteredMain ? 'Return to the app below.' : 'Finish onboarding, then enter the app.'}
                  </Text>
                </View>
              ) : null}
            </View>

            <View className="flex-row gap-2">
              {TRUST_BADGES.map((b) => (
                <View
                  key={b.label}
                  className="min-w-0 flex-1 items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-2 py-3">
                  <Ionicons name={b.icon} size={20} color={stitchMd3.primary} />
                  <Text className="text-center font-inter text-[10px] font-medium leading-4 text-mist">{b.label}</Text>
                </View>
              ))}
            </View>

            <CosmicButton gradient="nebulaMd3" label="Continue with Apple" onPress={() => void oauth('apple')} />

            <Pressable
              onPress={() => void oauth('google')}
              className="flex-row items-center justify-center gap-3 rounded-full border border-white/16 bg-white/[0.06] py-4 active:opacity-90">
              <Ionicons name="logo-google" size={20} color="#fff" />
              <Text className="font-inter text-[16px] font-medium text-mist">Continue with Google</Text>
            </Pressable>

            <View className="flex-row items-center gap-4 py-1">
              <View className="h-px flex-1 bg-white/12" />
              <Text className="font-space-grotesk text-[11px] uppercase tracking-[0.28em] text-md-on-primary-container">
                Or
              </Text>
              <View className="h-px flex-1 bg-white/12" />
            </View>

            <View>
              <Text className="mb-2 font-inter text-[13px] text-md-on-surface-variant">Email address</Text>
              <TextInput
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="you@example.com"
                placeholderTextColor="rgba(255,255,255,0.38)"
                value={email}
                onChangeText={setEmail}
                className="rounded-full border border-white/16 bg-black/50 px-5 py-4 font-inter text-[16px] text-mist"
              />
              <View className="mt-4">
                <CosmicButton gradient="nebulaMd3" label="Continue with Email" onPress={() => void magicLink()} />
              </View>
            </View>

            <View className="flex-row flex-wrap justify-center gap-x-4 gap-y-2 pt-2">
              <Pressable onPress={() => openLegal(LEGAL_URLS.terms)}>
                <Text className="font-inter text-[12px] text-md-on-primary-container underline">Terms of Use</Text>
              </Pressable>
              <Pressable onPress={() => openLegal(LEGAL_URLS.privacy)}>
                <Text className="font-inter text-[12px] text-md-on-primary-container underline">Privacy Policy</Text>
              </Pressable>
            </View>
            <Text className="text-center font-inter text-[11px] text-md-on-primary-container/80">
              © {new Date().getFullYear()} Agastya AI Spirituality
            </Text>
          </ScrollView>

          <BlurContainer
            intensity={56}
            className="absolute bottom-0 left-0 right-0 z-20 rounded-none border-t border-white/14 bg-[#0f0e10]/94 px-6 pt-4"
            style={{ elevation: 24 }}>
            <View style={{ paddingBottom: Math.max(insets.bottom, 16) }} className="gap-y-2.5">
              {hasRitualReading() ? (
                <CosmicButton gradient="nebulaMd3" label="Open Agastya" onPress={() => goToMainApp()} />
              ) : (
                <CosmicButton
                  gradient="nebulaMd3"
                  label="Continue onboarding"
                  onPress={() => router.replace(resolveResumeHref())}
                />
              )}
              <CosmicButton
                variant="ghost"
                label={hasRitualReading() ? 'Skip sign-in for now' : 'Back to reading preview'}
                onPress={() => {
                  if (hasRitualReading()) {
                    goToMainApp();
                  } else {
                    router.replace('/onboarding/report-preview');
                  }
                }}
              />
              {!afterPaywall && !premium ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/onboarding/paywall',
                      params: { seed: mergedSeed },
                    })
                  }
                  className="py-2">
                  <Text className="text-center font-inter text-[13px] text-stitch-signal">
                    Haven’t unlocked yet? View plans
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </BlurContainer>
        </View>
      </KeyboardAvoidingView>
    </CosmicScreen>
  );
}

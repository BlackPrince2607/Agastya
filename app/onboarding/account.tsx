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

import { GoogleLogo } from '@/components/auth/GoogleLogo';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { GlassCard, Icon, NebulaButton, type IconName } from '@/components/ui';
import { LEGAL_URLS } from '@/constants/legal';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { SIGN_IN_UNAVAILABLE } from '@/constants/userCopy';
import { STITCH_PALM_ART_URI } from '@/constants/stitchWelcome';
import { track } from '@/services/analytics';
import { restoreSessionFromServer } from '@/services/sessionRestore';
import { getSupabase, isSupabaseEnabled } from '@/services/supabase';
import { useSessionStore } from '@/store/sessionStore';
import { useAuthSession } from '@/hooks/useAuthSession';
import { enterMainApp as goToMainApp, hasRitualReading, resolveResumeHref } from '@/utils/navigationFlow';

const TRUST_BADGES: { icon: IconName; label: string }[] = [
  { icon: 'cloud_done', label: 'Secure Backup' },
  { icon: 'encrypted', label: 'Private & Safe' },
  { icon: 'devices', label: 'Any Device' },
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
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingTop: 8,
              paddingBottom: 230 + insets.bottom,
              gap: 24,
            }}>
            <OnboardingHeader step={ONBOARDING_STEPS.account} total={ONBOARDING_TOTAL_STEPS} />

            {/* Hero */}
            <View className="overflow-hidden rounded-glass border border-white/10 shadow-aura" style={{ aspectRatio: 4 / 3 }}>
              <Image
                accessibilityIgnoresInvertColors
                source={{ uri: STITCH_PALM_ART_URI }}
                className="h-full w-full"
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(20,19,21,0.2)', '#141315']}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' }}
              />
            </View>

            {/* Headline */}
            <View className="items-center gap-2">
              <Text className="text-center font-headline text-[30px] leading-9 text-on-surface">
                Save Your Reading & Continue Your Journey
              </Text>
              <Text className="text-center font-body text-[15px] leading-6 text-on-surface-variant">
                Sign in to save your report, chat history, and daily progress on any device.
              </Text>
            </View>

            {isSignedIn ? (
              <GlassCard className="w-full px-4 py-3" style={{ borderColor: 'rgba(34,211,238,0.35)' }}>
                <Text className="font-body text-[14px] leading-6" style={{ color: '#22d3ee' }}>
                  {authEmail ? `Signed in as ${authEmail}.` : 'You’re signed in.'}{' '}
                  {hasEnteredMain ? 'Return to the app below.' : 'Finish onboarding, then enter the app.'}
                </Text>
              </GlassCard>
            ) : null}

            {/* Trust indicators */}
            <View className="flex-row gap-3">
              {TRUST_BADGES.map((b) => (
                <GlassCard key={b.label} className="min-w-0 flex-1 items-center gap-2 px-2 py-3">
                  <Icon name={b.icon} size={22} color="#d3beeb" />
                  <Text className="text-center font-label text-[10px] uppercase tracking-[0.08em] text-on-surface">
                    {b.label}
                  </Text>
                </GlassCard>
              ))}
            </View>

            {/* Social login stack */}
            <View className="gap-3">
              <Pressable
                onPress={() => void oauth('apple')}
                accessibilityRole="button"
                accessibilityLabel="Continue with Apple"
                className="flex-row items-center justify-center gap-3 rounded-pill bg-white py-4 active:opacity-90">
                <Ionicons name="logo-apple" size={20} color="#000" />
                <Text className="font-body-medium text-[16px] font-semibold text-black">Continue with Apple</Text>
              </Pressable>

              <Pressable
                onPress={() => void oauth('google')}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
                className="flex-row items-center justify-center gap-3 rounded-pill border border-white/10 bg-white/[0.05] py-4 active:opacity-90">
                <GoogleLogo size={20} />
                <Text className="font-body-medium text-[16px] font-semibold text-on-surface">Continue with Google</Text>
              </Pressable>
            </View>

            {/* Divider */}
            <View className="flex-row items-center gap-4">
              <View className="h-px flex-1 bg-white/10" />
              <Text className="font-label text-[10px] uppercase tracking-[0.28em] text-on-surface-variant">Or</Text>
              <View className="h-px flex-1 bg-white/10" />
            </View>

            {/* Email form */}
            <View className="gap-2">
              <Text className="ml-4 font-label text-[11px] uppercase tracking-[0.1em] text-on-surface-variant">
                Email Address
              </Text>
              <TextInput
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="you@example.com"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={email}
                onChangeText={setEmail}
                className="rounded-pill border border-white/10 bg-surface-container-lowest/50 px-6 py-4 font-body text-[16px] text-on-surface"
              />
              <View className="mt-2">
                <NebulaButton label="Continue with Email" onPress={() => void magicLink()} />
              </View>
            </View>

            {/* Footer */}
            <View className="items-center gap-2 pt-1">
              <View className="flex-row justify-center gap-6">
                <Pressable onPress={() => openLegal(LEGAL_URLS.terms)}>
                  <Text className="font-label text-[11px] uppercase tracking-[0.08em] text-on-surface-variant">
                    Terms of Use
                  </Text>
                </Pressable>
                <Pressable onPress={() => openLegal(LEGAL_URLS.privacy)}>
                  <Text className="font-label text-[11px] uppercase tracking-[0.08em] text-on-surface-variant">
                    Privacy Policy
                  </Text>
                </Pressable>
              </View>
              <Text className="font-label text-[10px] uppercase tracking-[0.08em] text-on-surface-variant/70">
                © {new Date().getFullYear()} Agastya AI Spirituality
              </Text>
            </View>
          </ScrollView>

          {/* Continuation dock */}
          <View
            className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-[#0f0e10]/95 px-6 pt-4"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
            <View className="gap-y-2.5">
              {hasRitualReading() ? (
                <NebulaButton label="Open Agastya" onPress={() => goToMainApp()} />
              ) : (
                <NebulaButton label="Continue onboarding" onPress={() => router.replace(resolveResumeHref())} />
              )}
              <Pressable
                onPress={() => {
                  if (hasRitualReading()) {
                    goToMainApp();
                  } else {
                    router.replace('/onboarding/report-preview');
                  }
                }}
                className="items-center py-2 active:opacity-80">
                <Text className="font-label text-[11px] uppercase tracking-[0.1em] text-on-surface-variant">
                  {hasRitualReading() ? 'Skip sign-in for now' : 'Back to reading preview'}
                </Text>
              </Pressable>
              {!afterPaywall && !premium ? (
                <Pressable
                  onPress={() => router.push({ pathname: '/onboarding/paywall', params: { seed: mergedSeed } })}
                  className="items-center pb-1">
                  <Text className="font-body text-[13px]" style={{ color: '#22d3ee' }}>
                    Haven’t unlocked yet? View plans
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </CosmicScreen>
  );
}

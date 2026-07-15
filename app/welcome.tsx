import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiPressable } from 'moti/interactions';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StickyActionBar } from '@/components/layout/StickyActionBar';
import { WelcomeBlurShell } from '@/components/welcome/WelcomeBlurShell';
import { stitchMd3 } from '@/constants/stitchWelcome';
import { triggerLightTap } from '@/hooks/useHapticTap';
import { readAuthSession } from '@/services/authSession';
import { isSupabaseEnabled } from '@/services/supabase';
import { SIGN_IN_UNAVAILABLE } from '@/constants/userCopy';
import { resolveOnboardingHref, routeAfterSignInIntent } from '@/utils/navigationFlow';
import { deferRouterReplace } from '@/utils/routerDefer';

const WELCOME_PALM_BACKGROUND = require('../assets/images/agastya-palm-welcome-portrait.png') as ImageSourcePropType;

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const [signInBusy, setSignInBusy] = useState(false);

  const handleSignIn = async () => {
    if (signInBusy) return;
    if (!isSupabaseEnabled) {
      Alert.alert('Sign-in unavailable', SIGN_IN_UNAVAILABLE);
      return;
    }
    void triggerLightTap();
    setSignInBusy(true);
    try {
      const auth = await readAuthSession();
      if (auth.isSignedIn) {
        await routeAfterSignInIntent();
      } else {
        router.push({ pathname: '/onboarding/account', params: { fromWelcome: '1' } });
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('[Agastya auth] welcome sign-in failed', err);
      }
      // Fall back to the account screen so the user can retry OAuth explicitly
      // rather than being stuck on welcome with only a generic popup.
      router.push({ pathname: '/onboarding/account', params: { fromWelcome: '1' } });
    } finally {
      setSignInBusy(false);
    }
  };

  const glassIcon = (
    <View style={styles.iconShell}>
      <WelcomeBlurShell intensity={28} tint="dark" style={styles.iconBlur} fallbackStyle={styles.iconFallback}>
        <MaterialCommunityIcons name="star-four-points" size={34} color={stitchMd3.primary} />
      </WelcomeBlurShell>
    </View>
  );

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Image
          accessibilityIgnoresInvertColors
          source={WELCOME_PALM_BACKGROUND}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(5,6,14,0)', 'rgba(5,6,14,0.10)', 'rgba(5,5,9,0.96)']}
          locations={[0, 0.58, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollInner,
          {
            paddingTop: insets.top + 28,
            paddingBottom: insets.bottom + 238,
          },
        ]}>
        <View style={styles.stack}>
          <View style={styles.iconWrap}>{glassIcon}</View>

          <View style={styles.headBlock}>
            <Text style={styles.kicker}>Agastya</Text>
            <Text style={styles.headline}>{`Your palm.\nYour guide.`}</Text>
          </View>

          <Text style={styles.body}>A personalized palm reading and guide.</Text>
        </View>
      </ScrollView>

      <StickyActionBar bottomPadding={32} contentStyle={styles.welcomeDock}>
        <View style={styles.ctaStack}>
          <MotiPressable
            onPress={() => {
              void triggerLightTap();
              deferRouterReplace(resolveOnboardingHref());
            }}
            animate={({ pressed }) => ({ scale: pressed ? 0.97 : 1 })}
            transition={{ type: 'timing', duration: 160 }}>
            <LinearGradient
              colors={['#7c3aed', '#e879f9', '#22d3ee']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryGradient}>
              <View style={styles.primaryInner}>
                <Text style={styles.primaryLabel}>Get started</Text>
                <View style={styles.primaryIconBubble}>
                  <MaterialCommunityIcons name="arrow-right" size={18} color="#ffffff" />
                </View>
              </View>
            </LinearGradient>
          </MotiPressable>

          <Pressable
            onPress={() => void handleSignIn()}
            disabled={signInBusy}
            style={({ pressed }) => [styles.secondaryBtn, (pressed || signInBusy) && { opacity: 0.88 }]}>
            <WelcomeBlurShell intensity={22} tint="dark" style={styles.secondaryBlur} fallbackStyle={styles.secondaryFallback}>
              {signInBusy ? (
                <ActivityIndicator color={stitchMd3.onBackground} />
              ) : (
                <Text style={styles.secondaryLabel}>Sign in</Text>
              )}
            </WelcomeBlurShell>
          </Pressable>
        </View>

        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>
      </StickyActionBar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: stitchMd3.background,
  },
  scrollInner: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    justifyContent: 'center',
  },
  stack: {
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 22,
  },
  iconWrap: {
    marginBottom: 4,
  },
  iconShell: {
    width: 64,
    height: 64,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: stitchMd3.primary,
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  iconBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  iconFallback: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  headBlock: {
    alignItems: 'center',
    gap: 14,
  },
  kicker: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 12,
    letterSpacing: 3.6,
    lineHeight: 15,
    color: stitchMd3.onPrimaryContainer,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  headline: {
    fontFamily: 'NotoSerif_700Bold',
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.75,
    color: '#ffffff',
    textAlign: 'center',
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 23,
    color: stitchMd3.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 320,
    alignSelf: 'center',
    paddingHorizontal: 4,
  },
  ctaStack: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: 14,
  },
  primaryGradient: {
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: stitchMd3.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    shadowOpacity: 0.5,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 16,
  },
  primaryInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 60,
    paddingVertical: 17,
    paddingHorizontal: 28,
  },
  primaryIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  primaryLabel: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 15,
    letterSpacing: 2.4,
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  secondaryBtn: {
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  secondaryBlur: {
    borderRadius: 999,
    minHeight: 58,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  secondaryFallback: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  secondaryLabel: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 12,
    letterSpacing: 2.8,
    color: stitchMd3.onBackground,
    textTransform: 'uppercase',
  },
  progressTrack: {
    alignSelf: 'center',
    width: 96,
    height: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '14%',
    borderRadius: 999,
    backgroundColor: stitchMd3.primary,
    shadowColor: stitchMd3.primary,
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  welcomeDock: {
    alignItems: 'center',
    gap: 14,
  },
});

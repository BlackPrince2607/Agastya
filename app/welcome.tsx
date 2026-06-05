import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { MotiPressable } from 'moti/interactions';
import { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WelcomeBlurShell } from '@/components/welcome/WelcomeBlurShell';
import { stitchMd3, STITCH_PALM_ART_URI } from '@/constants/stitchWelcome';
import { triggerLightTap } from '@/hooks/useHapticTap';
import { routeAfterSignInIntent } from '@/utils/navigationFlow';

/** Pixel translation of Stitch HTML export — MD3 tokens, Inter / Noto Serif / Space Grotesk */
const WIN = Dimensions.get('window');

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const palmW = WIN.width * 1.45;
  const [signInBusy, setSignInBusy] = useState(false);

  const handleSignIn = async () => {
    if (signInBusy) return;
    void triggerLightTap();
    setSignInBusy(true);
    try {
      await routeAfterSignInIntent();
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
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient colors={[stitchMd3.background, stitchMd3.background]} style={StyleSheet.absoluteFill} />
        <View style={styles.radialWash} />
        <Image
          accessibilityIgnoresInvertColors
          source={{ uri: STITCH_PALM_ART_URI }}
          style={[styles.palmArt, { width: palmW, height: palmW * 0.95, left: (WIN.width - palmW) / 2 }]}
          resizeMode="contain"
        />
        <LinearGradient
          colors={['rgba(211,190,235,0.12)', 'transparent', stitchMd3.background]}
          locations={[0, 0.42, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollInner, { paddingBottom: insets.bottom + 96 }]}>
        <View style={styles.stack}>
          <View style={styles.iconWrap}>{glassIcon}</View>

          <View style={styles.headBlock}>
            <Text style={styles.kicker}>Agastya</Text>
            <Text style={styles.headline}>{`Your palm.\nYour guide.`}</Text>
          </View>

          <Text style={styles.body}>
            A personalized palm reading and AI Guide for love, career, and daily clarity—for reflection and fun.
          </Text>

          <View style={styles.ctaStack}>
            <MotiPressable
              onPress={() => {
                void triggerLightTap();
                router.push('/onboarding');
              }}
              animate={({ pressed }) => ({ scale: pressed ? 0.97 : 1 })}
              transition={{ type: 'timing', duration: 160 }}>
              <LinearGradient
                colors={['#d3beeb', '#88769f', '#4f4065']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryGradient}>
                <View style={styles.primaryInner}>
                  <Text style={styles.primaryLabel}>Get started</Text>
                  <MaterialCommunityIcons name="arrow-right" size={22} color={stitchMd3.onPrimary} />
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
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 28) }]}>
        <View style={styles.footerRule} />
        <Text style={styles.footerLine}>Entertainment only · Not medical or financial advice</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: stitchMd3.background,
  },
  radialWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(211, 190, 235, 0.06)',
  },
  palmArt: {
    position: 'absolute',
    opacity: 0.38,
    top: WIN.height * 0.09,
  },
  scrollInner: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    justifyContent: 'center',
  },
  stack: {
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 28,
  },
  iconWrap: {
    marginBottom: 6,
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
    gap: 10,
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
    fontSize: 38,
    lineHeight: 43,
    letterSpacing: -0.75,
    color: '#ffffff',
    textAlign: 'center',
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 18,
    lineHeight: 29,
    color: stitchMd3.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 340,
    alignSelf: 'center',
  },
  ctaStack: {
    width: '100%',
    gap: 16,
    marginTop: 8,
  },
  primaryGradient: {
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: stitchMd3.primary,
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  primaryInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 19,
    paddingHorizontal: 28,
  },
  primaryLabel: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 15,
    letterSpacing: 2.4,
    color: stitchMd3.onPrimary,
    textTransform: 'uppercase',
  },
  secondaryBtn: {
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  secondaryBlur: {
    borderRadius: 999,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
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
    marginTop: 10,
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
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  footerRule: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginBottom: 16,
    backgroundColor: 'transparent',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.14)',
  },
  footerLine: {
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    fontSize: 14,
    color: stitchMd3.onSurfaceVariant,
    opacity: 0.62,
    textAlign: 'center',
  },
});

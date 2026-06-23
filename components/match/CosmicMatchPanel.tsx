import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { MetricBar } from '@/components/match/MetricBar';
import { EntertainmentDisclaimer } from '@/components/legal/EntertainmentDisclaimer';
import { CosmicButton, GlowCard, GradientText } from '@/components/primitives';
import { CosmicTextField, Icon } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useSessionStore } from '@/store/sessionStore';
import {
  compatibilityAffinity,
  compatibilityDimensions,
  matchStrengthLabel,
} from '@/utils/compatibilityScore';
import {
  hasPalmPair,
  palmCompatibilityAffinity,
  palmCompatibilityDimensions,
} from '@/utils/palmCompatibilityScore';

type MatchMode = 'name' | 'palm';

type CosmicMatchPanelProps = {
  defaultSelfName?: string;
  subtitle?: string;
  onOpenGuide?: () => void;
};

export function CosmicMatchPanel({ defaultSelfName = '', subtitle, onOpenGuide }: CosmicMatchPanelProps) {
  const [mode, setMode] = useState<MatchMode>('name');
  const [selfName, setSelfName] = useState(defaultSelfName);
  const [partnerName, setPartnerName] = useState('');

  const selfPalm = useSessionStore((s) => s.palmAnalysis);
  const partnerPalm = useSessionStore((s) => s.partnerPalmAnalysis);
  const setPartnerPalmAnalysis = useSessionStore((s) => s.setPartnerPalmAnalysis);
  const hadPartnerPalmRef = useRef(Boolean(partnerPalm));

  useEffect(() => {
    if (partnerPalm && !hadPartnerPalmRef.current) {
      setMode('palm');
    }
    hadPartnerPalmRef.current = Boolean(partnerPalm);
  }, [partnerPalm]);

  const palmReady = hasPalmPair(selfPalm, partnerPalm);
  const usePalmScores = mode === 'palm' && palmReady && selfPalm && partnerPalm;

  const affinity = useMemo(() => {
    if (usePalmScores) {
      return palmCompatibilityAffinity(selfPalm, partnerPalm);
    }
    return compatibilityAffinity(selfName || 'you', partnerName || 'partner');
  }, [usePalmScores, selfPalm, partnerPalm, selfName, partnerName]);

  const dimensions = useMemo(() => {
    if (usePalmScores) {
      return palmCompatibilityDimensions(selfPalm, partnerPalm);
    }
    return compatibilityDimensions(selfName || 'you', partnerName || 'partner');
  }, [usePalmScores, selfPalm, partnerPalm, selfName, partnerName]);

  const strength = matchStrengthLabel(affinity);

  const openPartnerScan = () => {
    router.push('/report/partner-palm-scan' as never);
  };

  const clearPartnerPalm = () => {
    setPartnerPalmAnalysis(null);
  };

  return (
    <View className="w-full gap-7">
      <View className="w-full flex-row items-center justify-center gap-3 px-1">
        <AvatarRing tint="cyan" filled={Boolean(selfPalm)} />
        <LinearGradient
          colors={[colors.purple, colors.love]}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
          <Icon name="favorite" size={24} color="#fff" />
        </LinearGradient>
        <AvatarRing tint="violet" outline filled={Boolean(partnerPalm)} />
      </View>

      {subtitle ? (
        <Text className="px-2 text-center font-body text-[14px] leading-5 text-on-surface-variant">{subtitle}</Text>
      ) : null}

      <View className="w-full items-center gap-1 px-2">
        {Platform.OS === 'web' ? (
          <Text
            className="font-noto-serif text-[44px] font-semibold text-stitch-signal"
            adjustsFontSizeToFit
            numberOfLines={1}
            minimumFontScale={0.7}>
            {affinity}%
          </Text>
        ) : (
          <GradientText className="font-noto-serif text-[44px] font-semibold">{affinity}%</GradientText>
        )}
        <Text className="font-body-medium text-[15px] text-primary">{strength}</Text>
        {usePalmScores ? (
          <Text className="mt-1 text-center font-body text-[12px] text-on-surface-variant">
            Based on both palm readings
          </Text>
        ) : null}
        {partnerPalm && mode === 'name' ? (
          <Text className="mt-2 text-center font-body text-[12px] leading-5 text-primary/90">
            Switch to By palm to see palm-based scores.
          </Text>
        ) : null}
      </View>

      <View className="flex-row gap-2 rounded-2xl border border-white/10 bg-surface-container-low/80 p-1">
        <ModeTab label="By name" active={mode === 'name'} onPress={() => setMode('name')} />
        <ModeTab label="By palm" active={mode === 'palm'} onPress={() => setMode('palm')} />
      </View>

      {mode === 'name' ? (
        <GlowCard className="gap-4">
          <Text className="font-label text-[11px] uppercase tracking-[0.1em] text-on-surface-variant">
            Compare by name
          </Text>
          <CosmicTextField
            value={selfName}
            onChangeText={setSelfName}
            placeholder="Your name"
            accessibilityLabel="Your name"
            maxLength={40}
          />
          <CosmicTextField
            value={partnerName}
            onChangeText={setPartnerName}
            placeholder="Their name"
            accessibilityLabel="Their name"
            maxLength={40}
          />
        </GlowCard>
      ) : (
        <GlowCard className="gap-4">
          <Text className="font-label text-[11px] uppercase tracking-[0.1em] text-on-surface-variant">
            Compare by palm
          </Text>

          <PalmStatusRow
            label="Your palm"
            ready={Boolean(selfPalm)}
            readyText="Reading on file"
            pendingText="Complete your palm scan in onboarding"
          />

          <PalmStatusRow
            label="Partner's palm"
            ready={Boolean(partnerPalm)}
            readyText="Palm captured"
            pendingText="Scan or upload their palm photo"
          />

          <View className="gap-4 pt-1">
            <CosmicButton
              gradient="nebulaMd3"
              label={partnerPalm ? 'Rescan partner palm' : 'Scan partner palm'}
              onPress={openPartnerScan}
            />
            {partnerPalm ? (
              <Pressable onPress={clearPartnerPalm} className="items-center py-2 active:opacity-80">
                <Text className="font-body text-[13px] text-on-surface-variant">Remove partner palm</Text>
              </Pressable>
            ) : null}
          </View>

          {!selfPalm ? (
            <View className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3">
              <Text className="font-body text-[13px] leading-5 text-amber-100/90">
                Scan your own palm first from Home to enable palm-based matching.
              </Text>
            </View>
          ) : null}
        </GlowCard>
      )}

      <View className="gap-4">
        <Text className="font-label text-[11px] uppercase tracking-[0.1em] text-on-surface-variant">
          Connection dimensions
        </Text>
        {dimensions.map((d) => (
          <MetricBar key={d.key} label={d.label} pct={d.pct} />
        ))}
      </View>

      {onOpenGuide ? (
        <CosmicButton gradient="nebulaMd3" label="Ask the Guide" onPress={onOpenGuide} />
      ) : null}

      <EntertainmentDisclaimer dense />
    </View>
  );
}

function ModeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="min-w-0 flex-1">
      <View
        className={
          active
            ? 'items-center rounded-xl border border-primary/35 bg-primary/12 px-3 py-3'
            : 'items-center rounded-xl px-3 py-3'
        }>
        <Text
          className={
            active
              ? 'font-label text-[12px] uppercase tracking-[0.1em] text-primary'
              : 'font-label text-[12px] uppercase tracking-[0.1em] text-on-surface-variant'
          }>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function PalmStatusRow({
  label,
  ready,
  readyText,
  pendingText,
}: {
  label: string;
  ready: boolean;
  readyText: string;
  pendingText: string;
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-white/10 bg-surface-container-low/60 px-4 py-3">
      <View
        className={
          ready
            ? 'h-9 w-9 items-center justify-center rounded-full bg-success-muted'
            : 'h-9 w-9 items-center justify-center rounded-full bg-white/8'
        }>
        <Icon
          name={ready ? 'check_circle' : 'radio_button_unchecked'}
          size={20}
          color={ready ? colors.cyan : colors.outline}
        />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-body-medium text-[14px] text-on-surface">{label}</Text>
        <Text className="font-body text-[12px] leading-4 text-on-surface-variant" numberOfLines={2}>
          {ready ? readyText : pendingText}
        </Text>
      </View>
    </View>
  );
}

function AvatarRing({ tint, outline, filled }: { tint: 'cyan' | 'violet'; outline?: boolean; filled?: boolean }) {
  const border = tint === 'cyan' ? 'border-primary/40' : 'border-purple/45';
  const gradientColors =
    tint === 'cyan'
      ? (['rgba(34,211,238,0.35)', 'rgba(34,211,238,0.15)'] as const)
      : (['rgba(168,85,247,0.4)', 'rgba(168,85,247,0.2)'] as const);

  return (
    <View className={`h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border-2 ${border}`}>
      <LinearGradient colors={gradientColors} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Icon
          name={filled ? 'front_hand' : outline ? 'person' : 'person'}
          size={32}
          color={colors.onSurface}
        />
      </LinearGradient>
    </View>
  );
}

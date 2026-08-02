import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { MetricBar } from '@/components/match/MetricBar';
import { PartnerPalmAddSheet } from '@/components/match/PartnerPalmAddSheet';
import { CosmicButton, GradientText } from '@/components/primitives';
import { GlassCard, Icon } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useSessionStore } from '@/store/sessionStore';
import { matchStrengthLabel } from '@/utils/compatibilityScore';
import {
  buildPalmCompatibilitySummary,
  hasPalmPair,
  palmCompatibilityAffinity,
  palmCompatibilityDimensions,
} from '@/utils/palmCompatibilityScore';
import { pickPalmImage } from '@/utils/pickPalmImage';
import { deferRouterPush } from '@/utils/routerDefer';

type CosmicMatchPanelProps = {
  onOpenGuide?: () => void;
};

function slotLabel(name: string | undefined, fallback: string): string {
  const trimmed = name?.trim();
  if (!trimmed) return fallback;
  return trimmed;
}

export function CosmicMatchPanel({ onOpenGuide }: CosmicMatchPanelProps) {
  const [uploadBusy, setUploadBusy] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const selfPalm = useSessionStore((s) => s.palmAnalysis);
  const partnerPalm = useSessionStore((s) => s.partnerPalmAnalysis);
  const userDisplayName = useSessionStore((s) => s.userDisplayName);
  const partnerDisplayName = useSessionStore((s) => s.partnerDisplayName);
  const setPartnerPalmAnalysis = useSessionStore((s) => s.setPartnerPalmAnalysis);
  const setPartnerPalmCaptureBase64 = useSessionStore((s) => s.setPartnerPalmCaptureBase64);
  const setPartnerDisplayName = useSessionStore((s) => s.setPartnerDisplayName);

  const selfLabel = slotLabel(userDisplayName, 'You');
  const partnerLabel = slotLabel(partnerDisplayName, 'Partner');
  const partnerNameForCopy = partnerDisplayName?.trim() || undefined;

  const palmReady = hasPalmPair(selfPalm, partnerPalm);

  const affinity = useMemo(() => {
    if (!palmReady || !selfPalm || !partnerPalm) return null;
    return palmCompatibilityAffinity(selfPalm, partnerPalm);
  }, [palmReady, selfPalm, partnerPalm]);

  const dimensions = useMemo(() => {
    if (!palmReady || !selfPalm || !partnerPalm) return null;
    return palmCompatibilityDimensions(selfPalm, partnerPalm);
  }, [palmReady, selfPalm, partnerPalm]);

  const summary = useMemo(() => {
    if (!palmReady || !selfPalm || !partnerPalm || affinity == null) return null;
    return buildPalmCompatibilitySummary(selfPalm, partnerPalm, affinity, partnerNameForCopy);
  }, [palmReady, selfPalm, partnerPalm, affinity, partnerNameForCopy]);

  const strength = affinity != null ? matchStrengthLabel(affinity) : null;

  const uploadPartnerPalm = async () => {
    if (uploadBusy) return;
    setUploadBusy(true);
    try {
      const base64 = await pickPalmImage();
      if (!base64) return;
      const seed = `partner-${Date.now()}`;
      setPartnerPalmCaptureBase64(base64);
      deferRouterPush({
        pathname: '/report/partner-palm-analysis' as never,
        params: { seed },
      });
    } finally {
      setUploadBusy(false);
      setAddSheetOpen(false);
    }
  };

  const openPartnerScan = () => {
    setAddSheetOpen(false);
    router.push('/report/partner-palm-scan');
  };

  const handlePartnerPress = () => {
    // Existing partner palm: keep summary view — do not re-enter capture/analysis.
    if (partnerPalm) return;
    setAddSheetOpen(true);
  };

  const clearPartnerPalm = () => {
    Alert.alert(
      'Remove partner palm?',
      'This clears your partner reading from compatibility. You can scan or upload again anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setPartnerPalmAnalysis(null);
            setPartnerPalmCaptureBase64(null);
          },
        },
      ],
    );
  };

  return (
    <View className="w-full gap-6">
      <View className="w-full items-center gap-2 px-1">
        <View className="flex-row items-center justify-center gap-4">
          <View className="w-[104px] items-center">
            <PalmCircle
              label={selfLabel}
              tint="cyan"
              showAdd={!selfPalm}
              onPress={() => {
                if (selfPalm) router.push('/report');
                else router.push('/onboarding/palm-scan');
              }}
            />
          </View>
          <View className="w-11 items-center justify-center">
            <LinearGradient
              colors={[colors.purple, colors.love]}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="favorite" size={22} color="#fff" />
            </LinearGradient>
          </View>
          <View className="w-[104px] items-center">
            <PalmCircle
              label={partnerLabel}
              tint="violet"
              showAdd={!partnerPalm}
              busy={uploadBusy}
              onPress={handlePartnerPress}
              onRemove={partnerPalm ? clearPartnerPalm : undefined}
            />
          </View>
        </View>

        <View className="flex-row items-center justify-center gap-4">
          <View className="h-8 w-[104px] items-center justify-center">
            <Text
              className="text-center font-label text-[11px] uppercase tracking-[0.08em] text-on-surface-variant"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}>
              {selfLabel}
            </Text>
          </View>
          <View className="w-11" />
          <View className="h-8 w-[104px] items-center justify-center">
            <EditablePartnerLabel
              value={partnerDisplayName ?? ''}
              placeholder="Partner"
              onChange={(value) => setPartnerDisplayName(value.length ? value : undefined)}
            />
          </View>
        </View>
      </View>

      <View className="w-full items-center gap-1 px-2">
        {affinity != null ? (
          Platform.OS === 'web' ? (
            <Text
              className="font-headline text-[44px] text-primary"
              adjustsFontSizeToFit
              numberOfLines={1}
              minimumFontScale={0.7}>
              {affinity}%
            </Text>
          ) : (
            <GradientText className="font-headline text-[44px] font-semibold">{affinity}%</GradientText>
          )
        ) : (
          <Text className="font-headline text-[36px] text-on-surface-variant/40">—</Text>
        )}
        {strength && palmReady ? (
          <Text className="font-body-medium text-[15px] text-primary">{strength}</Text>
        ) : null}
        {!palmReady ? (
          <Text className="mt-1 text-center font-body text-[13px] leading-5 text-on-surface-variant">
            {!selfPalm
              ? 'Add your palm reading first.'
              : `Tap + on ${partnerNameForCopy ? `${partnerLabel}'s` : "your partner's"} palm to scan or upload a photo.`}
          </Text>
        ) : null}
      </View>

      {summary ? (
        <GlassCard className="p-4">
          <Text className="font-label text-[11px] uppercase tracking-[0.1em] text-on-surface-variant">Summary</Text>
          <Text className="mt-2 font-body text-[14px] leading-6 text-on-surface">{summary}</Text>
        </GlassCard>
      ) : null}

      {dimensions ? (
        <View className="gap-3">
          {dimensions.map((d) => (
            <MetricBar key={d.key} label={d.label} pct={d.pct} />
          ))}
        </View>
      ) : null}

      {onOpenGuide && palmReady ? (
        <CosmicButton gradient="nebulaMd3" label="Ask the Guide" onPress={onOpenGuide} />
      ) : null}

      <PartnerPalmAddSheet
        visible={addSheetOpen}
        partnerLabel={partnerLabel}
        busy={uploadBusy}
        onClose={() => setAddSheetOpen(false)}
        onScan={openPartnerScan}
        onUpload={() => void uploadPartnerPalm()}
      />
    </View>
  );
}

function PalmCircle({
  label,
  tint,
  showAdd,
  busy,
  onPress,
  onRemove,
}: {
  label: string;
  tint: 'cyan' | 'violet';
  showAdd?: boolean;
  busy?: boolean;
  onPress: () => void;
  onRemove?: () => void;
}) {
  const border = tint === 'cyan' ? 'border-primary/40' : 'border-purple/45';
  const gradientColors =
    tint === 'cyan'
      ? (['rgba(34,211,238,0.35)', 'rgba(34,211,238,0.15)'] as const)
      : (['rgba(168,85,247,0.4)', 'rgba(168,85,247,0.2)'] as const);

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={
        showAdd ? `Add ${label.toLowerCase()} palm` : `Open ${label.toLowerCase()} palm`
      }
      className="active:opacity-85">
      <View className={`relative h-[76px] w-[76px] overflow-visible rounded-full border-2 ${border}`}>
        <LinearGradient
          colors={gradientColors}
          style={{ flex: 1, borderRadius: 38, alignItems: 'center', justifyContent: 'center' }}>
          {showAdd ? (
            <Icon name="add" size={34} color={colors.onSurface} />
          ) : (
            <Icon name="front_hand" size={32} color={colors.onSurface} />
          )}
        </LinearGradient>
        {onRemove ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onRemove();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Remove partner palm"
            className="absolute -right-1 -top-1 h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-surface-container-high active:opacity-80">
            <Icon name="close" size={14} color={colors.onSurface} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function EditablePartnerLabel({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const display = value.trim() || placeholder;

  return (
    <View className="flex-row items-center justify-center gap-1">
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="rgba(230, 225, 229, 0.45)"
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        maxLength={24}
        accessibilityLabel="Partner name"
        className="shrink px-0.5 text-center font-body-medium text-[13px] font-semibold leading-4 text-on-surface"
        style={{ minWidth: 52, maxWidth: 80, minHeight: 44, paddingVertical: 12 }}
      />
      <Pressable
        onPress={() => inputRef.current?.focus()}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${display}`}
        className="h-6 w-6 shrink-0 items-center justify-center rounded-full border border-purple/45 bg-purple/20 active:opacity-80">
        <Icon name="edit" size={12} color={colors.purple} />
      </Pressable>
    </View>
  );
}

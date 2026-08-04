import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MotiView } from 'moti';

import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { colors } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import type { InsightSection } from '@/types/report';

type ReportInsightCardProps = {
  insight: InsightSection;
  /** Controlled expand — when set, parent owns open/close (accordion). */
  expanded?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
};

/**
 * Report section insight — collapsed teaser with ellipsis, expands to full detail.
 * Close with the X; opening another card (controlled) collapses this one.
 */
export function ReportInsightCard({ insight, expanded, onOpen, onClose }: ReportInsightCardProps) {
  const reduceMotion = useReduceMotion();
  const controlled = typeof expanded === 'boolean';
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlled ? expanded : internalOpen;

  useEffect(() => {
    if (controlled) return;
    setInternalOpen(false);
  }, [insight.id, controlled]);

  const openCard = useCallback(() => {
    if (controlled) {
      onOpen?.();
      return;
    }
    setInternalOpen(true);
  }, [controlled, onOpen]);

  const closeCard = useCallback(() => {
    if (controlled) {
      onClose?.();
      return;
    }
    setInternalOpen(false);
  }, [controlled, onClose]);

  const toneLabel = insight.tone
    ? insight.tone.replace(/_/g, ' ')
    : 'Insight';

  return (
    <MotiView
      animate={{
        scale: open ? 1 : 0.995,
        opacity: 1,
      }}
      transition={
        reduceMotion
          ? { type: 'timing', duration: 0 }
          : { type: 'spring', damping: 18, stiffness: 220 }
      }
      style={{ width: '100%' }}>
      <GlassCard
        className="w-full overflow-hidden"
        muted={!open}
        glow={open}
        innerClassName="gap-2 p-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 gap-2">
            <Text className="font-label text-[12px] uppercase tracking-[0.12em] text-primary">
              {toneLabel}
            </Text>
            <Text className="font-headline-md text-[18px] leading-6 text-on-surface">
              {insight.title}
            </Text>
          </View>
          {open ? (
            <Pressable
              onPress={closeCard}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Close ${insight.title}`}
              className="h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] active:opacity-80">
              <Icon name="close" size={18} color={colors.onSurface} />
            </Pressable>
          ) : (
            <Pressable
              onPress={openCard}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Open ${insight.title}`}
              className="h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] active:opacity-80">
              <Icon name="chevron_right" size={18} color={colors.primary} />
            </Pressable>
          )}
        </View>

        {!open ? (
          <Pressable
            onPress={openCard}
            accessibilityRole="button"
            accessibilityLabel={`${insight.title}. Tap to read full insight`}
            accessibilityHint="Expands this card with the full reading">
            <Text
              className="font-body text-[15px] leading-6 text-on-surface-variant"
              numberOfLines={3}>
              {insight.body}
            </Text>
          </Pressable>
        ) : (
          <MotiView
            from={reduceMotion ? undefined : { opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={
              reduceMotion
                ? { type: 'timing', duration: 0 }
                : { type: 'timing', duration: 280 }
            }>
            <Text className="mt-1 font-body text-[15px] leading-7 text-on-surface/90">
              {insight.body}
            </Text>
          </MotiView>
        )}
      </GlassCard>
    </MotiView>
  );
}

/** @deprecated Use ReportInsightCard — kept for existing report/preview imports. */
export const InsightCard = ReportInsightCard;

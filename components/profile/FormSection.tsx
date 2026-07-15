import type { PropsWithChildren, ReactNode } from 'react';
import { Text, View } from 'react-native';

import { MotiView } from '@/components/moti/MotiView';
import { GlassCard } from '@/components/ui';

type FormSectionProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  /** Extra content below the subtitle (e.g. helper chips). */
  accessory?: ReactNode;
  /** Soft aurora fill inside the card. Default true. */
  glass?: boolean;
  muted?: boolean;
  glow?: boolean;
  /** Stagger index for entrance animation. */
  index?: number;
  className?: string;
  contentClassName?: string;
}>;

/**
 * Grouped settings section — title hierarchy + glass card body.
 * Used by Edit Profile and similar structured settings screens.
 */
export function FormSection({
  title,
  subtitle,
  accessory,
  glass = true,
  muted = false,
  glow = false,
  index = 0,
  className = '',
  contentClassName = '',
  children,
}: FormSectionProps) {
  const body = glass ? (
    <GlassCard muted={muted} glow={glow} className={`p-5 ${contentClassName}`}>
      {children}
    </GlassCard>
  ) : (
    <View className={contentClassName}>{children}</View>
  );

  return (
    <MotiView
      from={{ opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 420, delay: 80 + index * 70 }}
      className={`w-full gap-3 ${className}`}>
      <View className="w-full gap-1.5 px-0.5">
        <Text
          className="font-headline text-[22px] leading-7 text-on-surface"
          accessibilityRole="header"
          maxFontSizeMultiplier={1.35}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="font-body text-[14px] leading-6 text-on-surface-variant"
            maxFontSizeMultiplier={1.4}>
            {subtitle}
          </Text>
        ) : null}
        {accessory}
      </View>
      {body}
    </MotiView>
  );
}

import type { PropsWithChildren, ReactNode } from 'react';

import { MotiView } from '@/components/moti/MotiView';
import { SectionHeader } from '@/components/feedback';
import { GlassCard } from '@/components/ui';

type SettingsSectionProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  /** Stagger index for entrance animation. */
  index?: number;
  accessory?: ReactNode;
}>;

/**
 * Grouped settings block — shared SectionHeader + muted glass list shell.
 * Never glows; primary actions glow elsewhere.
 */
export function SettingsSection({
  title,
  subtitle,
  index = 0,
  accessory,
  children,
}: SettingsSectionProps) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 400, delay: 60 + index * 55 }}
      className="w-full"
      style={{ gap: 12 }}>
      <SectionHeader title={title} subtitle={subtitle} />
      {accessory}
      <GlassCard muted className="w-full px-3.5 py-0.5">
        {children}
      </GlassCard>
    </MotiView>
  );
}

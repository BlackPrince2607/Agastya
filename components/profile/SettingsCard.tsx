import type { PropsWithChildren } from 'react';

import { GlassCard } from '@/components/ui';

type SettingsCardProps = PropsWithChildren<{
  muted?: boolean;
  glow?: boolean;
  className?: string;
}>;

/**
 * Settings surface card — glass container used inside FormSection or alone.
 */
export function SettingsCard({ muted, glow, className = 'p-5', children }: SettingsCardProps) {
  return (
    <GlassCard muted={muted} glow={glow} className={className}>
      {children}
    </GlassCard>
  );
}

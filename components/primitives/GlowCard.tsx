import type { PropsWithChildren } from 'react';
import { type ViewProps } from 'react-native';

import { GlassCard } from '@/components/ui/GlassCard';

type GlowCardProps = PropsWithChildren<ViewProps & { muted?: boolean }>;

/**
 * Legacy glow card — delegates to GlassCard so every surface shares one language.
 * Prefer importing GlassCard directly in new code.
 */
export function GlowCard({ muted, className, children, ...rest }: GlowCardProps) {
  return (
    <GlassCard muted={muted} glow={!muted} className={className ?? 'p-5'} {...rest}>
      {children}
    </GlassCard>
  );
}

import type { ReactNode } from 'react';

import { PrimaryButton } from '@/components/ui';

type CosmicButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  /** Primary fill — mapped onto PrimaryButton variants for one CTA language. */
  gradient?: 'pulse' | 'nebulaMd3';
  disabled?: boolean;
  /** Shown before label on primary buttons */
  icon?: ReactNode;
};

/**
 * Legacy button API — thin alias over PrimaryButton so older screens stay
 * consistent with the shared nebula CTA system.
 */
export function CosmicButton({
  label,
  onPress,
  variant = 'primary',
  gradient = 'nebulaMd3',
  disabled,
  icon,
}: CosmicButtonProps) {
  if (variant === 'ghost') {
    return <PrimaryButton label={label} onPress={onPress} variant="ghost" disabled={disabled} icon={icon} />;
  }

  // pulse historically meant brand accent; map to high-impact CTA. nebulaMd3 → primary.
  const mapped = gradient === 'pulse' ? 'cta' : 'primary';
  return <PrimaryButton label={label} onPress={onPress} variant={mapped} disabled={disabled} icon={icon} />;
}

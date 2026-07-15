import type { ReactNode } from 'react';

import { NebulaButton } from '@/components/ui/NebulaButton';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'cta' | 'ghost';
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
};

/**
 * Canonical primary action for the design system.
 * Wraps NebulaButton so screens share one CTA vocabulary.
 */
export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  icon,
  className,
}: PrimaryButtonProps) {
  const mapped = variant === 'primary' ? 'nebula' : variant;
  return (
    <NebulaButton
      label={label}
      onPress={onPress}
      variant={mapped}
      disabled={disabled}
      icon={icon}
      className={className}
    />
  );
}

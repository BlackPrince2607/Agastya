import type { ReactNode } from 'react';

import { PrimaryButton } from '@/components/ui';

type PrimaryGradientButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
};

/**
 * Named alias for the nebula gradient CTA — keeps Edit Profile vocabulary explicit.
 */
export function PrimaryGradientButton({
  label,
  onPress,
  disabled,
  icon,
  className,
}: PrimaryGradientButtonProps) {
  return (
    <PrimaryButton
      label={label}
      onPress={onPress}
      variant="primary"
      disabled={disabled}
      icon={icon}
      className={className}
    />
  );
}

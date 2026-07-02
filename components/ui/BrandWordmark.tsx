import { gradients } from '@/constants/theme';
import { GradientText } from '@/components/primitives/GradientText';

type BrandWordmarkProps = {
  className?: string;
  /** `sm` for onboarding headers; `md` (default) for main app bar. */
  size?: 'sm' | 'md';
};

const sizeClass = {
  sm: 'text-[13px] tracking-[0.18em]',
  md: 'text-xl tracking-[0.18em]',
} as const;

/** "Agastya" wordmark with the cyan→purple brand gradient (Stitch top bar). */
export function BrandWordmark({ className, size = 'md' }: BrandWordmarkProps) {
  return (
    <GradientText
      gradient={gradients.brand}
      className={`font-headline uppercase ${sizeClass[size]} ${className ?? ''}`}>
      Agastya
    </GradientText>
  );
}

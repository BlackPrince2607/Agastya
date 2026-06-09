import { gradients } from '@/constants/theme';
import { GradientText } from '@/components/primitives/GradientText';

type BrandWordmarkProps = {
  className?: string;
};

/** "Agastya" wordmark with the cyan→purple brand gradient (Stitch top bar). */
export function BrandWordmark({ className }: BrandWordmarkProps) {
  return (
    <GradientText
      gradient={gradients.brand}
      className={`font-headline text-xl uppercase tracking-[0.18em] ${className ?? ''}`}>
      Agastya
    </GradientText>
  );
}

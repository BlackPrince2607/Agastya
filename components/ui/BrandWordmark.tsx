import { Image, View } from 'react-native';

import { gradients } from '@/constants/theme';
import { GradientText } from '@/components/primitives/GradientText';

type BrandWordmarkProps = {
  className?: string;
  /** `sm` for onboarding headers; `md` (default) for main app bar. */
  size?: 'sm' | 'md';
  /** Show the Hamsa mark beside the wordmark. Default true. */
  showMark?: boolean;
};

const sizeClass = {
  sm: 'text-[13px] tracking-[0.18em]',
  md: 'text-xl tracking-[0.18em]',
} as const;

const markSize = {
  sm: 22,
  md: 28,
} as const;

/** "Agastya" wordmark with the cyan→purple brand gradient (Stitch top bar). */
export function BrandWordmark({ className, size = 'md', showMark = true }: BrandWordmarkProps) {
  const px = markSize[size];

  return (
    <View className={`flex-row items-center gap-2 ${className ?? ''}`}>
      {showMark ? (
        <Image
          source={require('../../assets/images/agastya-logo.png')}
          accessibilityLabel="Agastya"
          style={{ width: px, height: px, borderRadius: px / 2 }}
          resizeMode="cover"
        />
      ) : null}
      <GradientText
        gradient={gradients.brand}
        className={`font-headline uppercase ${sizeClass[size]}`}>
        Agastya
      </GradientText>
    </View>
  );
}

import { memo } from 'react';
import { View } from 'react-native';

import { MotiView } from '@/components/moti/MotiView';

type SkeletonBlockProps = {
  height?: number;
  width?: number | `${number}%`;
  radius?: number;
  className?: string;
};

/**
 * Soft shimmer placeholder — prefer over plain spinners for content regions.
 */
function SkeletonBlockComponent({ height = 16, width = '100%', radius = 12, className }: SkeletonBlockProps) {
  return (
    <View
      className={`overflow-hidden bg-white/[0.06] ${className ?? ''}`}
      style={{ height, width, borderRadius: radius }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <MotiView
        from={{ opacity: 0.35, translateX: -24 }}
        animate={{ opacity: 0.7, translateX: 24 }}
        transition={{ type: 'timing', duration: 1100, loop: true }}
        style={{
          height: '100%',
          width: '55%',
          backgroundColor: 'rgba(211,190,235,0.18)',
          borderRadius: radius,
        }}
      />
    </View>
  );
}

export const SkeletonBlock = memo(SkeletonBlockComponent);

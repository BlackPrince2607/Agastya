import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PAGE_PADDING } from '@/constants/layout';

type StickyActionBarProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  horizontalPadding?: number;
  bottomPadding?: number;
}>;

export const STICKY_ACTION_BAR_SINGLE = 128;
export const STICKY_ACTION_BAR_COMFORTABLE = 188;

/** Bottom dock for onboarding CTAs with a strong scrim for readability. */
export function StickyActionBar({
  children,
  style,
  contentStyle,
  horizontalPadding = PAGE_PADDING,
  bottomPadding = 16,
}: StickyActionBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[styles.root, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(15,14,16,0)', 'rgba(9,8,11,0.82)', 'rgba(9,8,11,0.98)']}
        locations={[0, 0.58, 1]}
        style={styles.scrim}
      />
      <View
        style={[
          styles.panel,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: Math.max(insets.bottom, bottomPadding),
          },
          contentStyle,
        ]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    elevation: 30,
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -48,
    height: 48,
  },
  panel: {
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(9,8,11,0.98)',
    paddingTop: 18,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -8 },
  },
});

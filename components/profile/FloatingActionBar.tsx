import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PAGE_PADDING, TAB_BAR_CLEARANCE } from '@/constants/layout';

type FloatingActionBarProps = PropsWithChildren<{
  /** Extra space above the tab bar (main tabs). Set 0 for full-screen flows. */
  tabBarClearance?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}>;

/**
 * Glass sticky footer for main-tab screens (sits above the floating tab bar).
 */
export function FloatingActionBar({
  children,
  tabBarClearance = TAB_BAR_CLEARANCE,
  style,
  contentStyle,
}: FloatingActionBarProps) {
  const insets = useSafeAreaInsets();
  const tabBarInset = Math.max(insets.bottom, Platform.OS === 'web' ? 14 : 10);
  const bottom = tabBarClearance + tabBarInset;

  return (
    <View pointerEvents="box-none" style={[styles.root, { bottom }, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(15,14,16,0)', 'rgba(15,14,16,0.72)', 'rgba(15,14,16,0.94)']}
        locations={[0, 0.45, 1]}
        style={styles.scrim}
      />
      <View
        style={[
          styles.panel,
          {
            paddingHorizontal: PAGE_PADDING,
            paddingBottom: 14,
          },
          contentStyle,
        ]}>
        {children}
      </View>
    </View>
  );
}

/** Panel + button height (excludes tab-bar lift). */
export const FLOATING_ACTION_BAR_HEIGHT = 100;

/**
 * Full scroll bottom inset so content clears the docked Save bar + tab bar.
 * Pass into OnboardingScroll / MainTabScroll `bottomInset`.
 */
export function useFloatingActionBarScrollInset(extraPadding = 28) {
  const insets = useSafeAreaInsets();
  const tabBarInset = Math.max(insets.bottom, Platform.OS === 'web' ? 14 : 10);
  // OnboardingScroll also adds insets.bottom — tab clearance + panel is enough here.
  return TAB_BAR_CLEARANCE + tabBarInset + FLOATING_ACTION_BAR_HEIGHT + extraPadding;
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
    elevation: 30,
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -40,
    height: 40,
  },
  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(15,14,16,0.88)',
    paddingTop: 14,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -10 },
    elevation: 16,
  },
});

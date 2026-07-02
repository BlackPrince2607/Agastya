import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { ScanFrameCorners } from '@/components/onboarding/ScanFrameCorners';
import { ScanLine } from '@/components/onboarding/ScanLine';
import { stitchSignal } from '@/constants/theme';
import type { PalmScanHand } from '@/store/sessionStore';

type PalmScanFrameProps = {
  size?: number;
  hand?: PalmScanHand | null;
  showScanLine?: boolean;
  /** Rounded inner frame + gradient. */
  showInnerGuide?: boolean;
  cornerColor?: string;
};

const DEFAULT_SIZE = 300;

/** Palm scan framing guide — corner brackets + inner frame only (no hand silhouette). */
export function PalmScanFrame({
  size = DEFAULT_SIZE,
  hand = 'right',
  showScanLine = true,
  showInnerGuide = true,
  cornerColor = stitchSignal,
}: PalmScanFrameProps) {
  const resolved = hand ?? 'right';
  const mirror = resolved === 'left';
  const innerW = size - 48;
  const innerH = innerW * 1.22;
  const frameH = size * 1.05;

  return (
    <View style={[styles.outer, { width: size, height: size * 1.08 }]}>
      <View
        style={{
          width: size,
          height: frameH,
          // Always pass a transform array — toggling undefined crashes RN processTransform.
          transform: [{ scaleX: mirror ? -1 : 1 }],
        }}>
        <ScanFrameCorners size={size} color={cornerColor} bracket={32} />
        {showInnerGuide ? (
          <View pointerEvents="none" style={[styles.innerGuideWrap, { top: (frameH - innerH) / 2 - 4 }]}>
            <View
              style={{
                width: innerW,
                height: innerH,
                borderRadius: 28,
                overflow: 'hidden',
                borderWidth: 2,
                borderColor: 'rgba(34,211,238,0.45)',
              }}>
              <LinearGradient
                colors={['rgba(34,211,238,0.16)', 'transparent', 'rgba(168,85,247,0.12)']}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={{ flex: 1 }}
              />
              {showScanLine ? <ScanLine width={innerW} height={innerH} color="#22d3ee" /> : null}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerGuideWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

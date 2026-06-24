import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ScanFrameCorners } from '@/components/onboarding/ScanFrameCorners';
import { ScanLine } from '@/components/onboarding/ScanLine';
import { stitchSignal } from '@/constants/theme';
import type { PalmScanHand } from '@/store/sessionStore';

type PalmScanFrameProps = {
  size?: number;
  hand?: PalmScanHand | null;
  showScanLine?: boolean;
  cornerColor?: string;
};

const DEFAULT_SIZE = 300;

/** Palm-shaped framing guide with optional left-hand mirroring. */
export function PalmScanFrame({
  size = DEFAULT_SIZE,
  hand = 'right',
  showScanLine = true,
  cornerColor = stitchSignal,
}: PalmScanFrameProps) {
  const resolved = hand ?? 'right';
  const mirror = resolved === 'left';
  const innerW = size - 48;
  const innerH = innerW * 1.22;

  return (
    <View className="items-center justify-center" style={{ width: size, height: size * 1.08 }}>
      <View
        style={{
          width: size,
          height: size * 1.05,
          transform: mirror ? [{ scaleX: -1 }] : undefined,
        }}>
        <ScanFrameCorners size={size} color={cornerColor} bracket={32} />
        <View
          pointerEvents="none"
          className="absolute left-0 right-0 items-center justify-center"
          style={{ top: (size * 1.05 - innerH) / 2 - 4 }}>
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
            <View className="absolute inset-0 items-center justify-center opacity-35">
              <Svg width={innerW * 0.72} height={innerH * 0.82} viewBox="0 0 120 150">
                <Path
                  d="M60 8 C42 8 28 22 26 40 L22 88 C20 108 32 128 52 138 C56 140 64 140 68 138 C88 128 100 108 98 88 L94 40 C92 22 78 8 60 8 Z M38 52 C36 44 40 36 46 34 C50 32 54 36 54 42 L56 72 C56 78 50 82 44 80 C40 78 38 72 38 66 Z M52 48 C50 40 54 32 60 30 C66 32 70 40 68 48 L70 78 C70 84 64 88 58 86 C54 84 52 78 52 72 Z M66 50 C64 42 68 34 74 32 C80 34 84 42 82 50 L84 80 C84 86 78 90 72 88 C68 86 66 80 66 74 Z M80 56 C78 48 82 40 88 38 C94 40 98 48 96 56 L98 86 C98 92 92 96 86 94 C82 92 80 86 80 80 Z"
                  fill="none"
                  stroke="rgba(34,211,238,0.55)"
                  strokeWidth={2}
                />
              </Svg>
            </View>
            {showScanLine ? <ScanLine key={resolved} width={innerW} height={innerH} color="#22d3ee" /> : null}
          </View>
        </View>
      </View>
    </View>
  );
}

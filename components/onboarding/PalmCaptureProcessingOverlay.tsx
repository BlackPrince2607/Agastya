import { Text, View } from 'react-native';

import { ScanLine } from '@/components/onboarding/ScanLine';
import { GradientText } from '@/components/primitives';
import { colors } from '@/constants/theme';

type PalmCaptureProcessingOverlayProps = {
  frameSize: number;
  label?: string;
};

/** Full-screen overlay shown briefly after capture while the scan animation plays. */
export function PalmCaptureProcessingOverlay({
  frameSize,
  label = 'Analyzing capture',
}: PalmCaptureProcessingOverlayProps) {
  return (
    <View className="absolute inset-0 z-20 items-center justify-center bg-black/80">
      <View className="items-center gap-5 px-8">
        <GradientText className="font-label text-[12px] uppercase tracking-[0.14em] text-stitch-signal">
          {label}
        </GradientText>
        <View
          className="items-center justify-center overflow-hidden rounded-2xl border border-stitch-signal/40 bg-black/50"
          style={{ width: frameSize + 16, height: Math.round(frameSize * 1.28) }}>
          <ScanLine width={frameSize} height={Math.round(frameSize * 1.28)} color={colors.primary} />
        </View>
        <Text className="text-center font-body text-[15px] leading-6 text-on-surface-variant">
          Mapping palm lines and contours…
        </Text>
      </View>
    </View>
  );
}

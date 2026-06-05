import { View } from 'react-native';

import { stitchSignal } from '@/constants/theme';

type ScanFrameCornersProps = {
  size: number;
  color?: string;
  stroke?: number;
  bracket?: number;
};

/** Cyan corner brackets for the palm framing guide */
export function ScanFrameCorners({
  size,
  color = stitchSignal,
  stroke = 3,
  bracket = 28,
}: ScanFrameCornersProps) {
  const corner = (position: 'tl' | 'tr' | 'bl' | 'br') => {
    const base = {
      position: 'absolute' as const,
      width: bracket,
      height: bracket,
      borderColor: color,
    };
    const lines = {
      tl: { ...base, left: 0, top: 0, borderLeftWidth: stroke, borderTopWidth: stroke, borderTopLeftRadius: 4 },
      tr: { ...base, right: 0, top: 0, borderRightWidth: stroke, borderTopWidth: stroke, borderTopRightRadius: 4 },
      bl: { ...base, left: 0, bottom: 0, borderLeftWidth: stroke, borderBottomWidth: stroke, borderBottomLeftRadius: 4 },
      br: { ...base, right: 0, bottom: 0, borderRightWidth: stroke, borderBottomWidth: stroke, borderBottomRightRadius: 4 },
    };
    return <View style={lines[position]} />;
  };

  return (
    <View style={{ width: size, height: size }} className="relative">
      {corner('tl')}
      {corner('tr')}
      {corner('bl')}
      {corner('br')}
    </View>
  );
}

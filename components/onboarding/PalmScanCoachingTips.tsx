import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, Text, View } from 'react-native';

import { PALM_SCAN_TIPS } from '@/constants/userCopy';
import { stitchMd3 } from '@/constants/stitchWelcome';

type PalmScanCoachingTipsProps = {
  compact?: boolean;
};

/** Static coaching chips for palm capture (lighting, framing). */
export function PalmScanCoachingTips({ compact = false }: PalmScanCoachingTipsProps) {
  return (
    <View className={`flex-row justify-between gap-2 ${compact ? '' : 'mt-2'}`}>
      {PALM_SCAN_TIPS.map((tip) => (
        <View
          key={tip.label}
          className={`flex-1 items-center rounded-2xl border border-white/10 bg-white/[0.04] ${
            compact ? 'px-1.5 py-2' : 'px-2 py-3'
          }`}>
          <Ionicons name={tip.icon} size={compact ? 16 : 20} color={stitchMd3.primary} />
          <Text
            className={`mt-1.5 text-center font-label uppercase tracking-[0.1em] text-on-surface ${
              compact ? 'text-[9px]' : 'text-[10px]'
            }`}
            style={{
              lineHeight: compact ? 13 : 14,
              ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
            }}>
            {tip.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

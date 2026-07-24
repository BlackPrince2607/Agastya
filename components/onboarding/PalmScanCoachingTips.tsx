import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, Text, View } from 'react-native';

import { PALM_SCAN_TIPS } from '@/constants/userCopy';
import { stitchMd3 } from '@/constants/stitchWelcome';

type PalmScanCoachingTipsProps = {
  compact?: boolean;
  /** Highlight the live tip currently shown (0–3). Null = none active. */
  activeIndex?: number | null;
};

/** Static coaching chips for palm capture (lighting, framing). */
export function PalmScanCoachingTips({ compact = false, activeIndex = null }: PalmScanCoachingTipsProps) {
  return (
    <View className={`flex-row justify-between gap-2 ${compact ? '' : 'mt-2'}`}>
      {PALM_SCAN_TIPS.map((tip, index) => {
        const active = activeIndex === index;
        return (
          <View
            key={tip.label}
            className={`flex-1 items-center rounded-2xl border ${
              active ? 'border-cyan/45 bg-cyan/15' : 'border-white/10 bg-white/[0.04]'
            } ${compact ? 'px-1.5 py-2' : 'px-2 py-3'}`}>
            <Ionicons
              name={tip.icon}
              size={compact ? 16 : 20}
              color={active ? '#22d3ee' : stitchMd3.primary}
            />
            <Text
              className={`mt-1.5 text-center font-label uppercase tracking-[0.1em] ${
                active ? 'text-cyan' : 'text-on-surface'
              } ${compact ? 'text-[9px]' : 'text-[10px]'}`}
              style={{
                lineHeight: compact ? 13 : 14,
                ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
              }}>
              {tip.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

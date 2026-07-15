import { Platform, Text, View } from 'react-native';
import { colors } from '@/constants/theme';

import { GlassCard, Icon, type IconName } from '@/components/ui';

export type TrustBadge = { icon: IconName; label: string };

type TrustBadgeRowProps = {
  badges: TrustBadge[];
};

const ICON_SIZE = 22;
const ICON_BOX = 28;
const LABEL_LINE_HEIGHT = 14;
/** Two lines of micro label copy with comfortable padding inside the pill. */
const LABEL_BLOCK_MIN_HEIGHT = LABEL_LINE_HEIGHT * 2;

/** Horizontally aligned trust pills with centered icons and non-clipping label text. */
export function TrustBadgeRow({ badges }: TrustBadgeRowProps) {
  return (
    <View className="flex-row items-stretch gap-2.5">
      {badges.map((b) => (
        <GlassCard key={b.label} className="min-w-0 flex-1" innerClassName="flex-1 items-center px-2 py-3.5">
          <View
            className="items-center justify-center"
            style={{ width: ICON_BOX, height: ICON_BOX, marginBottom: 8 }}>
            <Icon name={b.icon} size={ICON_SIZE} color={colors.primary} />
          </View>
          <View className="w-full items-center justify-center" style={{ minHeight: LABEL_BLOCK_MIN_HEIGHT }}>
            <Text
              className="w-full text-center font-label text-[10px] uppercase tracking-[0.06em] text-on-surface"
              style={{
                lineHeight: LABEL_LINE_HEIGHT,
                ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
              }}
              numberOfLines={2}>
              {b.label}
            </Text>
          </View>
        </GlassCard>
      ))}
    </View>
  );
}

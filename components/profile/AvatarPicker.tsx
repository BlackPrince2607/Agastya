import { MotiView } from 'moti';
import { Image, Text, useWindowDimensions, View } from 'react-native';

import { PressableScale } from '@/components/ui';
import { AVATAR_OPTIONS, type AvatarId } from '@/constants/avatars';
import { colors } from '@/constants/theme';

type AvatarPickerProps = {
  value?: AvatarId | null;
  onChange: (id: AvatarId) => void;
  /** Compact label for embedded contexts. Default shows cosmic copy. */
  title?: string;
  subtitle?: string;
};

const COLS = 5;
const GAP = 14;

export function AvatarPicker({
  value,
  onChange,
  title = 'Choose your cosmic avatar',
  subtitle = 'This appears across your Agastya journey.',
}: AvatarPickerProps) {
  const { width } = useWindowDimensions();
  // Screen + card padding ≈ 48 + 40 — keep cells square and even.
  const cell = Math.min(78, Math.floor((Math.min(width, 480) - 88 - GAP * (COLS - 1)) / COLS));

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text
          className="font-label text-[12px] uppercase tracking-[0.14em] text-primary"
          maxFontSizeMultiplier={1.3}>
          {title}
        </Text>
        <Text
          className="font-body text-[14px] leading-5 text-on-surface-variant"
          maxFontSizeMultiplier={1.4}>
          {subtitle}
        </Text>
      </View>

      <View className="flex-row flex-wrap" style={{ gap: GAP }}>
        {AVATAR_OPTIONS.map((opt) => {
          const selected = value === opt.id;
          return (
            <PressableScale
              key={opt.id}
              onPress={() => onChange(opt.id)}
              scaleTo={0.92}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${opt.label} avatar`}
              accessibilityHint="Select this cosmic avatar for your profile"
              style={{ width: cell, height: cell }}>
              <MotiView
                animate={{
                  scale: selected ? 1.08 : 1,
                }}
                transition={{ type: 'spring', damping: 14, stiffness: 220 }}
                style={{
                  width: cell,
                  height: cell,
                  borderRadius: cell / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...(selected
                    ? {
                        shadowColor: colors.purple,
                        shadowOpacity: 0.55,
                        shadowRadius: 14,
                        shadowOffset: { width: 0, height: 4 },
                        elevation: 10,
                      }
                    : {}),
                }}>
                <MotiView
                  animate={{
                    borderColor: selected ? colors.purple : 'rgba(255,255,255,0.12)',
                    borderWidth: selected ? 2.5 : 1.5,
                  }}
                  transition={{ type: 'timing', duration: 200 }}
                  style={{
                    width: cell,
                    height: cell,
                    borderRadius: cell / 2,
                    overflow: 'hidden',
                    borderWidth: selected ? 2.5 : 1.5,
                    borderColor: selected ? colors.purple : 'rgba(255,255,255,0.12)',
                  }}>
                  <Image source={opt.source} style={{ width: cell, height: cell }} resizeMode="cover" />
                </MotiView>
              </MotiView>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

/** Alias matching Edit Profile vocabulary. */
export { AvatarPicker as AvatarSelector };

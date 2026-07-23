import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { Icon } from '@/components/ui';
import { colors, radii } from '@/constants/theme';

type ChatBubbleProps = {
  role: 'you' | 'guide';
  text: string;
  /** Hide Guide header when this bubble continues a previous guide message. */
  stacked?: boolean;
  /** Soften bottom corner when another guide bubble follows. */
  stacksNext?: boolean;
};

export function ChatBubble({ role, text, stacked = false, stacksNext = false }: ChatBubbleProps) {
  const isYou = role === 'you';

  if (isYou) {
    return (
      <View className="max-w-[82%] self-end" style={{ marginTop: stacked ? 3 : 12 }}>
        <LinearGradient
          colors={[colors.primary, colors.nebulaDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radii.md + 2,
            borderBottomRightRadius: stacksNext ? 10 : 5,
            borderTopRightRadius: stacked ? 10 : radii.md + 2,
          }}>
          <Text
            className="px-3.5 py-2.5 font-body text-[15px] leading-[22px]"
            style={{ color: colors.primaryContainer }}>
            {text}
          </Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View
      className="max-w-[86%] self-start"
      style={{ marginTop: stacked ? 3 : 12, gap: stacked ? 0 : 6 }}>
      {!stacked ? (
        <View className="flex-row items-center gap-1.5">
          <View
            className="h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-white/[0.05]"
            style={{ shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 8 }}>
            <Icon name="auto_awesome" size={11} color={colors.primary} />
          </View>
          <Text className="font-label text-[9px] uppercase tracking-[0.12em] text-on-primary-container">
            Agastya
          </Text>
        </View>
      ) : null}
      <View
        className="border border-white/10 bg-white/[0.06] px-3.5 py-2.5"
        style={{
          borderRadius: radii.md + 2,
          borderBottomLeftRadius: stacksNext ? 10 : 5,
          borderTopLeftRadius: stacked ? 10 : radii.md + 2,
        }}>
        <Text className="font-body text-[15px] leading-[22px] text-on-surface">{text}</Text>
      </View>
    </View>
  );
}

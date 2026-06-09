import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { Icon } from '@/components/ui';

type ChatBubbleProps = {
  role: 'you' | 'guide';
  text: string;
};

export function ChatBubble({ role, text }: ChatBubbleProps) {
  const isYou = role === 'you';

  if (isYou) {
    return (
      <View className="max-w-[85%] self-end">
        <LinearGradient
          colors={['#d3beeb', '#68577e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 24, borderBottomRightRadius: 6 }}>
          <Text className="px-4 py-3.5 font-body text-[15px] leading-6" style={{ color: '#1a0b2e' }}>
            {text}
          </Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View className="max-w-[88%] self-start gap-1.5">
      <View className="flex-row items-center gap-2">
        <View
          className="h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/[0.05]"
          style={{ shadowColor: '#d3beeb', shadowOpacity: 0.3, shadowRadius: 10 }}>
          <Icon name="auto_fix_high" size={15} color="#d3beeb" />
        </View>
        <Text className="font-label text-[10px] uppercase tracking-[0.2em] text-on-primary-container">Cosmos AI</Text>
      </View>
      <View className="rounded-glass rounded-tl-md border border-white/10 bg-white/[0.06] px-4 py-3.5">
        <Text className="font-body text-[15px] leading-6 text-on-surface">{text}</Text>
      </View>
    </View>
  );
}

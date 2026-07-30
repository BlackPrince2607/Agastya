import { Text, View } from 'react-native';

import { GlassCard, Icon } from '@/components/ui';
import { PressableScale } from '@/components/ui/PressableScale';
import { MotiView } from '@/components/moti/MotiView';
import { colors } from '@/constants/theme';

type ContinueConversationCardProps = {
  topic: string;
  onContinue: () => void;
};

/**
 * Resume last Guide chat when prior messages exist; otherwise not rendered by caller.
 */
export function ContinueConversationCard({ topic, onContinue }: ContinueConversationCardProps) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 450, delay: 160 }}>
      <PressableScale
        onPress={onContinue}
        accessibilityLabel="Continue your conversation"
        accessibilityHint={topic}
        scaleTo={0.98}>
        <GlassCard muted className="w-full" innerClassName="flex-row items-center gap-3 p-4">
          <View
            className="h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: 'rgba(168,85,247,0.16)' }}>
            <Icon name="auto_fix_high" size={22} color={colors.purple} />
          </View>
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="font-headline-md text-[16px] text-on-surface">Continue your conversation</Text>
            <Text className="font-body text-[13px] leading-5 text-on-surface-variant" numberOfLines={1}>
              {topic}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Text className="font-label text-[12px] tracking-[0.04em] text-primary">Continue</Text>
            <Icon name="arrow_forward" size={16} color={colors.primary} />
          </View>
        </GlassCard>
      </PressableScale>
    </MotiView>
  );
}

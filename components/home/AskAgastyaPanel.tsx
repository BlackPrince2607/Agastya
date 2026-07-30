import { Text, View } from 'react-native';

import { GlassCard, Icon, PrimaryButton } from '@/components/ui';
import { GlowContainer } from '@/components/ui/GlowContainer';
import { MotiView } from '@/components/moti/MotiView';
import { colors } from '@/constants/theme';

type AskAgastyaPanelProps = {
  onStart: () => void;
};

/**
 * Primary “Ask Agastya” CTA panel — routes to Chat.
 */
export function AskAgastyaPanel({ onStart }: AskAgastyaPanelProps) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 14 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 480, delay: 120 }}>
      <GlowContainer intensity="soft">
        <GlassCard glow className="w-full" innerClassName="gap-4 p-6">
          <View className="flex-row items-start gap-3">
            <View
              className="h-12 w-12 items-center justify-center rounded-2xl border border-white/10"
              style={{ backgroundColor: 'rgba(168,85,247,0.2)' }}>
              <Icon name="auto_fix_high" size={24} color={colors.purple} />
            </View>
            <View className="min-w-0 flex-1 gap-1">
              <Text className="font-headline text-[22px] leading-7 text-on-surface">Ask Agastya</Text>
              <Text className="font-body text-[15px] leading-6 text-on-surface-variant">
                Ask anything about your future, career, relationships or purpose.
              </Text>
            </View>
          </View>
          <PrimaryButton label="Start Conversation" onPress={onStart} variant="primary" />
        </GlassCard>
      </GlowContainer>
    </MotiView>
  );
}

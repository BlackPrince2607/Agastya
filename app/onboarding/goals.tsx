import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { StickyActionBar, STICKY_ACTION_BAR_COMFORTABLE } from '@/components/layout/StickyActionBar';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { CosmicButton } from '@/components/primitives';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { PAGE_PADDING } from '@/constants/layout';
import { stitchMd3 } from '@/constants/stitchWelcome';
import { triggerLightTap } from '@/hooks/useHapticTap';
import { syncProfileRemote } from '@/services/identity';
import { deferRouterPush } from '@/utils/routerDefer';
import type { FocusTopic } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';

const FOCUS_TOPIC_OPTIONS: Array<{
  id: FocusTopic;
  label: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
}> = [
  { id: 'love', label: 'Love & Relationships', icon: 'heart' },
  { id: 'career', label: 'Career & Success', icon: 'briefcase' },
  { id: 'money', label: 'Money & Abundance', icon: 'cash-multiple' },
  { id: 'growth', label: 'Personal Growth', icon: 'meditation' },
  { id: 'matching', label: 'Compatibility', icon: 'account-heart' },
];

export default function GoalsScreen() {
  const insets = useSafeAreaInsets();
  const topics = useSessionStore((s) => s.focusTopics);
  const setTopics = useSessionStore((s) => s.setFocusTopics);

  const toggle = (id: FocusTopic) => {
    void triggerLightTap();
    const next = topics.includes(id) ? topics.filter((t) => t !== id) : [...topics, id];
    setTopics(next);
  };

  const continueFlow = async () => {
    if (topics.length === 0) {
      Alert.alert(
        'Choose a focus',
        'Pick at least one area so we can focus your reading on what matters to you.',
      );
      return;
    }
    await syncProfileRemote();
    deferRouterPush('/onboarding/palm-scan');
  };

  return (
    <CosmicScreen>
      <View className="flex-1 overflow-hidden">
        <CosmicDotGrid />
        <View
          className="flex-1"
          style={{
            paddingBottom: insets.bottom + STICKY_ACTION_BAR_COMFORTABLE,
            paddingTop: 8,
            paddingHorizontal: PAGE_PADDING,
          }}>
          <OnboardingHeader step={ONBOARDING_STEPS.goals} total={ONBOARDING_TOTAL_STEPS} />

          <View className="mb-4 gap-2">
            <Text className="font-headline text-[26px] leading-8 tracking-tight text-on-surface">
              What do you want help with?
            </Text>
            <Text className="font-body text-[15px] leading-6 text-on-surface-variant">
              Pick every topic that applies — you can change these later.
            </Text>
          </View>

          <View className="flex-1 justify-center gap-2.5">
            {FOCUS_TOPIC_OPTIONS.map((opt) => {
              const picked = topics.includes(opt.id);
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => toggle(opt.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: picked }}
                  accessibilityLabel={opt.label}
                  className="active:opacity-95"
                  style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
                  <View
                    className={`flex-row items-center rounded-2xl border px-4 py-3.5 ${
                      picked ? 'bg-white/12' : 'bg-white/[0.06]'
                    }`}
                    style={
                      picked
                        ? {
                            borderColor: stitchMd3.primary,
                            shadowColor: stitchMd3.primary,
                            shadowOpacity: 0.22,
                            shadowRadius: 12,
                            shadowOffset: { width: 0, height: 0 },
                          }
                        : { borderColor: 'rgba(255,255,255,0.14)' }
                    }>
                    <View
                      className="mr-3 h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
                      style={{
                        backgroundColor: 'rgba(26,11,46,0.9)',
                        borderColor: picked ? 'rgba(211,190,235,0.45)' : 'rgba(255,255,255,0.12)',
                      }}>
                      <MaterialCommunityIcons
                        name={opt.icon}
                        size={22}
                        color={stitchMd3.primary}
                        style={{ opacity: picked ? 1 : 0.82 }}
                      />
                    </View>
                    <Text className="min-w-0 flex-1 font-headline-md text-[16px] leading-5 text-on-surface">
                      {opt.label}
                    </Text>
                    <MaterialCommunityIcons
                      name={picked ? 'check-circle' : 'checkbox-blank-circle-outline'}
                      size={22}
                      color={picked ? stitchMd3.primary : 'rgba(203,196,206,0.65)'}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <StickyActionBar contentStyle={{ gap: 8 }}>
          <CosmicButton gradient="nebulaMd3" label="Continue" onPress={() => void continueFlow()} />
        </StickyActionBar>
      </View>
    </CosmicScreen>
  );
}

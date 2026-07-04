import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { StickyActionBar, STICKY_ACTION_BAR_COMFORTABLE } from '@/components/layout/StickyActionBar';
import { OnboardingHeader } from '@/components/onboarding/OnboardingHeader';
import { CosmicButton } from '@/components/primitives';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { PAGE_PADDING } from '@/constants/layout';
import { stitchMd3 } from '@/constants/stitchWelcome';
import { syncProfileRemote } from '@/services/identity';
import { deferRouterPush } from '@/utils/routerDefer';
import type { FocusTopic } from '@/store/sessionStore';
import { useSessionStore } from '@/store/sessionStore';

const FOCUS_TOPIC_OPTIONS: Array<{
  id: FocusTopic;
  label: string;
  blurb: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
}> = [
  {
    id: 'love',
    label: 'Love & Relationships',
    blurb: 'Dating, relationships, and connection',
    icon: 'heart',
  },
  {
    id: 'career',
    label: 'Career & Success',
    blurb: 'Work, goals, and direction',
    icon: 'briefcase',
  },
  {
    id: 'money',
    label: 'Money & Abundance',
    blurb: 'Savings, income, and stability',
    icon: 'cash-multiple',
  },
  {
    id: 'growth',
    label: 'Personal Growth',
    blurb: 'Habits, learning, and self-understanding',
    icon: 'meditation',
  },
  {
    id: 'matching',
    label: 'Compatibility',
    blurb: 'See how you connect with someone else',
    icon: 'account-heart',
  },
];

export default function GoalsScreen() {
  const insets = useSafeAreaInsets();
  const topics = useSessionStore((s) => s.focusTopics);
  const setTopics = useSessionStore((s) => s.setFocusTopics);

  const toggle = (id: FocusTopic) => {
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

  const skipFlow = async () => {
    if (topics.length === 0) setTopics(['growth']);
    await syncProfileRemote();
    deferRouterPush('/onboarding/palm-scan');
  };

  return (
    <CosmicScreen>
      <View className="flex-1 overflow-hidden">
        <CosmicDotGrid />
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: insets.bottom + STICKY_ACTION_BAR_COMFORTABLE,
            paddingTop: 12,
            paddingHorizontal: PAGE_PADDING,
          }}>
          <View className="gap-8">
            <OnboardingHeader step={ONBOARDING_STEPS.goals} total={ONBOARDING_TOTAL_STEPS} />

            <View>
              <Text className="font-headline text-[30px] leading-[34px] tracking-tight text-on-surface">
                What do you want help with?
              </Text>
              <Text className="mt-4 max-w-md font-body text-[15px] leading-6 text-on-surface-variant">
                Your picks shape your reading. Select every topic that applies.
              </Text>
            </View>

            <View className="gap-4">
              {FOCUS_TOPIC_OPTIONS.map((opt) => {
                const picked = topics.includes(opt.id);
                return (
                  <Pressable key={opt.id} onPress={() => toggle(opt.id)} className="active:opacity-95">
                    <View
                      className={`flex-row items-center rounded-3xl border p-[18px] ${
                        picked ? 'bg-white/12' : 'bg-white/[0.06]'
                      }`}
                      style={
                        picked
                          ? {
                              borderColor: stitchMd3.primary,
                              shadowColor: stitchMd3.primary,
                              shadowOpacity: 0.28,
                              shadowRadius: 16,
                              shadowOffset: { width: 0, height: 0 },
                            }
                          : {
                              borderColor: 'rgba(255,255,255,0.14)',
                            }
                      }>
                      <View
                        className="mr-4 h-12 w-12 items-center justify-center rounded-2xl border"
                        style={{
                          backgroundColor: 'rgba(26,11,46,0.9)',
                          borderColor: picked ? 'rgba(211,190,235,0.45)' : 'rgba(255,255,255,0.12)',
                        }}>
                        <MaterialCommunityIcons
                          name={opt.icon}
                          size={26}
                          color={stitchMd3.primary}
                          style={{ opacity: picked ? 1 : 0.82 }}
                        />
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="font-headline-md text-[20px] leading-7 text-on-surface">{opt.label}</Text>
                        <Text className="mt-1 font-body text-[14px] leading-5 text-on-surface-variant">
                          {opt.blurb}
                        </Text>
                      </View>
                      <MaterialCommunityIcons
                        name={picked ? 'check-circle' : 'chevron-right'}
                        size={picked ? 26 : 22}
                        color={picked ? stitchMd3.primary : 'rgba(203,196,206,0.65)'}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <StickyActionBar contentStyle={{ gap: 10 }}>
          <Text className="text-center font-body text-[13px] leading-5 text-on-surface-variant">
            You can change these focus areas later in your profile.
          </Text>
          <Pressable accessibilityRole="button" onPress={() => void skipFlow()} className="items-center py-1.5">
            <Text className="font-label text-[12px] uppercase tracking-[0.12em] text-on-surface-variant">
              Skip for now
            </Text>
          </Pressable>
          <CosmicButton gradient="nebulaMd3" label="Continue" onPress={() => void continueFlow()} />
        </StickyActionBar>
      </View>
    </CosmicScreen>
  );
}

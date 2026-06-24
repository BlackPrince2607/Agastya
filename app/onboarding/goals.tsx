import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CosmicDotGrid } from '@/components/layout/CosmicDotGrid';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
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
    blurb: 'Relationships, soulmates & heart connection',
    icon: 'heart',
  },
  {
    id: 'career',
    label: 'Career & Success',
    blurb: 'Vocation, purpose & professional growth',
    icon: 'briefcase',
  },
  {
    id: 'money',
    label: 'Money & Abundance',
    blurb: 'Abundance, stability & financial flow',
    icon: 'cash-multiple',
  },
  {
    id: 'growth',
    label: 'Personal Growth',
    blurb: 'Personal evolution & spiritual journey',
    icon: 'meditation',
  },
  {
    id: 'matching',
    label: 'Compatibility',
    blurb: 'Compare your connection with someone special',
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
        'Pick at least one area so we can tailor your reading to what matters most to you right now.',
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
      <View className="flex-1">
        <CosmicDotGrid />
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 200, paddingTop: 12, paddingHorizontal: PAGE_PADDING }}>
          <View className="gap-8">
            <OnboardingHeader step={ONBOARDING_STEPS.goals} total={ONBOARDING_TOTAL_STEPS} />

            <View>
              <Text className="font-noto-serif text-[36px] leading-[40px] tracking-tight text-mist">
                What do you seek clarity on?
              </Text>
              <Text className="mt-4 max-w-md font-inter text-[16px] leading-6 text-md-on-surface-variant">
                Your choices help us tailor your astral insights and palm readings. Tap every theme that resonates.
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
                        <Text className="font-noto-serif-md text-[22px] leading-7 text-mist">{opt.label}</Text>
                        <Text className="mt-1 font-inter text-[14px] leading-5 text-md-on-surface-variant">
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

        <View
          className="absolute bottom-0 left-0 right-0 gap-4 border-t border-white/12 bg-[#0f0e10]/96 px-8 pt-6"
          style={{
            paddingBottom: Math.max(insets.bottom, 20),
            zIndex: 20,
            elevation: 24,
          }}>
          <CosmicButton gradient="nebulaMd3" label="Continue journey" onPress={() => void continueFlow()} />
          <Text className="text-center font-inter text-[13px] leading-5 text-md-on-surface-variant">
            You can change these focus areas later in your profile.
          </Text>
          <Pressable accessibilityRole="button" onPress={() => void skipFlow()} className="items-center py-2">
            <Text className="font-space-grotesk text-[12px] uppercase tracking-[0.16em] text-md-on-primary-container">
              Skip for now
            </Text>
          </Pressable>
        </View>
      </View>
    </CosmicScreen>
  );
}

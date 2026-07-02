import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { stitchMd3 } from '@/constants/stitchWelcome';
import type { FocusTopic } from '@/store/sessionStore';

const FOCUS_TOPIC_OPTIONS: Array<{
  id: FocusTopic;
  label: string;
  blurb: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
}> = [
  { id: 'love', label: 'Love & Relationships', blurb: 'Dating, relationships, and connection', icon: 'heart' },
  { id: 'career', label: 'Career & Success', blurb: 'Work, goals, and direction', icon: 'briefcase' },
  { id: 'money', label: 'Money & Abundance', blurb: 'Savings, income, and stability', icon: 'cash-multiple' },
  { id: 'growth', label: 'Personal Growth', blurb: 'Habits, learning, and self-understanding', icon: 'meditation' },
  { id: 'matching', label: 'Compatibility', blurb: 'See how you connect with someone else', icon: 'account-heart' },
];

type FocusTopicsPickerProps = {
  topics: FocusTopic[];
  onChange: (topics: FocusTopic[]) => void;
};

export function FocusTopicsPicker({ topics, onChange }: FocusTopicsPickerProps) {
  const toggle = (id: FocusTopic) => {
    const next = topics.includes(id) ? topics.filter((t) => t !== id) : [...topics, id];
    onChange(next);
  };

  return (
    <View className="gap-3">
      <Text className="font-label text-[12px] uppercase tracking-[0.14em] text-on-surface-variant">
        Focus areas
      </Text>
      {FOCUS_TOPIC_OPTIONS.map((opt) => {
        const picked = topics.includes(opt.id);
        return (
          <Pressable key={opt.id} onPress={() => toggle(opt.id)} className="active:opacity-95">
            <View
              className={`flex-row items-center rounded-2xl border p-4 ${
                picked ? 'bg-white/10' : 'bg-white/[0.05]'
              }`}
              style={{ borderColor: picked ? stitchMd3.primary : 'rgba(255,255,255,0.12)' }}>
              <View
                className="mr-3 h-10 w-10 items-center justify-center rounded-xl border"
                style={{
                  backgroundColor: 'rgba(26,11,46,0.9)',
                  borderColor: picked ? 'rgba(211,190,235,0.45)' : 'rgba(255,255,255,0.12)',
                }}>
                <MaterialCommunityIcons name={opt.icon} size={22} color={stitchMd3.primary} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-body-medium text-[15px] text-on-surface">{opt.label}</Text>
                <Text className="mt-0.5 font-body text-[12px] leading-5 text-on-surface-variant">{opt.blurb}</Text>
              </View>
              <MaterialCommunityIcons
                name={picked ? 'check-circle' : 'chevron-right'}
                size={picked ? 22 : 20}
                color={picked ? stitchMd3.primary : 'rgba(203,196,206,0.65)'}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function validateFocusTopics(topics: FocusTopic[]): string | null {
  if (topics.length === 0) {
    return 'Pick at least one focus area so your reading stays relevant.';
  }
  return null;
}

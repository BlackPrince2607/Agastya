import { Text, View } from 'react-native';

import { SelectionCard } from '@/components/profile/SelectionCard';
import type { IconName } from '@/components/ui';
import type { FocusTopic } from '@/store/sessionStore';

const FOCUS_TOPIC_OPTIONS: Array<{
  id: FocusTopic;
  label: string;
  blurb: string;
  icon: IconName;
}> = [
  { id: 'love', label: 'Love & Relationships', blurb: 'Dating, connection, and emotional bonds', icon: 'favorite' },
  { id: 'career', label: 'Career & Success', blurb: 'Work, ambition, and life direction', icon: 'work' },
  { id: 'money', label: 'Money & Abundance', blurb: 'Income, savings, and financial flow', icon: 'payments' },
  { id: 'growth', label: 'Personal Growth', blurb: 'Habits, learning, and self-understanding', icon: 'spa' },
  { id: 'matching', label: 'Compatibility', blurb: 'See how you resonate with someone else', icon: 'handshake' },
];

type FocusTopicsPickerProps = {
  topics: FocusTopic[];
  onChange: (topics: FocusTopic[]) => void;
  /** Hide the built-in section label when wrapped in FormSection. */
  hideLabel?: boolean;
};

export function FocusTopicsPicker({ topics, onChange, hideLabel = false }: FocusTopicsPickerProps) {
  const toggle = (id: FocusTopic) => {
    const next = topics.includes(id) ? topics.filter((t) => t !== id) : [...topics, id];
    onChange(next);
  };

  return (
    <View style={{ gap: 12 }}>
      {!hideLabel ? (
        <View className="gap-1">
          <Text className="font-label text-[12px] uppercase tracking-[0.14em] text-on-surface-variant">
            Focus areas
          </Text>
          <Text className="font-body text-[13px] leading-5 text-on-surface-variant">
            Select all that matter — you can choose more than one.
          </Text>
        </View>
      ) : null}

      {FOCUS_TOPIC_OPTIONS.map((opt) => {
        const picked = topics.includes(opt.id);
        return (
          <SelectionCard
            key={opt.id}
            title={opt.label}
            description={opt.blurb}
            icon={opt.icon}
            selected={picked}
            onPress={() => toggle(opt.id)}
            indicator="check"
            accessibilityLabel={opt.label}
            accessibilityHint={picked ? 'Deselect this focus area' : 'Add this focus area'}
          />
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

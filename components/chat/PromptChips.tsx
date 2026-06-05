import { Pressable, ScrollView, Text, View } from 'react-native';

const DEFAULT_PROMPTS = [
  'Will I find true love?',
  'Career advice please',
  'What should I focus on today?',
];

type PromptChipsProps = {
  prompts?: string[];
  onSelect: (text: string) => void;
};

export function PromptChips({ prompts = DEFAULT_PROMPTS, onSelect }: PromptChipsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
      {prompts.map((p) => (
        <Pressable key={p} onPress={() => onSelect(p)} className="active:opacity-85">
          <View className="rounded-full border border-white/14 bg-white/[0.06] px-4 py-2.5">
            <Text className="font-inter text-[13px] text-md-on-surface-variant">{p}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

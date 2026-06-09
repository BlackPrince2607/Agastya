import { Pressable, ScrollView, Text, View } from 'react-native';

type SuggestionChipsProps = {
  suggestions: string[];
  onSelect: (text: string) => void;
};

/** Horizontal scroll of contextual follow-up question chips (Stitch aura chips). */
export function SuggestionChips({ suggestions, onSelect }: SuggestionChipsProps) {
  if (suggestions.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
      {suggestions.map((s) => (
        <Pressable key={s} onPress={() => onSelect(s)} className="active:opacity-80">
          <View className="rounded-pill border border-white/15 bg-white/[0.05] px-4 py-2.5">
            <Text className="font-label text-[12px] uppercase tracking-[0.06em] text-secondary">{s}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

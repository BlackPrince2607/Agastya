import { Text, View } from 'react-native';

type StrengthDotsProps = {
  label: string;
  /** Filled dots out of 5. */
  value: number;
};

/** Stitch personality "Strengths" dot rating row. */
export function StrengthDots({ label, value }: StrengthDotsProps) {
  const filled = Math.max(0, Math.min(5, value));
  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-body text-[15px] text-on-surface">{label}</Text>
      <View className="flex-row gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: i < filled ? '#c084fc' : 'rgba(255,255,255,0.12)' }}
          />
        ))}
      </View>
    </View>
  );
}

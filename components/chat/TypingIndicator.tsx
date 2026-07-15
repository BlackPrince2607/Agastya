import { MotiView } from 'moti';
import { View } from 'react-native';

/** Compact typing dots matching the smaller guide bubble. */
export function TypingIndicator() {
  return (
    <View className="max-w-[86%] self-start">
      <View
        className="self-start border border-white/10 bg-white/[0.07] px-3.5 py-2.5"
        style={{ borderRadius: 18, borderBottomLeftRadius: 6 }}>
        <View className="flex-row items-center gap-1">
          {[0, 1, 2].map((i) => (
            <MotiView
              key={i}
              from={{ opacity: 0.3, translateY: 0 }}
              animate={{ opacity: 1, translateY: -3 }}
              transition={{
                type: 'timing',
                duration: 400,
                loop: true,
                repeatReverse: true,
                delay: i * 120,
              }}
              className="h-1.5 w-1.5 rounded-full bg-primary"
            />
          ))}
        </View>
      </View>
    </View>
  );
}

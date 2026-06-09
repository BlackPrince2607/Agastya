import { MotiView } from 'moti';
import { View } from 'react-native';

/** Three staggered bouncing dots inside a guide-style bubble. */
export function TypingIndicator() {
  return (
    <View className="max-w-[85%] self-start rounded-glass rounded-bl-md border border-white/10 bg-white/[0.07] px-5 py-4">
      <View className="flex-row items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <MotiView
            key={i}
            from={{ opacity: 0.3, translateY: 0 }}
            animate={{ opacity: 1, translateY: -4 }}
            transition={{
              type: 'timing',
              duration: 420,
              loop: true,
              repeatReverse: true,
              delay: i * 140,
            }}
            className="h-2 w-2 rounded-full bg-primary"
          />
        ))}
      </View>
    </View>
  );
}

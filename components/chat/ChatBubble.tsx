import { Text, View } from 'react-native';

type ChatBubbleProps = {
  role: 'you' | 'guide';
  text: string;
};

export function ChatBubble({ role, text }: ChatBubbleProps) {
  const isYou = role === 'you';

  return (
    <View className={`max-w-[92%] ${isYou ? 'self-end' : 'self-start'}`}>
      <View
        className={`rounded-3xl px-4 py-3.5 ${
          isYou ? 'rounded-br-md bg-stitch-violet/35' : 'rounded-bl-md border border-white/10 bg-white/[0.07]'
        }`}>
        <Text className="text-[15px] leading-6 text-mist">{text}</Text>
      </View>
    </View>
  );
}

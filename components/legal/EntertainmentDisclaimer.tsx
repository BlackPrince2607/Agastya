import { Text, View } from 'react-native';

export function EntertainmentDisclaimer({ dense }: { dense?: boolean }) {
  return (
    <View className={`rounded-3xl border border-white/12 bg-black/40 px-5 ${dense ? 'py-4' : 'py-5'}`}>
      <Text className="text-center text-[12px] font-medium text-md-on-surface-variant">Important</Text>
      <Text className="mt-2 text-center text-[13px] leading-6 text-md-on-surface-variant">
        Agastya offers palm readings and AI guidance for entertainment and self-reflection. It is not medical, legal,
        financial, or professional advice.
      </Text>
    </View>
  );
}

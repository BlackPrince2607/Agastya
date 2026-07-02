import { Text, View } from 'react-native';

export function EntertainmentDisclaimer({ dense }: { dense?: boolean }) {
  return (
    <View className={`rounded-3xl border border-white/12 bg-black/40 px-5 ${dense ? 'py-4' : 'py-5'}`}>
      <Text className="text-center font-label text-[12px] uppercase tracking-[0.1em] text-on-surface-variant">
        Important
      </Text>
      <Text className="mt-2 text-center font-body text-[13px] leading-6 text-on-surface-variant">
        Agastya is for self-reflection and fun. It is not medical, legal, financial, or professional advice.
      </Text>
    </View>
  );
}

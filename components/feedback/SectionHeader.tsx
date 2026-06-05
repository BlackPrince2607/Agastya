import { Text, View } from 'react-native';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  className?: string;
};

export function SectionHeader({ title, subtitle, className = '' }: SectionHeaderProps) {
  return (
    <View className={`w-full gap-1 ${className}`}>
      <Text className="font-inter-medium text-[15px] text-mist">{title}</Text>
      {subtitle ? (
        <Text className="text-[13px] leading-5 text-md-on-surface-variant">{subtitle}</Text>
      ) : null}
    </View>
  );
}

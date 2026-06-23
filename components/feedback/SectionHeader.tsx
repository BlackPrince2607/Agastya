import { Text, View } from 'react-native';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  className?: string;
};

/** Section label above grouped cards — consistent with design system. */
export function SectionHeader({ title, subtitle, className = '' }: SectionHeaderProps) {
  return (
    <View className={`w-full gap-1 px-0.5 ${className}`}>
      <Text className="font-headline-md text-[18px] text-on-surface">{title}</Text>
      {subtitle ? (
        <Text className="font-body text-[13px] leading-5 text-on-surface-variant">{subtitle}</Text>
      ) : null}
    </View>
  );
}

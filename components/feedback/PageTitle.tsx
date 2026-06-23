import { Text, View } from 'react-native';

type PageTitleProps = {
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  className?: string;
};

/** Consistent screen-level heading block. */
export function PageTitle({ title, subtitle, align = 'left', className = '' }: PageTitleProps) {
  const alignClass = align === 'center' ? 'items-center' : 'items-start';

  return (
    <View className={`w-full gap-1 ${alignClass} ${className}`}>
      <Text
        className={`font-headline text-[26px] leading-8 text-on-surface ${align === 'center' ? 'text-center' : ''}`}
        accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? (
        <Text
          className={`font-body text-[14px] leading-5 text-on-surface-variant ${align === 'center' ? 'text-center' : ''}`}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

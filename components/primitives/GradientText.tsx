import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { Platform, Text, type ColorValue, type StyleProp, type TextStyle } from 'react-native';

import { cosmicGradients } from '@/constants/theme';

type GradientStops = readonly [ColorValue, ColorValue, ...ColorValue[]];

type GradientTextProps = PropsWithChildren<{
  className?: string;
  gradient?: GradientStops;
  textStyle?: StyleProp<TextStyle>;
}>;

function gradientCss(stops: GradientStops): string {
  const [a, b, ...rest] = stops;
  const colors = [a, b, ...rest].join(', ');
  return `linear-gradient(135deg, ${colors})`;
}

/** Large display lines with ion → violet bleed */
export function GradientText({
  children,
  gradient = cosmicGradients.pulse,
  className,
  textStyle,
}: GradientTextProps) {
  if (Platform.OS === 'web') {
    return (
      <Text
        className={`font-semibold ${className ?? ''}`}
        style={[
          textStyle,
          {
            backgroundImage: gradientCss(gradient),
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            // Letter-spacing + background-clip often crops uppercase glyph tops on web.
            paddingTop: 3,
            paddingBottom: 1,
            overflow: 'visible',
          } as TextStyle,
        ]}>
        {children}
      </Text>
    );
  }

  return (
    <MaskedView maskElement={<Text className={`font-semibold ${className ?? ''}`}>{children}</Text>}>
      <LinearGradient colors={[...gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text className={`font-semibold opacity-0 ${className ?? ''}`} style={textStyle}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}

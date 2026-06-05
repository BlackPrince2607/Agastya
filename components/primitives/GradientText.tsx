import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import type { ColorValue } from 'react-native';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { cosmicGradients } from '@/constants/theme';

type GradientStops = readonly [ColorValue, ColorValue, ...ColorValue[]];

type GradientTextProps = PropsWithChildren<{
  className?: string;
  gradient?: GradientStops;
  textStyle?: StyleProp<TextStyle>;
}>;

/** Large display lines with ion → violet bleed */
export function GradientText({
  children,
  gradient = cosmicGradients.pulse,
  className,
  textStyle,
}: GradientTextProps) {
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

import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { View } from 'react-native';

type ScanLineProps = {
  /** Travel height in px (the frame inner height). */
  height: number;
  width: number;
  color?: string;
};

/** Looping cyan/lavender scan beam that sweeps top→bottom over the palm frame. */
export function ScanLine({ height, width, color = '#22d3ee' }: ScanLineProps) {
  return (
    <View pointerEvents="none" style={{ width, height, overflow: 'hidden' }} className="absolute">
      <MotiView
        from={{ translateY: 0 }}
        animate={{ translateY: height - 4 }}
        transition={{
          type: 'timing',
          duration: 1800,
          loop: true,
          repeatReverse: true,
        }}
        style={{ width: '100%' }}>
        <LinearGradient
          colors={['transparent', color, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ height: 3, width: '100%', opacity: 0.9 }}
        />
        <LinearGradient
          colors={[`${color}55`, 'transparent']}
          style={{ height: 40, width: '100%', marginTop: -1 }}
        />
      </MotiView>
    </View>
  );
}

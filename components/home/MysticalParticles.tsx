import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { MotiView } from '@/components/moti/MotiView';
import { useReduceMotion } from '@/hooks/useReduceMotion';

const PARTICLES = [
  { left: '12%', top: '18%', size: 3, delay: 0 },
  { left: '78%', top: '12%', size: 2.5, delay: 400 },
  { left: '88%', top: '48%', size: 2, delay: 900 },
  { left: '22%', top: '62%', size: 2.5, delay: 200 },
  { left: '55%', top: '28%', size: 2, delay: 700 },
  { left: '42%', top: '72%', size: 3, delay: 1100 },
] as const;

/**
 * Lightweight celestial particles for the home hero.
 * Absolute-fill, pointer-events none — no layout cost.
 */
function MysticalParticlesComponent() {
  const reduceMotion = useReduceMotion();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {PARTICLES.map((p, i) =>
        reduceMotion ? (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              borderRadius: 999,
              backgroundColor: 'rgba(211,190,235,0.45)',
              opacity: 0.35,
            }}
          />
        ) : (
          <MotiView
            key={i}
            from={{ opacity: 0.15, translateY: 0 }}
            animate={{ opacity: 0.55, translateY: -6 }}
            transition={{ type: 'timing', duration: 2800 + i * 180, loop: true, delay: p.delay }}
            style={{
              position: 'absolute',
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              borderRadius: 999,
              backgroundColor: 'rgba(211,190,235,0.85)',
            }}
          />
        ),
      )}
    </View>
  );
}

export const MysticalParticles = memo(MysticalParticlesComponent);

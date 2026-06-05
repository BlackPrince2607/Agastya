import { BlurView } from 'expo-blur';

export default function MainTabBarBlurBackground() {
  return (
    <BlurView
      tint="dark"
      intensity={68}
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 28,
        overflow: 'hidden',
      }}
    />
  );
}

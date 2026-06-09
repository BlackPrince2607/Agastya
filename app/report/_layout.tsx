import { Stack } from 'expo-router';

/** Pushed report stack: detailed report (tabbed) + compatibility. */
export default function ReportLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#0f0e10' },
      }}
    />
  );
}

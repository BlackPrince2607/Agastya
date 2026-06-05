import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { CosmicButton } from '@/components/primitives';

/** Web cannot use the camera reliably — explain and continue with preview analysis. */
export default function PalmScanWeb() {
  return (
    <CosmicScreen variant="stitch">
      <View className="flex-1 justify-center gap-6 px-8">
        <Text className="font-inter-medium text-[20px] text-mist">Palm scan on web</Text>
        <Text className="font-inter text-[15px] leading-6 text-md-on-surface-variant">
          For the best experience, use the Agastya app on your phone to scan your palm. On web, we&apos;ll prepare a
          preview reading so you can explore the product.
        </Text>
        <CosmicButton
          gradient="nebulaMd3"
          label="Continue with preview"
          onPress={() =>
            router.replace({ pathname: '/onboarding/analysis', params: { seed: 'web-preview' } })
          }
        />
      </View>
    </CosmicScreen>
  );
}

import { router, type Href } from 'expo-router';
import { Text, View } from 'react-native';

import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { AnimatedIcon } from '@/components/ui/AnimatedIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { paywallRouteParams } from '@/utils/paywallNavigation';
import { previewReportHref } from '@/utils/premiumAccess';

type PremiumLockGateProps = {
  title: string;
  body: string;
  returnLabel?: string;
  /** Where the secondary CTA navigates; defaults to report preview. */
  returnHref?: Href;
};

export function PremiumLockGate({
  title,
  body,
  returnLabel = 'Back to preview',
  returnHref,
}: PremiumLockGateProps) {
  const backHref = returnHref ?? previewReportHref();

  return (
    <CosmicScreen variant="stitch">
      <View className="flex-1 items-center justify-center gap-6 px-8">
        <AnimatedIcon name="lock" size={28} />
        <View className="gap-3">
          <Text className="text-center font-headline text-[24px] leading-8 text-on-surface">{title}</Text>
          <Text className="text-center font-body text-[15px] leading-7 text-on-surface-variant">{body}</Text>
        </View>
        <View className="w-full max-w-[360px] gap-3">
          <PrimaryButton
            variant="cta"
            label="Unlock full access"
            onPress={() => router.push(paywallRouteParams('/onboarding/report-preview'))}
          />
          <PrimaryButton variant="ghost" label={returnLabel} onPress={() => router.replace(backHref)} />
        </View>
      </View>
    </CosmicScreen>
  );
}

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { PalmScanCoachingTips } from '@/components/onboarding/PalmScanCoachingTips';
import {
  PALM_LIVE_GUIDE_CAPTURING,
  PALM_LIVE_GUIDE_READY,
  PALM_LIVE_GUIDES,
} from '@/constants/userCopy';

const ROTATE_MS = 2800;

type LivePalmCaptureGuideProps = {
  capturing?: boolean;
  /** Partner scan copy tweak. */
  partner?: boolean;
};

/**
 * One live tip at a time under the palm frame, synced with the checklist chips.
 * Replaces stacked paragraph coaching on the camera overlay.
 */
export function LivePalmCaptureGuide({ capturing = false, partner = false }: LivePalmCaptureGuideProps) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (capturing) return;
    const id = setInterval(() => {
      setTipIndex((i) => (i + 1) % PALM_LIVE_GUIDES.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [capturing]);

  const tip = PALM_LIVE_GUIDES[tipIndex] ?? PALM_LIVE_GUIDES[0];
  const readyLine = partner
    ? 'When their palm fills the guide, tap Capture.'
    : PALM_LIVE_GUIDE_READY;

  return (
    <View className="w-full max-w-[340px] gap-3 self-center">
      <View className="rounded-2xl border border-cyan/30 bg-black/70 px-4 py-3">
        <Text className="text-center font-label text-[10px] uppercase tracking-[0.2em] text-cyan">
          Live guide
        </Text>
        <Text
          accessibilityLiveRegion="polite"
          className="mt-2 text-center font-body text-[14px] leading-5 text-on-surface">
          {capturing ? PALM_LIVE_GUIDE_CAPTURING : tip}
        </Text>
        {!capturing ? (
          <Text className="mt-2 text-center font-body text-[12px] leading-4 text-on-surface-variant">
            {readyLine}
          </Text>
        ) : null}
      </View>
      <PalmScanCoachingTips compact activeIndex={capturing ? null : tipIndex} />
    </View>
  );
}

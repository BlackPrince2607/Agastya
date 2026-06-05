import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { GradientText } from '@/components/primitives';
import { stitchMd3 } from '@/constants/stitchWelcome';
import { cosmicGradients } from '@/constants/theme';

type StitchOnboardingHeaderProps = {
  /** Used with `totalSteps` for the default teal pipeline (ignored when alternate progress is set) */
  currentStep?: number;
  totalSteps?: number;
  showClose?: boolean;
  /** Preferred: single labeled progress bar for the 7-step ritual */
  ritualStep?: {
    current: number;
    total?: number;
  };
  /** @deprecated Use `ritualStep` — Stitch “Trust” four-slot track */
  md3FourSlot?: {
    activeSlot: 1 | 2 | 3 | 4;
  };
  /** @deprecated Use `ritualStep` */
  goalsProgressBar?: {
    current: number;
    total: number;
  };
  /** Post-reading checkout: paywall (6) → account (7) */
  finishFunnel?: {
    step: number;
    total?: number;
  };
};

function Md3FourSlotProgress({ activeSlot }: { activeSlot: 1 | 2 | 3 | 4 }) {
  return (
    <View className="mt-5 flex-row gap-2">
      {([1, 2, 3, 4] as const).map((slot) => {
        const trackBg = '#363437';
        const completeFill = '#4a454d';
        const isComplete = slot < activeSlot;
        const isActive = slot === activeSlot;
        return (
          <View key={slot} className="h-1 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: trackBg }}>
            {isComplete ? <View className="h-full w-full" style={{ backgroundColor: completeFill }} /> : null}
            {isActive ? (
              <View
                className="h-full w-full"
                style={{
                  backgroundColor: stitchMd3.primary,
                  shadowColor: stitchMd3.primary,
                  shadowOpacity: 0.55,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 0 },
                }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function GoalsLabeledBar({ current, total }: { current: number; total: number }) {
  const frac = Math.min(1, Math.max(0, current / total));
  return (
    <View className="mt-5">
      <View className="mb-2 flex-row items-end justify-between px-0.5">
        <Text className="font-space-grotesk text-[12px] font-semibold uppercase tracking-[0.12em] text-md-on-surface-variant">
          Progress
        </Text>
        <Text style={{ color: stitchMd3.primary }} className="font-space-grotesk text-[12px] font-semibold uppercase tracking-[0.12em]">
          Step {current} of {total}
        </Text>
      </View>
      <View className="h-1 w-full overflow-hidden rounded-full bg-[#363437]">
        <LinearGradient
          colors={[...cosmicGradients.nebulaMd3]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ height: '100%', width: `${frac * 100}%`, borderRadius: 999 }}
        />
      </View>
    </View>
  );
}

export function StitchOnboardingHeader({
  currentStep = 1,
  totalSteps = 6,
  showClose = true,
  ritualStep,
  md3FourSlot,
  goalsProgressBar,
  finishFunnel,
}: StitchOnboardingHeaderProps) {
  const labeledStep = ritualStep ?? goalsProgressBar;
  const labeledCurrent = ritualStep?.current ?? goalsProgressBar?.current ?? finishFunnel?.step ?? currentStep;
  const labeledTotal = ritualStep?.total ?? goalsProgressBar?.total ?? finishFunnel?.total ?? totalSteps;
  const safeStep = Math.min(Math.max(currentStep, 1), totalSteps);
  const showPipeline = !md3FourSlot && !labeledStep && !finishFunnel;

  return (
    <View className="mb-5 px-1">
      <View className="flex-row items-center justify-between">
        {showClose ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <Ionicons name="close" size={22} color="rgba(232,228,255,0.92)" />
          </Pressable>
        ) : (
          <View className="h-11 w-11" />
        )}
        <GradientText
          className="font-space-grotesk text-[13px] uppercase tracking-[0.42em]"
          gradient={cosmicGradients.pulse}>
          AGASTYA
        </GradientText>
        <View className="h-11 w-11" />
      </View>

      {finishFunnel ? (
        <GoalsLabeledBar current={finishFunnel.step} total={finishFunnel.total ?? labeledTotal} />
      ) : null}

      {ritualStep || goalsProgressBar ? (
        <GoalsLabeledBar current={labeledCurrent} total={labeledTotal} />
      ) : null}

      {md3FourSlot ? <Md3FourSlotProgress activeSlot={md3FourSlot.activeSlot} /> : null}

      {showPipeline ? (
        <View className="mt-5 flex-row gap-2">
          {Array.from({ length: totalSteps }, (_, i) => {
            const filled = i < safeStep;
            return (
              <View
                key={i}
                className={
                  filled ? 'h-1 flex-1 rounded-full bg-stitch-signal shadow-glow-teal' : 'h-1 flex-1 rounded-full bg-white/10'
                }
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

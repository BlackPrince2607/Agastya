import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { persistentStorage } from '@/services/persistentStorage';
import type { PalmAnalysisDto } from '@/types/palmAnalysis';
import type { SimulatedReading } from '@/types/report';

export type FocusTopic = 'love' | 'career' | 'money' | 'growth' | 'matching' | 'dating';

export type BillingPeriod = 'monthly' | 'annual';

export type Gender = 'female' | 'male' | 'non_binary' | 'prefer_not';

export type PalmScanHand = 'left' | 'right';

type SessionStore = {
  identityReady: boolean;
  sessionId: string | null;
  deviceInstallId: string | null;
  supabaseUserId: string | null;

  hasUnlockedPremium: boolean;
  hasEnteredMain: boolean;

  userDisplayName?: string;
  userGender?: Gender;

  readingSeed: string;
  focusTopics: FocusTopic[];
  billingPeriod: BillingPeriod;
  palmScanHand: PalmScanHand | null;

  palmCaptureBase64: string | null;
  palmAnalysis: PalmAnalysisDto | null;

  previewReading: SimulatedReading | null;
  fullReading: SimulatedReading | null;

  dailyTasks: string[];
  dailyTasksDate: string | null;
  dailyTasksVariant: string | null;

  /** One-time notice when cloud sync fails (shown on home, dismissible). */
  syncNotice: string | null;
  dismissedUpgradeCard: boolean;

  setPremium: (v: boolean) => void;
  setEnteredMain: (v: boolean) => void;
  setProfileBasics: (payload: { displayName?: string; gender?: Gender }) => void;
  setReadingSeed: (seed: string) => void;
  setFocusTopics: (topics: FocusTopic[]) => void;
  setBillingPeriod: (period: BillingPeriod) => void;
  setPalmScanHand: (hand: PalmScanHand | null) => void;

  setPalmCaptureBase64: (payload: string | null) => void;
  setPalmAnalysis: (payload: PalmAnalysisDto | null) => void;
  setPreviewReading: (reading: SimulatedReading | null) => void;
  setFullReading: (reading: SimulatedReading | null) => void;
  setDailyTasks: (tasks: string[], variant: string | null, isoDate: string) => void;
  setSyncNotice: (message: string | null) => void;
  setDismissedUpgradeCard: (v: boolean) => void;

  resetDemo: () => void;
};

const emptyReadingState = {
  palmCaptureBase64: null as string | null,
  palmAnalysis: null as PalmAnalysisDto | null,
  previewReading: null as SimulatedReading | null,
  fullReading: null as SimulatedReading | null,
  dailyTasks: [] as string[],
  dailyTasksDate: null as string | null,
  dailyTasksVariant: null as string | null,
};

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, _get) => ({
      identityReady: false,
      sessionId: null,
      deviceInstallId: null,
      supabaseUserId: null,

      hasUnlockedPremium: false,
      hasEnteredMain: false,

      userDisplayName: undefined,
      userGender: undefined,

      readingSeed: 'stillness',
      focusTopics: [],
      billingPeriod: 'annual',
      palmScanHand: null,

      ...emptyReadingState,

      syncNotice: null,
      dismissedUpgradeCard: false,

      setPremium: (hasUnlockedPremium) => set({ hasUnlockedPremium }),
      setEnteredMain: (hasEnteredMain) => set({ hasEnteredMain }),
      setProfileBasics: ({ displayName, gender }) =>
        set({
          userDisplayName: displayName ?? _get().userDisplayName,
          userGender: gender ?? _get().userGender,
        }),
      setReadingSeed: (readingSeed) => set({ readingSeed }),
      setFocusTopics: (topics) => set({ focusTopics: topics }),
      setBillingPeriod: (billingPeriod) => set({ billingPeriod }),
      setPalmScanHand: (palmScanHand) => set({ palmScanHand }),

      setPalmCaptureBase64: (payload) => set({ palmCaptureBase64: payload }),
      setPalmAnalysis: (payload) => set({ palmAnalysis: payload }),
      setPreviewReading: (reading) => set({ previewReading: reading }),
      setFullReading: (reading) => set({ fullReading: reading }),
      setDailyTasks: (tasks, variant, isoDate) =>
        set({
          dailyTasks: tasks,
          dailyTasksVariant: variant,
          dailyTasksDate: isoDate,
        }),
      setSyncNotice: (syncNotice) => set({ syncNotice }),
      setDismissedUpgradeCard: (dismissedUpgradeCard) => set({ dismissedUpgradeCard }),

      resetDemo: () =>
        set({
          hasUnlockedPremium: false,
          hasEnteredMain: false,
          userDisplayName: undefined,
          userGender: undefined,
          readingSeed: 'stillness',
          focusTopics: [],
          billingPeriod: 'annual',
          palmScanHand: null,
          sessionId: null,
          deviceInstallId: null,
          supabaseUserId: null,
          identityReady: false,
          syncNotice: null,
          dismissedUpgradeCard: false,
          ...emptyReadingState,
        }),
    }),
    {
      name: 'agastya-session-v3',
      storage: createJSONStorage(() => persistentStorage),
      onRehydrateStorage: () => (state, err) => {
        if (err && __DEV__) {
          console.warn('[Agastya] session restore failed — starting fresh', err);
        }
        if (state && (state.billingPeriod as string) === 'weekly') {
          state.billingPeriod = 'monthly';
        }
      },
      partialize: (state) => ({
        sessionId: state.sessionId,
        deviceInstallId: state.deviceInstallId,
        supabaseUserId: state.supabaseUserId,
        hasUnlockedPremium: state.hasUnlockedPremium,
        hasEnteredMain: state.hasEnteredMain,
        userDisplayName: state.userDisplayName,
        userGender: state.userGender,
        readingSeed: state.readingSeed,
        focusTopics: state.focusTopics,
        billingPeriod: state.billingPeriod,
        palmScanHand: state.palmScanHand,
        palmAnalysis: state.palmAnalysis,
        previewReading: state.previewReading,
        fullReading: state.fullReading,
        dailyTasks: state.dailyTasks,
        dailyTasksDate: state.dailyTasksDate,
        dailyTasksVariant: state.dailyTasksVariant,
        dismissedUpgradeCard: state.dismissedUpgradeCard,
      }),
    },
  ),
);

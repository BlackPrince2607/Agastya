import { router } from 'expo-router';

import { SectionHeader } from '@/components/feedback';
import { CosmicMatchPanel } from '@/components/match/CosmicMatchPanel';
import { MainTabScroll } from '@/components/layout/MainTabScroll';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { useSessionStore } from '@/store/sessionStore';

export default function MatchScreen() {
  const displayName = useSessionStore((s) => s.userDisplayName);

  return (
    <CosmicScreen variant="stitch">
      <MainTabScroll>
        <SectionHeader
          title="Compatibility"
          subtitle="Enter two names for a playful affinity score—entertainment only."
        />
        <CosmicMatchPanel
          defaultSelfName={displayName?.trim() ?? ''}
          onOpenGuide={() => router.push('/guide')}
        />
      </MainTabScroll>
    </CosmicScreen>
  );
}

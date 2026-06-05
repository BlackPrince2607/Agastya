import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatBubble } from '@/components/chat/ChatBubble';
import { PromptChips } from '@/components/chat/PromptChips';
import { InlineError, StatusPill } from '@/components/feedback';
import { EntertainmentDisclaimer } from '@/components/legal/EntertainmentDisclaimer';
import { ScreenBody } from '@/components/layout/ScreenBody';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { MainCosmicHeader } from '@/components/layout/MainCosmicHeader';
import { CosmicButton } from '@/components/primitives/CosmicButton';
import { useLayoutMetrics } from '@/hooks/useLayoutMetrics';
import { AI_VOICE_HINTS, OFFLINE_LIMITED_LABEL } from '@/constants/userCopy';
import { requestGuideReply } from '@/services/agastyaApi';
import { getApiHealth } from '@/services/connectivity';
import { useSessionStore } from '@/store/sessionStore';

type Turn = { role: 'you' | 'guide'; text: string };

const starter: Turn = {
  role: 'guide',
  text: 'Ask me anything about love, career, or your reading—I’m here to help you reflect.',
};

export default function GuideScreen() {
  const insets = useSafeAreaInsets();
  const { horizontalPad } = useLayoutMetrics();
  const displayName = useSessionStore((s) => s.userDisplayName);
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const { icebreaker } = useLocalSearchParams<{ icebreaker?: string }>();
  const [input, setInput] = useState('');
  const [thread, setThread] = useState<Turn[]>([starter]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);
  const apiLimited = getApiHealth()?.ok === false;

  useEffect(() => {
    const prompt = typeof icebreaker === 'string' ? icebreaker.trim() : '';
    if (prompt) setInput(prompt);
  }, [icebreaker]);

  const dispatch = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setError(null);
    setSending(true);

    const transcript = thread.map((turn) => ({ role: turn.role, content: turn.text }));
    transcript.push({ role: 'you', content: trimmed });

    const result = await requestGuideReply(transcript);

    if (result.ok) {
      setThread((prev) => [...prev, { role: 'you', text: trimmed }, { role: 'guide', text: result.text }]);
      setInput('');
    } else {
      setError(result.error);
      if (result.needsPalm) {
        setThread((prev) => [...prev, { role: 'you', text: trimmed }]);
        setInput('');
      } else {
        const fallback = trimmed.length < 12 ? (AI_VOICE_HINTS[1] ?? AI_VOICE_HINTS[0]) : AI_VOICE_HINTS[0];
        setThread((prev) => [...prev, { role: 'you', text: trimmed }, { role: 'guide', text: fallback }]);
        setInput('');
      }
    }
    setSending(false);
  };

  const padBottom = Math.max(insets.bottom, 12) + 72;

  return (
    <CosmicScreen variant="stitch">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: horizontalPad, paddingTop: 8 }}>
          <ScreenBody>
            <MainCosmicHeader displayName={displayName} onProfilePress={() => router.push('/profile')} />
            <Text className="mb-2 font-inter-medium text-[18px] text-mist" accessibilityRole="header">
              Guide
            </Text>

            {apiLimited ? <StatusPill label={OFFLINE_LIMITED_LABEL} variant="offline" /> : null}

            {!disclaimerDismissed ? (
              <View className="gap-2">
                <EntertainmentDisclaimer dense />
                <Pressable
                  onPress={() => setDisclaimerDismissed(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss guide disclaimer">
                  <Text className="text-[12px] text-md-on-surface-variant">Dismiss</Text>
                </Pressable>
              </View>
            ) : null}

            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingBottom: 16 }}>
              {thread.map((turn, idx) => (
                <ChatBubble key={`${idx}-${turn.role}`} role={turn.role} text={turn.text} />
              ))}
            </ScrollView>
          </ScreenBody>
        </View>

        <View
          className="gap-3 border-t border-white/10 bg-cosmic-void pt-4"
          style={{ paddingHorizontal: horizontalPad, paddingBottom: padBottom }}>
          <ScreenBody>
            {error ? <InlineError message={error} onDismiss={() => setError(null)} /> : null}
            {!premium ? (
              <Pressable
                onPress={() => router.push('/onboarding/paywall')}
                className="rounded-2xl border border-stitch-violet/30 bg-stitch-violet/10 px-4 py-3 active:opacity-90"
                accessibilityRole="button"
                accessibilityLabel="Upgrade for unlimited Guide messages">
                <Text className="font-inter-medium text-[14px] text-mist">Upgrade for unlimited Guide messages</Text>
              </Pressable>
            ) : null}
            <PromptChips onSelect={setInput} />
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask a question…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3.5 text-[16px] text-mist"
              multiline
              editable={!sending}
              returnKeyType="send"
              accessibilityLabel="Message to Guide"
            />
            <CosmicButton
              gradient="nebulaMd3"
              label={sending ? 'Sending…' : 'Send'}
              onPress={() => void dispatch()}
              disabled={sending || !input.trim()}
            />
            {sending ? <ActivityIndicator color="#a855f7" style={{ alignSelf: 'center' }} /> : null}
          </ScreenBody>
        </View>
      </KeyboardAvoidingView>
    </CosmicScreen>
  );
}

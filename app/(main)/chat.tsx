import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import {
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
import { SuggestionChips } from '@/components/chat/SuggestionChips';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { InlineError, StatusPill } from '@/components/feedback';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { ScreenBody } from '@/components/layout/ScreenBody';
import { GlassCard, Icon } from '@/components/ui';
import { useLayoutMetrics } from '@/hooks/useLayoutMetrics';
import { AI_VOICE_HINTS, OFFLINE_LIMITED_LABEL } from '@/constants/userCopy';
import { requestGuideReply } from '@/services/agastyaApi';
import { getApiHealth } from '@/services/connectivity';
import { useChatStore } from '@/store/chatStore';
import { useSessionStore } from '@/store/sessionStore';

const FREE_MESSAGE_CAP = 5;

const GUIDE_INTRO =
  'The stars speak clearly tonight. I can help you understand your palm, your future, and yourself better. What would you like to know?';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { horizontalPad } = useLayoutMetrics();
  const displayName = useSessionStore((s) => s.userDisplayName);
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const { icebreaker } = useLocalSearchParams<{ icebreaker?: string }>();

  const messages = useChatStore((s) => s.messages);
  const suggestions = useChatStore((s) => s.suggestions);
  const isTyping = useChatStore((s) => s.isTyping);
  const messageCount = useChatStore((s) => s.messageCount);
  const addMessage = useChatStore((s) => s.addMessage);
  const setSuggestions = useChatStore((s) => s.setSuggestions);
  const setTyping = useChatStore((s) => s.setTyping);

  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const apiLimited = getApiHealth()?.ok === false;
  const reachedCap = !premium && messageCount >= FREE_MESSAGE_CAP;
  const messagesLeft = !premium ? Math.max(0, FREE_MESSAGE_CAP - messageCount) : null;

  useEffect(() => {
    const prompt = typeof icebreaker === 'string' ? icebreaker.trim() : '';
    if (prompt) setInput(prompt);
  }, [icebreaker]);

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [messages.length, isTyping]);

  const dispatch = async () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    setError(null);
    addMessage('you', trimmed);
    setInput('');
    setTyping(true);

    const transcript = useChatStore
      .getState()
      .messages.map((m) => ({ role: m.role, content: m.text }));

    const result = await requestGuideReply(transcript);
    setTyping(false);

    if (result.ok) {
      addMessage('guide', result.text);
      setSuggestions(result.suggestions);
    } else {
      setError(result.error);
      if (!result.needsPalm && result.offline) {
        const fallback = trimmed.length < 12 ? (AI_VOICE_HINTS[1] ?? AI_VOICE_HINTS[0]) : AI_VOICE_HINTS[0];
        addMessage('guide', fallback);
      }
    }
  };

  const padBottom = Math.max(insets.bottom, 12) + 220;
  const empty = messages.length === 0;

  return (
    <CosmicScreen variant="stitch">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: horizontalPad, paddingTop: 8 }}>
          <ScreenBody>
            {/* Header */}
            <View className="flex-row items-center gap-3 border-b border-white/10 pb-3">
              <View className="h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.05]">
                <Icon name="auto_fix_high" size={20} color="#d3beeb" />
              </View>
              <View className="flex-1">
                <Text className="font-headline text-[18px] text-on-surface">AI Guide</Text>
                <Text className="font-body text-[12px] text-on-surface-variant">Your personal palm reading guide</Text>
              </View>
            </View>

            {apiLimited ? <View className="mt-3"><StatusPill label={OFFLINE_LIMITED_LABEL} variant="offline" /></View> : null}
            {!premium && messagesLeft !== null && messagesLeft > 0 ? (
              <Text className="mt-2 font-inter text-[12px] text-on-surface-variant">
                {messagesLeft} preview {messagesLeft === 1 ? 'message' : 'messages'} left
              </Text>
            ) : null}

            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 14, paddingVertical: 16, paddingBottom: padBottom }}>
              {empty ? (
                <View className="items-center gap-6 pt-6">
                  <ChatBubble role="guide" text={`Hi ${displayName?.trim() || 'there'}! ${GUIDE_INTRO}`} />
                  <AuraOrb />
                </View>
              ) : (
                messages.map((m) => <ChatBubble key={m.id} role={m.role} text={m.text} />)
              )}
              {isTyping ? <TypingIndicator /> : null}
            </ScrollView>
          </ScreenBody>
        </View>

        {/* Floating input dock */}
        <View
          style={{ paddingHorizontal: horizontalPad, paddingBottom: Math.max(insets.bottom, 12) + 84, paddingTop: 8 }}
          className="absolute bottom-0 left-0 right-0">
          <ScreenBody>
            <View className="gap-3">
              {error ? <InlineError message={error} onDismiss={() => setError(null)} /> : null}

              {reachedCap ? (
                <Pressable
                  onPress={() => router.push('/onboarding/paywall')}
                  className="rounded-glass border border-primary/30 bg-primary/10 px-4 py-3 active:opacity-90"
                  accessibilityRole="button">
                  <Text className="font-body-medium text-[14px] text-on-surface">
                    You’ve reached today’s free questions — go premium for unlimited guidance.
                  </Text>
                </Pressable>
              ) : (
                <SuggestionChips suggestions={suggestions} onSelect={setInput} />
              )}

              <GlassCard className="flex-row items-center gap-2 rounded-pill p-1.5">
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder={empty ? 'Ask me anything…' : 'Ask follow up…'}
                  placeholderTextColor="rgba(203,196,206,0.5)"
                  className="flex-1 px-4 py-2.5 font-body text-[15px] text-on-surface"
                  editable={!isTyping}
                  onSubmitEditing={() => void dispatch()}
                  returnKeyType="send"
                  accessibilityLabel="Message to Guide"
                />
                <Pressable
                  onPress={() => void dispatch()}
                  disabled={isTyping || !input.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Send"
                  style={{ opacity: isTyping || !input.trim() ? 0.5 : 1 }}>
                  <LinearGradient
                    colors={['#d3beeb', '#68577e']}
                    style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="send" size={20} color="#1a0b2e" />
                  </LinearGradient>
                </Pressable>
              </GlassCard>
            </View>
          </ScreenBody>
        </View>
      </KeyboardAvoidingView>
    </CosmicScreen>
  );
}

/** Rotating dashed aura rings with a nebula core (Stitch mystic presence). */
function AuraOrb() {
  return (
    <View className="h-44 w-44 items-center justify-center">
      <MotiView
        from={{ rotate: '0deg' }}
        animate={{ rotate: '360deg' }}
        transition={{ type: 'timing', duration: 20000, loop: true, repeatReverse: false }}
        className="absolute h-44 w-44 rounded-full border-2 border-dashed border-primary/20"
      />
      <MotiView
        from={{ rotate: '360deg' }}
        animate={{ rotate: '0deg' }}
        transition={{ type: 'timing', duration: 15000, loop: true, repeatReverse: false }}
        className="absolute h-32 w-32 rounded-full border border-secondary/20"
      />
      <LinearGradient
        colors={['#d3beeb', '#68577e']}
        style={{ width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="visibility" size={40} color="#ffffff" />
      </LinearGradient>
    </View>
  );
}

import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
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
import { InlineError, PremiumLockGate } from '@/components/feedback';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { ScreenBody } from '@/components/layout/ScreenBody';
import { GlassCard, Icon } from '@/components/ui';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { colors, gradients } from '@/constants/theme';
import { useLayoutMetrics } from '@/hooks/useLayoutMetrics';
import { track } from '@/services/analytics';
import { isApiConfigured, isMisconfiguredProductionApi, getApiHostLabel } from '@/services/env';
import { requestGuideReply } from '@/services/agastyaApi';
import { useChatStore } from '@/store/chatStore';
import { useSessionStore } from '@/store/sessionStore';
import {
  pauseBetweenBubblesMs,
  splitIntoTextBubbles,
  typingDelayForBubble,
} from '@/utils/splitChatBubbles';

const GUIDE_INTRO =
  'Ask me about your palm reading, your focus areas, or what today might hold. What is on your mind?';

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { horizontalPad } = useLayoutMetrics();
  const displayName = useSessionStore((s) => s.userDisplayName);
  const premium = useSessionStore((s) => s.hasUnlockedPremium);
  const { icebreaker } = useLocalSearchParams<{ icebreaker?: string }>();

  const messages = useChatStore((s) => s.messages);
  const suggestions = useChatStore((s) => s.suggestions);
  const isTyping = useChatStore((s) => s.isTyping);
  const addMessage = useChatStore((s) => s.addMessage);
  const setSuggestions = useChatStore((s) => s.setSuggestions);
  const setTyping = useChatStore((s) => s.setTyping);

  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [replyBusy, setReplyBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const deliveryGenRef = useRef(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const prompt = typeof icebreaker === 'string' ? icebreaker.trim() : '';
    if (prompt) setInput(prompt);
  }, [icebreaker]);

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [messages.length, isTyping]);

  useEffect(() => {
    return () => {
      deliveryGenRef.current += 1;
      useChatStore.getState().setTyping(false);
    };
  }, []);

  const deliverGuideBubbles = async (text: string, nextSuggestions: string[]) => {
    const gen = ++deliveryGenRef.current;
    const parts = splitIntoTextBubbles(text);
    for (let i = 0; i < parts.length; i++) {
      if (gen !== deliveryGenRef.current) return;
      setTyping(true);
      await delay(typingDelayForBubble(parts[i], i));
      if (gen !== deliveryGenRef.current) return;
      setTyping(false);
      addMessage('guide', parts[i]);
      if (i < parts.length - 1) {
        await delay(pauseBetweenBubblesMs());
      }
    }
    if (gen !== deliveryGenRef.current) return;
    setSuggestions(nextSuggestions);
  };

  const dispatch = async () => {
    const trimmed = input.trim();
    if (!trimmed || replyBusy || isTyping) return;

    setError(null);
    addMessage('you', trimmed);
    setInput('');
    inputRef.current?.blur();
    Keyboard.dismiss();
    setKeyboardHeight(0);
    setReplyBusy(true);
    setTyping(true);

    const transcript = useChatStore
      .getState()
      .messages.map((m) => ({ role: m.role, content: m.text }));

    const result = await requestGuideReply(transcript);

    if (result.ok) {
      await deliverGuideBubbles(result.text, result.suggestions);
    } else {
      setTyping(false);
      track('chat_reply_fail', {
        offline: Boolean(result.offline),
        needsPalm: Boolean(result.needsPalm),
        configured: isApiConfigured(),
        misconfigured: isMisconfiguredProductionApi(),
        apiHost: getApiHostLabel(),
      });
      const devHint =
        __DEV__ && result.offline
          ? ' Start the API on your computer (npm run api) and ensure your phone can reach it.'
          : '';
      setError(`${result.error}${devHint}`);
    }
    setReplyBusy(false);
  };

  const tabBarInset = Math.max(insets.bottom, Platform.OS === 'web' ? 14 : 10);
  const dockBottom = TAB_BAR_CLEARANCE + tabBarInset;
  const inputRowHeight = 52;
  const empty = messages.length === 0;
  const keyboardOpen = keyboardHeight > 0;
  // Lift composer only while keyboard is visible. Android resize handles layout; iOS needs explicit inset.
  const composerBottom = keyboardOpen
    ? Platform.OS === 'ios'
      ? keyboardHeight + 8
      : 8
    : dockBottom;

  if (!premium) {
    return (
      <PremiumLockGate
        title="Guide chat is a Pro feature"
        body="Unlock full access for unlimited conversations with Agastya about your reading."
      />
    );
  }

  const introName = displayName?.trim() || 'there';
  const introBubbles = empty
    ? splitIntoTextBubbles(`Hi ${introName}! ${GUIDE_INTRO}`)
    : [];

  return (
    <CosmicScreen variant="stitch">
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: horizontalPad, paddingTop: 8 }}>
          <ScreenBody style={{ flex: 1 }}>
            <View className="w-full flex-row items-center gap-3 px-2 pb-3 pt-1">
              <View
                className="h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15"
                style={{ backgroundColor: 'rgba(168,85,247,0.18)' }}>
                <Icon name="auto_awesome" size={20} color={colors.primary} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-headline text-[20px] leading-7 text-on-surface">Ask Agastya</Text>
                <Text className="font-body text-[13px] leading-5 text-on-surface-variant">
                  Your spiritual guide for reading, purpose, and what comes next
                </Text>
              </View>
            </View>

            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 0, paddingHorizontal: 8, paddingTop: 12, paddingBottom: 16 }}>
              {empty ? (
                <View className="w-full">
                  {introBubbles.map((text, i) => (
                    <ChatBubble
                      key={`intro-${i}`}
                      role="guide"
                      text={text}
                      stacked={i > 0}
                      stacksNext={i < introBubbles.length - 1}
                    />
                  ))}
                  <View className="mt-5 items-center">
                    <AuraOrb />
                  </View>
                </View>
              ) : (
                messages.map((m, i) => {
                  const prev = messages[i - 1];
                  const next = messages[i + 1];
                  const stacked = Boolean(prev && prev.role === m.role);
                  const stacksNext = Boolean(next && next.role === m.role);
                  return (
                    <ChatBubble
                      key={m.id}
                      role={m.role}
                      text={m.text}
                      stacked={stacked}
                      stacksNext={stacksNext}
                    />
                  );
                })
              )}
              {isTyping ? (
                <View style={{ marginTop: 10 }}>
                  <TypingIndicator />
                </View>
              ) : null}
            </ScrollView>
          </ScreenBody>
        </View>

        <View
          style={{ paddingHorizontal: horizontalPad, paddingBottom: composerBottom, paddingTop: 8 }}
          className="border-t border-white/[0.06] bg-background/95">
          <ScreenBody>
            <View className="w-full gap-2">
              {error ? <InlineError message={error} onDismiss={() => setError(null)} /> : null}

              {suggestions.length > 0 ? (
                <SuggestionChips suggestions={suggestions} onSelect={setInput} />
              ) : null}

              <GlassCard className="rounded-pill px-1.5 py-1.5" innerClassName="flex-row items-center gap-2">
                <TextInput
                  ref={inputRef}
                  value={input}
                  onChangeText={setInput}
                  placeholder={empty ? 'Ask me anything' : 'Ask a follow up'}
                  placeholderTextColor={colors.placeholder}
                  className="min-w-0 flex-1 font-body text-[15px] text-on-surface"
                  style={{
                    height: inputRowHeight,
                    lineHeight: 20,
                    paddingHorizontal: 14,
                    paddingVertical: Platform.OS === 'ios' ? 15 : 14,
                    margin: 0,
                    textAlignVertical: 'center',
                    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
                    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as Record<string, string>) : null),
                  }}
                  multiline={false}
                  editable={!replyBusy && !isTyping}
                  onSubmitEditing={() => void dispatch()}
                  returnKeyType="send"
                  blurOnSubmit
                  accessibilityLabel="Message to Guide"
                />
                <Pressable
                  onPress={() => void dispatch()}
                  disabled={replyBusy || isTyping || !input.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Send"
                  className="shrink-0"
                  style={{ opacity: replyBusy || isTyping || !input.trim() ? 0.45 : 1 }}>
                  <LinearGradient
                    colors={[...gradients.nebula]}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Icon name="send" size={20} color={colors.onPrimary} />
                  </LinearGradient>
                </Pressable>
              </GlassCard>
            </View>
          </ScreenBody>
        </View>
      </View>
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
        colors={[...gradients.nebula]}
        style={{ width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="visibility" size={40} color={colors.onPrimary} />
      </LinearGradient>
    </View>
  );
}

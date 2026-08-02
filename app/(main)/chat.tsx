import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatBubble } from '@/components/chat/ChatBubble';
import { SuggestionChips } from '@/components/chat/SuggestionChips';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { InlineError, PageTitle, PremiumLockGate } from '@/components/feedback';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { ScreenBody } from '@/components/layout/ScreenBody';
import { GlassCard, Icon, PressableScale } from '@/components/ui';
import { TAB_BAR_BODY_HEIGHT } from '@/constants/layout';
import { colors, gradients } from '@/constants/theme';
import {
  CHAT_PLACEHOLDER_EMPTY,
  CHAT_PLACEHOLDER_FOLLOW,
  GUIDE_INTRO,
} from '@/constants/userCopy';
import { useLayoutMetrics } from '@/hooks/useLayoutMetrics';
import { triggerMedium } from '@/hooks/useHapticTap';
import { AnalyticsEvent, track } from '@/services/analytics';
import { isApiConfigured, isMisconfiguredProductionApi, getApiHostLabel } from '@/services/env';
import { requestGuideReply } from '@/services/agastyaApi';
import { useChatStore } from '@/store/chatStore';
import { useSessionStore } from '@/store/sessionStore';
import {
  pauseBetweenBubblesMs,
  splitIntoTextBubbles,
  typingDelayForBubble,
} from '@/utils/splitChatBubbles';

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
  const removeSuggestion = useChatStore((s) => s.removeSuggestion);
  const clearSuggestions = useChatStore((s) => s.clearSuggestions);
  const setTyping = useChatStore((s) => s.setTyping);

  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [replyBusy, setReplyBusy] = useState(false);
  const [composerHeight, setComposerHeight] = useState(120);
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

  // Seed intro into the store once so it doesn't vanish on first send.
  useEffect(() => {
    const state = useChatStore.getState();
    if (state.messages.length > 0) return;
    const name = displayName?.trim() || 'there';
    const intro = `Hi ${name}! ${GUIDE_INTRO}`;
    for (const part of splitIntoTextBubbles(intro)) {
      state.addMessage('guide', part);
    }
  }, [displayName]);

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [messages.length, isTyping, composerHeight]);

  useEffect(() => {
    return () => {
      deliveryGenRef.current += 1;
      useChatStore.getState().setTyping(false);
    };
  }, []);

  const deliverGuideBubbles = async (text: string, nextSuggestions: string[]) => {
    const gen = ++deliveryGenRef.current;
    const parts = splitIntoTextBubbles(text);
    // Typing already shown during API wait — deliver promptly with a short beat only.
    for (let i = 0; i < parts.length; i++) {
      if (gen !== deliveryGenRef.current) return;
      if (i === 0) {
        setTyping(false);
        await delay(typingDelayForBubble(parts[i], i));
      } else {
        setTyping(true);
        await delay(typingDelayForBubble(parts[i], i));
        if (gen !== deliveryGenRef.current) return;
        setTyping(false);
      }
      if (gen !== deliveryGenRef.current) return;
      addMessage('guide', parts[i]);
      if (i < parts.length - 1) {
        await delay(pauseBetweenBubblesMs());
      }
    }
    if (gen !== deliveryGenRef.current) return;
    setTyping(false);
    setSuggestions(nextSuggestions);
  };

  const requestReplyForCurrentTranscript = async () => {
    setError(null);
    clearSuggestions();
    setReplyBusy(true);
    setTyping(true);

    const transcript = useChatStore
      .getState()
      .messages.map((m) => ({ role: m.role, content: m.text }));

    const result = await requestGuideReply(transcript);

    if (result.ok) {
      if (result.memoryChanged) {
        track(AnalyticsEvent.MEMORY_EXTRACTED);
      }
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

  const dispatch = async (textOverride?: string) => {
    const trimmed = (textOverride ?? input).trim();
    if (!trimmed || replyBusy || isTyping) return;

    const isFirstMessage = messages.length === 0;
    if (isFirstMessage) {
      track(AnalyticsEvent.CHAT_STARTED);
    }

    addMessage('you', trimmed);
    setInput('');
    inputRef.current?.blur();
    Keyboard.dismiss();
    setKeyboardHeight(0);
    await requestReplyForCurrentTranscript();
  };

  const retryLastReply = () => {
    if (replyBusy || isTyping) return;
    if (!messages.some((m) => m.role === 'you')) return;
    void requestReplyForCurrentTranscript();
  };

  // Match main tab bar height so the composer sits flush above Home/Chat/Tasks/Profile.
  const tabBarInset = Math.max(insets.bottom, Platform.OS === 'web' ? 14 : 10);
  const dockBottom = TAB_BAR_BODY_HEIGHT + tabBarInset + 6;
  const inputMinHeight = 48;
  const inputMaxHeight = 88;
  const hasUserMessages = messages.some((m) => m.role === 'you');
  const showSuggestions = suggestions.length > 0 && !replyBusy && !isTyping;
  const keyboardOpen = keyboardHeight > 0;
  const composerBottom = keyboardOpen
    ? Platform.OS === 'ios'
      ? keyboardHeight + 8
      : 8
    : dockBottom;

  if (!premium) {
    return (
      <PremiumLockGate
        title="Guide is a Pro feature"
        body="Unlock unlimited conversations about your reading, focus areas, and what comes next."
        returnHref="/(main)/home"
        returnLabel="Back to Home"
      />
    );
  }

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
                <PageTitle title="Guide" />
              </View>
            </View>

            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                gap: 0,
                paddingHorizontal: 8,
                paddingTop: 12,
                paddingBottom: composerHeight + 16,
              }}>
              {messages.map((m, i) => {
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
              })}
              {isTyping ? (
                <View style={{ marginTop: 10 }}>
                  <TypingIndicator />
                </View>
              ) : null}
            </ScrollView>
          </ScreenBody>
        </View>

        <View
          onLayout={(e) => setComposerHeight(e.nativeEvent.layout.height)}
          style={{ paddingHorizontal: horizontalPad, paddingBottom: composerBottom, paddingTop: 8 }}
          className="border-t border-white/[0.06] bg-background/95">
          <ScreenBody>
            <View className="w-full gap-2">
              {error ? (
                <InlineError message={error} onDismiss={() => setError(null)} onRetry={retryLastReply} />
              ) : null}

              {showSuggestions ? (
                <SuggestionChips
                  suggestions={suggestions}
                  onSelect={(text) => {
                    removeSuggestion(text);
                    void dispatch(text);
                  }}
                />
              ) : null}

              <GlassCard className="rounded-pill px-1.5 py-1.5" innerClassName="flex-row items-center gap-2">
                <TextInput
                  ref={inputRef}
                  value={input}
                  onChangeText={setInput}
                  placeholder={!hasUserMessages ? CHAT_PLACEHOLDER_EMPTY : CHAT_PLACEHOLDER_FOLLOW}
                  placeholderTextColor={colors.placeholder}
                  className="min-w-0 flex-1 font-body text-[15px] text-on-surface"
                  style={{
                    minHeight: inputMinHeight,
                    maxHeight: inputMaxHeight,
                    lineHeight: 20,
                    paddingHorizontal: 14,
                    paddingTop: Platform.OS === 'ios' ? 14 : 12,
                    paddingBottom: Platform.OS === 'ios' ? 14 : 12,
                    margin: 0,
                    textAlignVertical: 'center',
                    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
                    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as Record<string, string>) : null),
                  }}
                  multiline
                  scrollEnabled
                  editable={!replyBusy && !isTyping}
                  onSubmitEditing={() => void dispatch()}
                  returnKeyType="send"
                  blurOnSubmit={false}
                  accessibilityLabel="Message to Agastya"
                />
                <PressableScale
                  onPress={() => {
                    void triggerMedium();
                    void dispatch();
                  }}
                  disabled={replyBusy || isTyping || !input.trim()}
                  haptic={false}
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                  accessibilityState={{
                    disabled: replyBusy || isTyping || !input.trim(),
                    busy: replyBusy || isTyping,
                  }}
                  scaleTo={0.92}
                  style={{
                    opacity: replyBusy || isTyping || !input.trim() ? 0.45 : 1,
                  }}>
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
                </PressableScale>
              </GlassCard>
            </View>
          </ScreenBody>
        </View>
      </View>
    </CosmicScreen>
  );
}

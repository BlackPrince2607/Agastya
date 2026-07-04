import { router, useLocalSearchParams } from 'expo-router';
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
import { InlineError } from '@/components/feedback';
import { CosmicScreen } from '@/components/layout/CosmicScreen';
import { ScreenBody } from '@/components/layout/ScreenBody';
import { GlassCard, Icon } from '@/components/ui';
import { TAB_BAR_CLEARANCE } from '@/constants/layout';
import { colors, gradients } from '@/constants/theme';
import { useLayoutMetrics } from '@/hooks/useLayoutMetrics';
import { track } from '@/services/analytics';
import { isApiConfigured, isMisconfiguredProductionApi } from '@/services/env';
import { requestGuideReply } from '@/services/agastyaApi';
import { useChatStore } from '@/store/chatStore';
import { useSessionStore } from '@/store/sessionStore';
import { paywallRouteParams } from '@/utils/paywallNavigation';

const FREE_MESSAGE_CAP = 5;

const GUIDE_INTRO =
  'Ask me about your palm reading, your focus areas, or what today might hold. What is on your mind?';

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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const reachedCap = !premium && messageCount >= FREE_MESSAGE_CAP;
  const messagesLeft = !premium ? Math.max(0, FREE_MESSAGE_CAP - messageCount) : null;

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

  const dispatch = async () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping || reachedCap) return;

    setError(null);
    addMessage('you', trimmed);
    setInput('');
    inputRef.current?.blur();
    Keyboard.dismiss();
    setKeyboardHeight(0);
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
      track('chat_reply_fail', {
        offline: Boolean(result.offline),
        needsPalm: Boolean(result.needsPalm),
        configured: isApiConfigured(),
        misconfigured: isMisconfiguredProductionApi(),
      });
      const devHint =
        __DEV__ && result.offline
          ? ' Start the API on your computer (npm run api) and ensure your phone can reach it.'
          : '';
      setError(`${result.error}${devHint}`);
    }
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

  return (
    <CosmicScreen variant="stitch">
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: horizontalPad, paddingTop: 8 }}>
          <ScreenBody style={{ flex: 1 }}>
            <View className="w-full flex-row items-center gap-3 px-2 pb-2 pt-1">
              <View className="h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.05]">
                <Icon name="auto_fix_high" size={20} color={colors.primary} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-headline text-[18px] text-on-surface">Guide</Text>
                <Text className="font-body text-[12px] text-on-surface-variant">Your personal palm reading guide</Text>
              </View>
            </View>

            {!premium && messagesLeft !== null && messagesLeft > 0 ? (
              <Text className="px-2 font-body text-[12px] text-on-surface-variant">
                {messagesLeft} preview {messagesLeft === 1 ? 'message' : 'messages'} left
              </Text>
            ) : null}

            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 14, paddingHorizontal: 8, paddingTop: 12, paddingBottom: 16 }}>
              {empty ? (
                <View className="w-full gap-6">
                  <ChatBubble role="guide" text={`Hi ${displayName?.trim() || 'there'}! ${GUIDE_INTRO}`} />
                  <View className="items-center">
                    <AuraOrb />
                  </View>
                </View>
              ) : (
                messages.map((m) => <ChatBubble key={m.id} role={m.role} text={m.text} />)
              )}
              {isTyping ? <TypingIndicator /> : null}
            </ScrollView>
          </ScreenBody>
        </View>

        <View
          style={{ paddingHorizontal: horizontalPad, paddingBottom: composerBottom, paddingTop: 8 }}
          className="border-t border-white/[0.06] bg-background/95">
          <ScreenBody>
            <View className="w-full gap-2">
              {error ? <InlineError message={error} onDismiss={() => setError(null)} /> : null}

              {reachedCap ? (
                <Pressable
                  onPress={() => router.push(paywallRouteParams('/(main)/chat'))}
                  className="rounded-glass border border-primary/30 bg-primary/10 px-4 py-3 active:opacity-90"
                  accessibilityRole="button">
                  <Text className="font-body-medium text-[14px] text-on-surface">
                    You’ve reached today’s free questions. Go premium for unlimited guidance.
                  </Text>
                </Pressable>
              ) : suggestions.length > 0 ? (
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
                  editable={!isTyping && !reachedCap}
                  onSubmitEditing={() => void dispatch()}
                  returnKeyType="send"
                  blurOnSubmit
                  accessibilityLabel="Message to Guide"
                />
                <Pressable
                  onPress={() => void dispatch()}
                  disabled={isTyping || !input.trim() || reachedCap}
                  accessibilityRole="button"
                  accessibilityLabel="Send"
                  className="shrink-0"
                  style={{ opacity: isTyping || !input.trim() ? 0.45 : 1 }}>
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
        <Icon name="visibility" size={40} color="#ffffff" />
      </LinearGradient>
    </View>
  );
}

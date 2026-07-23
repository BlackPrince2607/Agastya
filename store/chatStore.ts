import { create } from 'zustand';

import { splitIntoTextBubbles } from '@/utils/splitChatBubbles';

export type ChatRole = 'you' | 'guide';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

const DEFAULT_SUGGESTIONS = [
  'What should I focus on today?',
  'Help me think something through',
  'What does my reading say about me?',
];

/** Topic snippet for Home "Continue conversation" — avoids full-message subscriptions. */
export function lastUserTopicFromMessages(messages: { role: string; text: string }[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'you' && msg.text.trim()) {
      const trimmed = msg.text.trim();
      return trimmed.length > 72 ? `${trimmed.slice(0, 69)}…` : trimmed;
    }
  }
  return null;
}

type ChatStore = {
  messages: ChatMessage[];
  suggestions: string[];
  isTyping: boolean;
  /** User turns sent — drives free-tier soft cap. */
  messageCount: number;
  /** Derived for Home / continue-card; updated with messages. */
  lastUserTopic: string | null;

  addMessage: (role: ChatRole, text: string) => void;
  setSuggestions: (suggestions: string[]) => void;
  setTyping: (isTyping: boolean) => void;
  hydrateFromServer: (tail: Array<{ role: string; content: string }>) => void;
  clear: () => void;
};

let counter = 0;
const nextId = () => `${Date.now()}-${counter++}`;

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  suggestions: DEFAULT_SUGGESTIONS,
  isTyping: false,
  messageCount: 0,
  lastUserTopic: null,

  addMessage: (role, text) => {
    const messages = [...get().messages, { id: nextId(), role, text }];
    set({
      messages,
      messageCount: role === 'you' ? get().messageCount + 1 : get().messageCount,
      lastUserTopic: role === 'you' ? lastUserTopicFromMessages(messages) : get().lastUserTopic,
    });
  },
  setSuggestions: (suggestions) =>
    set({ suggestions: suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS }),
  setTyping: (isTyping) => set({ isTyping }),
  hydrateFromServer: (tail) => {
    if (!tail.length) return;
    const messages: ChatMessage[] = [];
    let messageCount = 0;
    for (const turn of tail) {
      const role: ChatRole = turn.role === 'user' || turn.role === 'you' ? 'you' : 'guide';
      const text = turn.content?.trim();
      if (!text) continue;
      if (role === 'guide') {
        for (const part of splitIntoTextBubbles(text)) {
          messages.push({ id: nextId(), role, text: part });
        }
      } else {
        messages.push({ id: nextId(), role, text });
        messageCount += 1;
      }
    }
    if (!messages.length) return;
    set({
      messages,
      messageCount,
      suggestions: DEFAULT_SUGGESTIONS,
      isTyping: false,
      lastUserTopic: lastUserTopicFromMessages(messages),
    });
  },
  clear: () =>
    set({
      messages: [],
      suggestions: DEFAULT_SUGGESTIONS,
      isTyping: false,
      messageCount: 0,
      lastUserTopic: null,
    }),
}));

export { DEFAULT_SUGGESTIONS };

import { create } from 'zustand';

export type ChatRole = 'you' | 'guide';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

const DEFAULT_SUGGESTIONS = [
  'Tell me about my future',
  'Why do I overthink so much?',
  'Will I find true love?',
  'Career advice please',
];

type ChatStore = {
  messages: ChatMessage[];
  suggestions: string[];
  isTyping: boolean;
  /** User turns sent — drives free-tier soft cap. */
  messageCount: number;

  addMessage: (role: ChatRole, text: string) => void;
  setSuggestions: (suggestions: string[]) => void;
  setTyping: (isTyping: boolean) => void;
  clear: () => void;
};

let counter = 0;
const nextId = () => `${Date.now()}-${counter++}`;

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  suggestions: DEFAULT_SUGGESTIONS,
  isTyping: false,
  messageCount: 0,

  addMessage: (role, text) =>
    set({
      messages: [...get().messages, { id: nextId(), role, text }],
      messageCount: role === 'you' ? get().messageCount + 1 : get().messageCount,
    }),
  setSuggestions: (suggestions) =>
    set({ suggestions: suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS }),
  setTyping: (isTyping) => set({ isTyping }),
  clear: () => set({ messages: [], suggestions: DEFAULT_SUGGESTIONS, isTyping: false, messageCount: 0 }),
}));

export { DEFAULT_SUGGESTIONS };

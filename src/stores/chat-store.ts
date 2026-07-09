import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface Source {
  url: string;
  title?: string | null;
  similarity?: number;
  page_number?: number;
  section_heading?: string | null;
  document_type?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  confidence?: number;
  isLowConfidence?: boolean;
  language?: string;
  timestamp: Date;
  streaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingPhase: 'searching' | 'thinking' | 'generating' | null;
  streamingText: string;
  error: string | null;

  // Actions
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;
  setIsLoading: (loading: boolean) => void;
  setIsStreaming: (streaming: boolean) => void;
  setStreamingPhase: (phase: 'searching' | 'thinking' | 'generating' | null) => void;
  setStreamingText: (text: string) => void;
  appendStreamingText: (chunk: string) => void;
  setError: (error: string | null) => void;

  // Async actions
  loadConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  createConversation: (firstMessage?: string) => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  deleteMessage: (messageId: string, conversationId: string) => Promise<void>;
  startNewChat: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isLoading: false,
  isStreaming: false,
  streamingPhase: null,
  streamingText: '',
  error: null,

  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set(state => ({ messages: [...state.messages, message] })),
  updateMessage: (id, updates) => set(state => ({
    messages: state.messages.map(m => m.id === id ? { ...m, ...updates } : m),
  })),
  removeMessage: (id) => set(state => ({ messages: state.messages.filter(m => m.id !== id) })),
  clearMessages: () => set({ messages: [] }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setStreamingPhase: (streamingPhase) => set({ streamingPhase }),
  setStreamingText: (streamingText) => set({ streamingText }),
  appendStreamingText: (chunk) => set(state => ({ streamingText: state.streamingText + chunk })),
  setError: (error) => set({ error }),

  loadConversations: async () => {
    try {
      const { data } = await supabase
        .from('voice_conversations')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(30);
      set({ conversations: (data as Conversation[]) || [] });
    } catch (e) {
      console.warn('loadConversations failed:', e);
    }
  },

  loadConversation: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('voice_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const messages: Message[] = (data || []).map((m: { id: string; role: string; content: string; created_at: string }) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.created_at),
      }));
      set({ messages, activeConversationId: id, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  createConversation: async (firstMessage?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('voice_conversations')
      .insert({ user_id: session.user.id, title: firstMessage?.slice(0, 80) || 'New Conversation' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const newConv: Conversation = { id: data.id, title: data.title, created_at: data.created_at };
    set(state => ({
      conversations: [newConv, ...state.conversations],
      activeConversationId: data.id,
    }));
    return data.id;
  },

  deleteConversation: async (id: string) => {
    await supabase.from('voice_conversations').delete().eq('id', id);
    set(state => {
      const filtered = state.conversations.filter(c => c.id !== id);
      const newActive = state.activeConversationId === id
        ? (filtered[0]?.id || null)
        : state.activeConversationId;
      return {
        conversations: filtered,
        activeConversationId: newActive,
        messages: state.activeConversationId === id ? [] : state.messages,
      };
    });
  },

  renameConversation: async (id: string, title: string) => {
    await supabase.from('voice_conversations').update({ title }).eq('id', id);
    set(state => ({
      conversations: state.conversations.map(c => c.id === id ? { ...c, title } : c),
    }));
  },

  deleteMessage: async (messageId: string, conversationId: string) => {
    await supabase.from('voice_messages').delete().eq('id', messageId).eq('conversation_id', conversationId);
    set(state => ({ messages: state.messages.filter(m => m.id !== messageId) }));
  },

  startNewChat: () => {
    set({ activeConversationId: null, messages: [], streamingText: '', error: null, streamingPhase: null });
  },
}));

// Selector hooks for performance
export const useMessages = () => useChatStore(s => s.messages);
export const useConversations = () => useChatStore(s => s.conversations);
export const useActiveConversationId = () => useChatStore(s => s.activeConversationId);
export const useIsStreaming = () => useChatStore(s => s.isStreaming);
export const useStreamingPhase = () => useChatStore(s => s.streamingPhase);
export const useStreamingText = () => useChatStore(s => s.streamingText);

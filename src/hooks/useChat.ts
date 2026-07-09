import { useCallback, useRef } from 'react';
import { useChatStore, type Source, type Message } from '@/stores/chat-store';
import { useVoiceStore } from '@/stores/voice-store';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function getAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${API_KEY}`;
}

function parseSSELine(line: string): { type: string; [key: string]: unknown } | null {
  if (!line.startsWith('data: ')) return null;
  const data = line.slice(6).trim();
  if (data === '[DONE]') return { type: 'done' };
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function useChat() {
  const store = useChatStore();
  const voiceStore = useVoiceStore();
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string, conversationIdOverride?: string | null) => {
    if (!content.trim()) return;

    // Abort any ongoing request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const userMsgId = uuidv4();
    const assistantMsgId = uuidv4();

    // Add user message immediately
    const userMsg: Message = {
      id: userMsgId,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };
    store.addMessage(userMsg);

    // Create conversation if needed
    let convId = conversationIdOverride ?? store.activeConversationId;
    if (!convId) {
      try {
        convId = await store.createConversation(content);
      } catch (e) {
        store.setError('Failed to create conversation. Please try again.');
        store.removeMessage(userMsgId);
        return;
      }
    }

    store.setIsStreaming(true);
    store.setStreamingPhase('searching');
    store.setStreamingText('');
    store.setError(null);

    const { settings } = voiceStore;

    try {
      const auth = await getAuthHeader();
      const response = await fetch(`${FUNCTIONS_URL}/voice-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth,
          apikey: API_KEY,
        },
        body: JSON.stringify({
          question: content,
          conversationId: convId,
          personality: settings.personality,
          speed: settings.speed,
          language: settings.language,
          stream: true,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let sources: Source[] = [];
      let confidence: number | undefined;
      let isLowConfidence = false;

      // Show assistant placeholder
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        streaming: true,
      };
      store.addMessage(assistantMsg);
      store.setStreamingPhase('thinking');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const parsed = parseSSELine(line);
          if (!parsed) continue;

          if (parsed.type === 'metadata') {
            if (parsed.conversationId) store.setActiveConversation(parsed.conversationId as string);
            sources = (parsed.sources as Source[]) || [];
            confidence = parsed.confidence as number;
            isLowConfidence = Boolean(parsed.isLowConfidence);
            store.setStreamingPhase('generating');
          } else if (parsed.type === 'chunk') {
            const chunk = (parsed.text as string) || '';
            fullText += chunk;
            store.appendStreamingText(chunk);
            // Update the assistant message in real-time
            store.updateMessage(assistantMsgId, { content: fullText, streaming: true });
          } else if (parsed.type === 'done') {
            const finalText = (parsed.fullAnswer as string) || fullText;
            store.updateMessage(assistantMsgId, {
              content: finalText,
              sources,
              confidence,
              isLowConfidence,
              streaming: false,
            });
            // Reload conversations to update titles
            store.loadConversations();
            break;
          } else if (parsed.type === 'error') {
            throw new Error((parsed.error as string) || 'Stream error');
          }
        }
      }

    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        store.removeMessage(assistantMsgId);
        return;
      }
      const errMsg = (e as Error).message || 'Something went wrong. Please try again.';
      store.setError(errMsg);
      store.removeMessage(assistantMsgId);
    } finally {
      store.setIsStreaming(false);
      store.setStreamingPhase(null);
      store.setStreamingText('');
    }
  }, [store, voiceStore]);

  const regenerateMessage = useCallback(async (messageId: string) => {
    const { messages, activeConversationId } = useChatStore.getState();
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex < 0) return;

    // Find the user message before this assistant message
    let userContent = '';
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userContent = messages[i].content;
        break;
      }
    }
    if (!userContent) return;

    // Remove the assistant message and resend
    store.removeMessage(messageId);
    await sendMessage(userContent, activeConversationId);
  }, [store, sendMessage]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    store.setIsStreaming(false);
    store.setStreamingPhase(null);
    store.setStreamingText('');
  }, [store]);

  return {
    sendMessage,
    regenerateMessage,
    stopGeneration,
  };
}

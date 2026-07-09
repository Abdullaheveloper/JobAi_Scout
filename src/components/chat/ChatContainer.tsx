import { useEffect, useRef, useCallback, useState } from 'react';
import { useChatStore } from '@/stores/chat-store';
import { useChat } from '@/hooks/useChat';
import { useVoice } from '@/hooks/useVoice';
import { MessageBubble } from './MessageBubble';
import { StreamingIndicator } from './StreamingIndicator';
import { cn } from '@/lib/utils';
import { Send, Mic, MicOff, Square, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const SUGGESTED_PROMPTS = [
  { icon: '🎯', text: 'What services does Job Scout AI offer?' },
  { icon: '📄', text: 'How does the CV builder work?' },
  { icon: '🔍', text: 'How can I find the best jobs for my skills?' },
  { icon: '🤝', text: 'Tell me about pricing and plans' },
];

interface ChatContainerProps {
  className?: string;
}

export function ChatContainer({ className }: ChatContainerProps) {
  const store = useChatStore();
  const { sendMessage, stopGeneration } = useChat();
  const voice = useVoice();
  const [textInput, setTextInput] = useState('');
  const [rows, setRows] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [store.messages, store.streamingText]);

  // Auto-resize textarea
  useEffect(() => {
    const lines = (textInput.match(/\n/g) || []).length + 1;
    setRows(Math.min(6, Math.max(1, lines)));
  }, [textInput]);

  const handleSend = useCallback(async () => {
    const text = textInput.trim();
    if (!text || store.isStreaming) return;
    setTextInput('');
    setRows(1);
    await sendMessage(text);
  }, [textInput, store.isStreaming, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleMicClick = useCallback(() => {
    voice.toggleListening();
  }, [voice]);

  // Auto-submit when voice recognition finishes
  useEffect(() => {
    if (voice.transcript && !store.isStreaming) {
      setTextInput(voice.transcript);
      voice.clearTranscript();
    }
  }, [voice.transcript]);

  const isEmpty = store.messages.length === 0;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
      >
        {isEmpty ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/30">
              <Sparkles size={28} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">AI Knowledge Assistant</h2>
            <p className="text-white/50 text-sm mb-8 max-w-sm">
              Ask me anything about Job Scout AI, or upload documents to chat with your own knowledge base.
            </p>
            <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt.text)}
                  className="flex items-start gap-3 p-3.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-left transition-all group"
                >
                  <span className="text-lg">{prompt.icon}</span>
                  <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors leading-relaxed">{prompt.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Messages */
          <div className="max-w-3xl mx-auto">
            {store.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onRegenerate={message.role === 'assistant' ? () => {
                  // Find and regenerate
                } : undefined}
                onDelete={() => {
                  if (store.activeConversationId) {
                    store.deleteMessage(message.id, store.activeConversationId);
                  }
                }}
              />
            ))}

            {/* Streaming indicator */}
            {store.isStreaming && store.streamingPhase && store.streamingPhase !== 'generating' && (
              <StreamingIndicator phase={store.streamingPhase} className="ml-11" />
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-white/10 p-4">
        <div className="max-w-3xl mx-auto">
          {/* Voice interim transcript */}
          {voice.interimTranscript && (
            <div className="mb-2 px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
              <p className="text-sm text-indigo-300 italic">{voice.interimTranscript}...</p>
            </div>
          )}

          <div className="flex items-end gap-2">
            {/* Text input */}
            <div className="flex-1 relative">
              <Textarea
                ref={inputRef}
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  voice.state === 'listening' ? 'Listening...' :
                  store.isStreaming ? 'Generating response...' :
                  'Type a message or press the mic button...'
                }
                rows={rows}
                disabled={store.isStreaming}
                className={cn(
                  'resize-none bg-white/5 border-white/10 text-white placeholder:text-white/30',
                  'focus:border-indigo-500/50 focus:ring-0 focus:ring-offset-0',
                  'rounded-2xl px-4 py-3 text-sm transition-all',
                  store.isStreaming && 'opacity-50 cursor-not-allowed',
                )}
              />
            </div>

            {/* Mic button */}
            {voice.isRecognitionSupported && (
              <Button
                onClick={handleMicClick}
                disabled={store.isStreaming}
                size="sm"
                className={cn(
                  'h-10 w-10 rounded-xl flex-shrink-0 transition-all',
                  voice.state === 'listening'
                    ? 'bg-rose-500 hover:bg-rose-400 shadow-lg shadow-rose-500/40 animate-pulse'
                    : 'bg-white/10 hover:bg-white/20 text-white/70'
                )}
              >
                {voice.state === 'listening' ? <MicOff size={16} /> : <Mic size={16} />}
              </Button>
            )}

            {/* Send / Stop button */}
            <Button
              onClick={store.isStreaming ? stopGeneration : handleSend}
              disabled={!store.isStreaming && !textInput.trim()}
              size="sm"
              className={cn(
                'h-10 w-10 rounded-xl flex-shrink-0 transition-all',
                store.isStreaming
                  ? 'bg-rose-500 hover:bg-rose-400 shadow-lg shadow-rose-500/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/30 disabled:opacity-30 disabled:cursor-not-allowed'
              )}
            >
              {store.isStreaming ? <Square size={14} /> : <Send size={14} />}
            </Button>
          </div>

          <p className="text-xs text-white/20 text-center mt-2">
            Press Enter to send · Shift+Enter for new line · {voice.isRecognitionSupported ? 'Mic for voice input' : 'Voice not supported in this browser'}
          </p>
        </div>
      </div>
    </div>
  );
}

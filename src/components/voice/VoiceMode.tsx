import { useEffect, useState, useRef } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { useChatStore } from '@/stores/chat-store';
import { WaveformVisualizer } from './WaveformVisualizer';
import { VoiceStatusBadge } from './VoiceStatusBadge';
import { cn } from '@/lib/utils';
import { X, Mic, MicOff, Settings2, Sparkles, Volume2, Square, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VoiceModeProps {
  className?: string;
}

export function VoiceMode({ className }: VoiceModeProps) {
  const voice = useVoice();
  const store = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const playMessage = (id: string, text: string) => {
    window.speechSynthesis.cancel();
    if (playingId === id) {
      setPlayingId(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = voice.settings.speed || 1.0;
    utterance.onend = () => setPlayingId(null);
    utterance.onerror = () => setPlayingId(null);
    utteranceRef.current = utterance;
    setPlayingId(id);
    window.speechSynthesis.speak(utterance);
  };

  const stopPlaying = () => {
    window.speechSynthesis.cancel();
    setPlayingId(null);
  };

  const handleClose = () => {
    voice.stopListening();
    voice.stopSpeaking();
    stopPlaying();
    voice.toggleVoiceMode();
  };

  // Auto-start listening on mount when entering voice mode
  useEffect(() => {
    if (voice.isVoiceMode && voice.state === 'idle') {
      voice.startListening();
    }
  }, [voice.isVoiceMode]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [store.messages]);

  if (!voice.isVoiceMode) return null;

  const isListening = voice.state === 'listening';
  const isSpeaking = voice.state === 'speaking';
  const isThinking = voice.state === 'thinking' || voice.state === 'processing';

  return (
    <div className={cn(
      'fixed inset-0 z-50 flex flex-col justify-between items-center p-4 md:p-6',
      'bg-gradient-to-br from-[#090d1f] via-[#020514] to-[#040817] text-white',
      className
    )}>
      {/* Top Bar */}
      <div className="w-full max-w-3xl flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-xs font-semibold text-white/60 tracking-wider uppercase">Voice Assistant Mode</span>
        </div>
        <div className="flex items-center gap-2">
          <VoiceStatusBadge />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/10 rounded-full"
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 w-full max-w-3xl overflow-y-auto my-4 pr-2 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
        {store.messages.length === 0 ? (
          /* Empty state visual */
          <div className="h-full flex flex-col items-center justify-center text-center opacity-65">
            <div className="relative w-36 h-36 flex items-center justify-center mb-6">
              <div className={cn(
                'absolute inset-0 rounded-full border border-indigo-500/10 transition-all duration-1000 scale-125',
                isListening && 'scale-150 border-rose-500/15 animate-pulse',
                isSpeaking && 'scale-140 border-blue-500/25',
              )} />
              <div className={cn(
                'w-28 h-28 rounded-full bg-gradient-to-br transition-all duration-500 ease-out flex items-center justify-center relative shadow-2xl',
                isListening
                  ? 'from-rose-500/20 to-pink-600/20 shadow-rose-500/10'
                  : isSpeaking
                    ? 'from-blue-500/20 to-indigo-600/20 shadow-blue-500/10'
                    : isThinking
                      ? 'from-indigo-600/30 to-violet-700/30 shadow-indigo-600/20 scale-95 animate-pulse'
                      : 'from-indigo-500/10 to-violet-600/10 shadow-indigo-500/5'
              )}>
                {isThinking ? (
                  <Sparkles size={24} className="text-indigo-300 animate-pulse" />
                ) : (
                  <Mic size={28} className={cn(isListening ? 'text-rose-400' : 'text-indigo-400')} />
                )}
              </div>
            </div>
            <p className="text-sm text-white/40">No messages in this session yet.</p>
            <p className="text-xs text-white/20 mt-1">Tap the microphone to start speaking</p>
          </div>
        ) : (
          /* Chat History Bubbles */
          <div className="space-y-4">
            {store.messages.map((message) => {
              const isUser = message.role === 'user';
              const isMsgPlaying = playingId === message.id;
              return (
                <div
                  key={message.id}
                  className={cn(
                    'flex items-start gap-3 max-w-[85%] transition-all duration-300',
                    isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                  )}
                >
                  {/* Avatar */}
                  <div className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center shrink-0 border text-xs',
                    isUser
                      ? 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                      : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                  )}>
                    {isUser ? <User size={14} /> : <Bot size={14} />}
                  </div>

                  {/* Bubble Content */}
                  <div className={cn(
                    'relative rounded-2xl p-4 text-sm leading-relaxed backdrop-blur-md border shadow-sm transition-all',
                    isUser
                      ? 'bg-gradient-to-br from-rose-500/10 to-pink-600/10 border-rose-500/20 text-rose-100 rounded-tr-none'
                      : 'bg-gradient-to-br from-indigo-500/10 to-violet-600/10 border-indigo-500/20 text-indigo-100 rounded-tl-none'
                  )}>
                    <p className="whitespace-pre-wrap">{message.content}</p>

                    {/* Audio controls for this bubble */}
                    <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-white/30">
                      <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => isMsgPlaying ? stopPlaying() : playMessage(message.id, message.content)}
                        className={cn(
                          'h-6 w-6 rounded-full hover:bg-white/10 text-white/50 hover:text-white',
                          isMsgPlaying && 'text-indigo-400 animate-pulse'
                        )}
                      >
                        {isMsgPlaying ? <Square size={10} /> : <Volume2 size={12} />}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Transcription status indicator */}
      <div className="w-full max-w-3xl px-4 min-h-[2rem] flex items-center justify-center text-center">
        {isListening && (
          <p className="text-sm font-medium text-rose-300/80 leading-relaxed italic animate-pulse">
            {voice.interimTranscript || voice.transcript || 'Listening... speak now'}
          </p>
        )}
        {isThinking && (
          <p className="text-xs font-semibold tracking-wider text-indigo-400 uppercase animate-pulse flex items-center gap-1.5">
            <Sparkles size={12} className="animate-spin" /> Thinking...
          </p>
        )}
      </div>

      {/* Waveform Visualizer */}
      <div className="w-full max-w-md my-2">
        <WaveformVisualizer
          volume={voice.volume}
          isActive={isListening || isSpeaking}
          color={isListening ? 'rose' : isSpeaking ? 'indigo' : 'indigo'}
        />
      </div>

      {/* Action Controls */}
      <div className="w-full max-w-md flex items-center justify-center gap-6 border-t border-white/5 pt-4">
        {/* Settings button */}
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
        >
          <Settings2 size={18} />
        </Button>

        {/* Main mic action button */}
        <Button
          onClick={voice.toggleListening}
          size="icon"
          className={cn(
            'h-16 w-16 rounded-full transition-all duration-300 shadow-xl scale-100 hover:scale-105 active:scale-95',
            isListening
              ? 'bg-rose-500 hover:bg-rose-400 shadow-rose-500/30'
              : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/30'
          )}
        >
          {isListening ? <MicOff size={22} /> : <Mic size={22} />}
        </Button>

        {/* Speak interrupt button */}
        <Button
          onClick={() => { voice.stopSpeaking(); stopPlaying(); }}
          disabled={!isSpeaking && !playingId}
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <X size={18} />
        </Button>
      </div>

      {/* Footer support notice */}
      <p className="text-[9px] text-white/15 uppercase tracking-widest mt-2">
        JobAI Voice Workspace Mode
      </p>
    </div>
  );
}
export default VoiceMode;

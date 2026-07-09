import { useEffect } from 'react';
import { useVoice } from '@/hooks/useVoice';
import { useChatStore } from '@/stores/chat-store';
import { WaveformVisualizer } from './WaveformVisualizer';
import { VoiceStatusBadge } from './VoiceStatusBadge';
import { cn } from '@/lib/utils';
import { X, Mic, MicOff, Settings2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VoiceModeProps {
  className?: string;
}

export function VoiceMode({ className }: VoiceModeProps) {
  const voice = useVoice();
  const store = useChatStore();

  const handleClose = () => {
    voice.stopListening();
    voice.stopSpeaking();
    voice.toggleVoiceMode();
  };

  // Auto-start listening on mount when entering voice mode
  useEffect(() => {
    if (voice.isVoiceMode && voice.state === 'idle') {
      voice.startListening();
    }
  }, [voice.isVoiceMode]);

  if (!voice.isVoiceMode) return null;

  const isListening = voice.state === 'listening';
  const isSpeaking = voice.state === 'speaking';
  const isThinking = voice.state === 'thinking' || voice.state === 'processing';

  return (
    <div className={cn(
      'fixed inset-0 z-50 flex flex-col justify-between items-center p-6',
      'bg-gradient-to-br from-[#090d1f] via-[#020514] to-[#040817] text-white',
      className
    )}>
      {/* Top Bar */}
      <div className="w-full max-w-3xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-xs font-semibold text-white/50 tracking-wider uppercase">Voice Assistant</span>
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

      {/* Main Orb View */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg relative">
        {/* Glowing Orb */}
        <div className="relative w-48 h-48 flex items-center justify-center">
          {/* Outer ring */}
          <div className={cn(
            'absolute inset-0 rounded-full border border-indigo-500/10 transition-all duration-1000 scale-125',
            isListening && 'scale-150 border-rose-500/10 animate-pulse',
            isSpeaking && 'scale-140 border-blue-500/20',
          )} />

          {/* Core sphere */}
          <div className={cn(
            'w-36 h-36 rounded-full bg-gradient-to-br transition-all duration-500 ease-out flex items-center justify-center relative shadow-2xl',
            isListening
              ? 'from-rose-500/30 to-pink-600/30 shadow-rose-500/20'
              : isSpeaking
                ? 'from-blue-500/30 to-indigo-600/30 shadow-blue-500/20'
                : isThinking
                  ? 'from-indigo-600/40 to-violet-700/40 shadow-indigo-600/30 scale-95 animate-pulse'
                  : 'from-indigo-500/20 to-violet-600/20 shadow-indigo-500/10'
          )}>
            {/* Spinning/pulsing inner child */}
            <div className={cn(
              'absolute inset-1.5 rounded-full border border-white/10 flex items-center justify-center',
              isThinking && 'animate-spin border-t-indigo-400 border-r-transparent'
            )}>
              {isThinking ? (
                <Sparkles size={24} className="text-indigo-300 animate-pulse" />
              ) : (
                <div className={cn(
                  'w-20 h-20 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center',
                  (isListening || isSpeaking) && 'animate-ping'
                )} />
              )}
            </div>
          </div>
        </div>

        {/* Live Transcript Display */}
        <div className="mt-12 text-center max-w-md px-4 min-h-[4rem]">
          {isListening ? (
            <p className="text-lg font-medium text-white/95 leading-relaxed italic">
              {voice.interimTranscript || voice.transcript || 'Listening... speak now'}
            </p>
          ) : isSpeaking ? (
            <p className="text-lg font-medium text-white/80 leading-relaxed max-h-32 overflow-y-auto">
              {store.messages[store.messages.length - 1]?.content || 'Responding...'}
            </p>
          ) : isThinking ? (
            <p className="text-sm font-medium text-white/40 leading-relaxed animate-pulse">
              Generating response...
            </p>
          ) : (
            <p className="text-sm font-medium text-white/30">
              Tap the button to start speaking
            </p>
          )}
        </div>
      </div>

      {/* Waveform Visualizer */}
      <div className="w-full max-w-md mb-6">
        <WaveformVisualizer
          volume={voice.volume}
          isActive={isListening || isSpeaking}
          color={isListening ? 'rose' : isSpeaking ? 'indigo' : 'indigo'}
        />
      </div>

      {/* Action Controls */}
      <div className="w-full max-w-md flex items-center justify-center gap-6 mb-4">
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
            'h-16 w-16 rounded-full transition-all duration-300 shadow-xl',
            isListening
              ? 'bg-rose-500 hover:bg-rose-400 shadow-rose-500/30'
              : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/30'
          )}
        >
          {isListening ? <MicOff size={22} /> : <Mic size={22} />}
        </Button>

        {/* Speak interrupt button */}
        <Button
          onClick={voice.stopSpeaking}
          disabled={!isSpeaking}
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <X size={18} />
        </Button>
      </div>

      {/* Footer support notice */}
      <p className="text-[10px] text-white/15 uppercase tracking-widest">
        Free Browser STT & TTS Pipeline Active
      </p>
    </div>
  );
}
export default VoiceMode;

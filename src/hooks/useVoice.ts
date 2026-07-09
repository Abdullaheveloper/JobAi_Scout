import { useCallback, useRef, useEffect } from 'react';
import { useVoiceStore } from '@/stores/voice-store';
import { VoiceRecognition } from '@/lib/voice/recognition';
import { voiceSynthesis } from '@/lib/voice/synthesis';
import { VoiceActivityDetector } from '@/lib/voice/vad';
import { useChat } from './useChat';

export function useVoice() {
  const store = useVoiceStore();
  const { sendMessage } = useChat();
  const recognitionRef = useRef<VoiceRecognition | null>(null);
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopListening();
      voiceSynthesis.stop();
    };
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return;
    store.setState('speaking');
    try {
      await voiceSynthesis.speak(text, {
        rate: store.settings.speed,
        pitch: store.settings.pitch,
        language: store.settings.language,
        onEnd: () => {
          if (isMountedRef.current) store.setState('idle');
        },
        onError: () => {
          if (isMountedRef.current) store.setState('idle');
        },
      });
    } catch {
      if (isMountedRef.current) store.setState('idle');
    }
  }, [store]);

  const stopSpeaking = useCallback(() => {
    voiceSynthesis.stop();
    if (isMountedRef.current) store.setState('idle');
  }, [store]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    vadRef.current?.stop();
    vadRef.current = null;
    if (isMountedRef.current && store.state === 'listening') {
      store.setState('idle');
    }
  }, [store]);

  const startListening = useCallback(async () => {
    if (store.state !== 'idle' && store.state !== 'error') return;
    if (voiceSynthesis.isSpeaking) voiceSynthesis.stop();

    store.clearTranscript();
    store.setState('listening');

    // Try Web Speech API first
    if (VoiceRecognition.isSupported()) {
      const recognition = new VoiceRecognition();
      recognitionRef.current = recognition;

      const started = recognition.start({
        language: store.settings.language,
        continuous: false,
        interimResults: true,
        onResult: (transcript, isFinal) => {
          if (isFinal) {
            store.setTranscript(transcript);
            stopListening();
            // Submit after final recognition
            if (transcript.trim()) {
              store.setState('processing');
              handleSubmit(transcript);
            }
          } else {
            store.setInterimTranscript(transcript);
          }
        },
        onError: (error) => {
          if (!isMountedRef.current) return;
          if (error) store.setError(error);
          else store.setState('idle');
        },
        onEnd: () => {
          if (isMountedRef.current && store.state === 'listening') {
            store.setState('idle');
          }
        },
      });

      if (!started) {
        // Fallback to VAD-based recording
        await startVADMode();
      }
    } else {
      await startVADMode();
    }
  }, [store, stopListening]);

  const startVADMode = useCallback(async () => {
    const vad = new VoiceActivityDetector({
      silenceThreshold: 0.025,
      minSpeechMs: 400,
      minRecordMs: 1800,
      maxRecordMs: 30000,
      onVolumeChange: (level) => store.setVolume(level),
      onSpeechEnd: async () => {
        // When VAD detects end of speech, the transcript is in store
        const text = store.transcript;
        if (text.trim()) {
          store.setState('processing');
          handleSubmit(text);
        } else {
          store.setState('idle');
        }
        vad.stop();
      },
      onError: (err) => {
        if (isMountedRef.current) store.setError(err);
      },
    });
    vadRef.current = vad;
    const stream = await vad.start();
    if (!stream) {
      store.setError('Could not access microphone.');
    }
  }, [store]);

  const handleSubmit = useCallback(async (text: string) => {
    if (!text.trim()) return;
    store.setState('thinking');
    try {
      await sendMessage(text);
    } catch {
      store.setState('error');
    }
  }, [store, sendMessage]);

  const toggleListening = useCallback(() => {
    if (store.state === 'listening') {
      stopListening();
    } else if (store.state === 'speaking') {
      stopSpeaking();
    } else if (store.state === 'idle' || store.state === 'error') {
      startListening();
    }
  }, [store.state, startListening, stopListening, stopSpeaking]);

  return {
    state: store.state,
    transcript: store.transcript,
    interimTranscript: store.interimTranscript,
    volume: store.volume,
    isVoiceMode: store.isVoiceMode,
    settings: store.settings,
    speak,
    stopSpeaking,
    startListening,
    stopListening,
    toggleListening,
    toggleVoiceMode: store.toggleVoiceMode,
    updateSettings: store.updateSettings,
    clearTranscript: store.clearTranscript,
    isRecognitionSupported: VoiceRecognition.isSupported(),
    isTTSSupported: typeof window !== 'undefined' && 'speechSynthesis' in window,
  };
}

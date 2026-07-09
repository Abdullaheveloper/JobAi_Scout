import { create } from 'zustand';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'thinking' | 'speaking' | 'error' | 'offline';

export interface VoiceSettings {
  language: string;
  personality: string;
  speed: number;
  pitch: number;
  silenceTimeoutS: number;
  autoSpeak: boolean;
  continuousMode: boolean;
}

const DEFAULT_SETTINGS: VoiceSettings = {
  language: 'en',
  personality: 'professional',
  speed: 1.0,
  pitch: 1.0,
  silenceTimeoutS: 2,
  autoSpeak: true,
  continuousMode: false,
};

interface VoiceStoreState {
  state: VoiceState;
  transcript: string;
  interimTranscript: string;
  volume: number;
  isVoiceMode: boolean;
  settings: VoiceSettings;
  errorMsg: string | null;
  micPermission: 'unknown' | 'granted' | 'denied';

  // Actions
  setState: (state: VoiceState) => void;
  setTranscript: (text: string) => void;
  setInterimTranscript: (text: string) => void;
  appendTranscript: (text: string) => void;
  clearTranscript: () => void;
  setVolume: (level: number) => void;
  toggleVoiceMode: () => void;
  setVoiceMode: (mode: boolean) => void;
  updateSettings: (settings: Partial<VoiceSettings>) => void;
  setError: (msg: string | null) => void;
  setMicPermission: (perm: 'unknown' | 'granted' | 'denied') => void;
}

export const useVoiceStore = create<VoiceStoreState>((set) => ({
  state: 'idle',
  transcript: '',
  interimTranscript: '',
  volume: 0,
  isVoiceMode: false,
  settings: DEFAULT_SETTINGS,
  errorMsg: null,
  micPermission: 'unknown',

  setState: (state) => set({ state, errorMsg: state !== 'error' ? null : undefined }),
  setTranscript: (transcript) => set({ transcript, interimTranscript: '' }),
  setInterimTranscript: (interimTranscript) => set({ interimTranscript }),
  appendTranscript: (text) => set(s => ({ transcript: s.transcript + ' ' + text })),
  clearTranscript: () => set({ transcript: '', interimTranscript: '' }),
  setVolume: (volume) => set({ volume }),
  toggleVoiceMode: () => set(s => ({ isVoiceMode: !s.isVoiceMode })),
  setVoiceMode: (isVoiceMode) => set({ isVoiceMode }),
  updateSettings: (settings) => set(s => ({ settings: { ...s.settings, ...settings } })),
  setError: (errorMsg) => set({ errorMsg, state: errorMsg ? 'error' : 'idle' }),
  setMicPermission: (micPermission) => set({ micPermission }),
}));

// Selector hooks
export const useVoiceState = () => useVoiceStore(s => s.state);
export const useVoiceSettings = () => useVoiceStore(s => s.settings);
export const useIsVoiceMode = () => useVoiceStore(s => s.isVoiceMode);
export const useVoiceVolume = () => useVoiceStore(s => s.volume);
export const useVoiceTranscript = () => useVoiceStore(s => ({ transcript: s.transcript, interim: s.interimTranscript }));

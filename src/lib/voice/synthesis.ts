// Voice Synthesis Module - Uses free Browser SpeechSynthesis API

const LANG_TO_BCP47: Record<string, string> = {
  en: 'en-US',
  ur: 'ur-PK',
  ar: 'ar-SA',
  hi: 'hi-IN',
  fr: 'fr-FR',
  de: 'de-DE',
};

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  language?: string;
  onBoundary?: (charIndex: number, charLength: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: string) => void;
}

export class VoiceSynthesis {
  private utterance: SpeechSynthesisUtterance | null = null;
  private _isSpeaking = false;

  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  get isSpeaking(): boolean {
    return this._isSpeaking;
  }

  getVoices(): SpeechSynthesisVoice[] {
    if (!VoiceSynthesis.isSupported()) return [];
    return window.speechSynthesis.getVoices();
  }

  getBestVoice(language = 'en'): SpeechSynthesisVoice | null {
    const voices = this.getVoices();
    const bcp47 = LANG_TO_BCP47[language] || language;
    const langCode = bcp47.split('-')[0];
    const preferred = ['Google', 'Microsoft', 'Apple', 'Amazon'];
    for (const brand of preferred) {
      const match = voices.find(v => v.lang === bcp47 && v.name.includes(brand));
      if (match) return match;
    }
    for (const brand of preferred) {
      const match = voices.find(v => v.lang.startsWith(langCode) && v.name.includes(brand));
      if (match) return match;
    }
    return voices.find(v => v.lang.startsWith(langCode)) || voices[0] || null;
  }

  async speak(text: string, options: SpeakOptions = {}): Promise<void> {
    if (!VoiceSynthesis.isSupported() || !text.trim()) return;
    return new Promise((resolve) => {
      window.speechSynthesis.cancel();
      this._isSpeaking = false;
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        this.utterance = utterance;
        utterance.rate = Math.max(0.5, Math.min(2.0, options.rate ?? 1.0));
        utterance.pitch = Math.max(0, Math.min(2, options.pitch ?? 1.0));
        utterance.volume = Math.max(0, Math.min(1, options.volume ?? 1.0));
        const voice = this.getBestVoice(options.language || 'en');
        if (voice) utterance.voice = voice;
        utterance.lang = LANG_TO_BCP47[options.language || 'en'] || 'en-US';
        let keepAlive: ReturnType<typeof setInterval>;
        const cleanup = () => {
          clearInterval(keepAlive);
          this._isSpeaking = false;
          this.utterance = null;
        };
        utterance.onstart = () => { this._isSpeaking = true; options.onStart?.(); };
        utterance.onend = () => { cleanup(); options.onEnd?.(); resolve(); };
        utterance.onerror = (event) => {
          cleanup();
          if (event.error !== 'interrupted' && event.error !== 'canceled') {
            options.onError?.(`TTS error: ${event.error}`);
          }
          resolve();
        };
        utterance.onboundary = (event) => {
          if (event.name === 'word') options.onBoundary?.(event.charIndex, event.charLength ?? 1);
        };
        this._isSpeaking = true;
        window.speechSynthesis.speak(utterance);
        keepAlive = setInterval(() => {
          if (!this._isSpeaking) { clearInterval(keepAlive); return; }
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }, 10000);
      }, 50);
    });
  }

  stop(): void {
    this._isSpeaking = false;
    this.utterance = null;
    if (VoiceSynthesis.isSupported()) window.speechSynthesis.cancel();
  }

  pause(): void { if (VoiceSynthesis.isSupported()) window.speechSynthesis.pause(); }
  resume(): void { if (VoiceSynthesis.isSupported()) window.speechSynthesis.resume(); }
}

export const voiceSynthesis = new VoiceSynthesis();

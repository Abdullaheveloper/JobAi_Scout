// Voice Recognition Module
// Primary: Browser Web Speech API

export interface RecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
  onStart?: () => void;
}

const LANG_MAP: Record<string, string> = {
  en: 'en-US',
  ur: 'ur-PK',
  ar: 'ar-SA',
  hi: 'hi-IN',
  fr: 'fr-FR',
  de: 'de-DE',
};

export class VoiceRecognition {
  private recognition: SpeechRecognition | null = null;
  private options: RecognitionOptions = {};
  private restartOnEnd = false;
  private active = false;

  static isSupported(): boolean {
    return typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  }

  start(options: RecognitionOptions = {}): boolean {
    if (!VoiceRecognition.isSupported()) return false;
    this.options = options;
    this.restartOnEnd = options.continuous ?? true;
    this._initRecognition();
    try {
      this.recognition!.start();
      this.active = true;
      return true;
    } catch {
      return false;
    }
  }

  stop(): void {
    this.restartOnEnd = false;
    this.active = false;
    try { this.recognition?.stop(); } catch { /* ignore */ }
    this.recognition = null;
  }

  isActive(): boolean { return this.active; }

  private _initRecognition(): void {
    const SpeechRec = (window as Record<string, unknown>)['SpeechRecognition'] as typeof SpeechRecognition ||
      (window as Record<string, unknown>)['webkitSpeechRecognition'] as typeof SpeechRecognition;
    if (!SpeechRec) return;

    this.recognition = new SpeechRec();
    const lang = this.options.language || 'en';
    this.recognition.lang = LANG_MAP[lang] || lang;
    this.recognition.continuous = this.options.continuous ?? false;
    this.recognition.interimResults = this.options.interimResults ?? true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.active = true;
      this.options.onStart?.();
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) {
        this.options.onResult?.(final, true);
      } else if (interim) {
        this.options.onResult?.(interim, false);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMap: Record<string, string> = {
        'not-allowed': 'Microphone access denied. Please allow microphone access and try again.',
        'no-speech': 'No speech detected. Please try speaking again.',
        'audio-capture': 'Microphone not found. Please check your audio settings.',
        'network': 'Network error during speech recognition.',
        'aborted': '',
        'service-not-allowed': 'Speech recognition not allowed in this context.',
      };
      const msg = errorMap[event.error] ?? `Speech recognition error: ${event.error}`;
      if (msg) this.options.onError?.(msg);
      this.active = false;
    };

    this.recognition.onend = () => {
      this.active = false;
      if (this.restartOnEnd && this.recognition) {
        setTimeout(() => {
          if (this.restartOnEnd) {
            try { this._initRecognition(); this.recognition!.start(); this.active = true; } catch { /* ignore */ }
          }
        }, 200);
      } else {
        this.options.onEnd?.();
      }
    };
  }
}

export const voiceRecognition = new VoiceRecognition();

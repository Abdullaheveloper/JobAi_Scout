// Voice Activity Detection

export interface VADOptions {
  silenceThreshold?: number;
  minSpeechMs?: number;
  minRecordMs?: number;
  maxRecordMs?: number;
  onSpeechStart?: () => void;
  onSpeechEnd?: (durationMs: number) => void;
  onVolumeChange?: (level: number) => void;
  onError?: (err: string) => void;
}

export class VoiceActivityDetector {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private rafId: number | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private maxTimer: ReturnType<typeof setTimeout> | null = null;
  private speechStartTime = 0;
  private recordStartTime = 0;
  private isSpeaking = false;
  private active = false;
  private options: Required<VADOptions>;

  constructor(options: VADOptions = {}) {
    this.options = {
      silenceThreshold: options.silenceThreshold ?? 0.025,
      minSpeechMs: options.minSpeechMs ?? 400,
      minRecordMs: options.minRecordMs ?? 1800,
      maxRecordMs: options.maxRecordMs ?? 30000,
      onSpeechStart: options.onSpeechStart ?? (() => {}),
      onSpeechEnd: options.onSpeechEnd ?? (() => {}),
      onVolumeChange: options.onVolumeChange ?? (() => {}),
      onError: options.onError ?? (() => {}),
    };
  }

  async start(): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.stream = stream;
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      this.analyser = analyser;
      this.active = true;
      this.recordStartTime = Date.now();
      this._tick();
      this.maxTimer = setTimeout(() => { if (this.active) this.stop(); }, this.options.maxRecordMs);
      return stream;
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      if (err.includes('Permission') || err.includes('denied')) {
        this.options.onError('Microphone access denied. Please allow access and try again.');
      } else {
        this.options.onError(`Could not start microphone: ${err}`);
      }
      return null;
    }
  }

  stop(): void {
    this.active = false;
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null; }
    if (this.maxTimer) { clearTimeout(this.maxTimer); this.maxTimer = null; }
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;
    this.analyser = null;
    this.isSpeaking = false;
  }

  getStream(): MediaStream | null { return this.stream; }
  getAnalyser(): AnalyserNode | null { return this.analyser; }

  private _tick(): void {
    if (!this.active || !this.analyser) return;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    const avg = sum / data.length / 255;
    this.options.onVolumeChange(avg);
    const elapsed = Date.now() - this.recordStartTime;
    if (avg > this.options.silenceThreshold) {
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.speechStartTime = Date.now();
        this.options.onSpeechStart();
      }
      if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null; }
    } else if (this.isSpeaking) {
      const speechDuration = Date.now() - this.speechStartTime;
      const meetsMinSpeech = speechDuration >= this.options.minSpeechMs;
      const meetsMinRecord = elapsed >= this.options.minRecordMs;
      if (!this.silenceTimer && meetsMinSpeech && meetsMinRecord) {
        this.silenceTimer = setTimeout(() => {
          if (this.active) {
            const duration = Date.now() - this.speechStartTime;
            this.options.onSpeechEnd(duration);
            this.isSpeaking = false;
            this.stop();
          }
        }, 1200);
      }
    }
    this.rafId = requestAnimationFrame(() => this._tick());
  }
}

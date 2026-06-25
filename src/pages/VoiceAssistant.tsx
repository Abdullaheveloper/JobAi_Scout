import { useEffect, useRef, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mic, MicOff, Loader2, Volume2, Square, Globe, Trash2, RefreshCw, CheckCircle2,
  Clock, AlertCircle, FileText, Upload, Settings2, Languages, History, X,
  MessageSquare, Zap, WifiOff, AlertTriangle, Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────
type Msg = {
  role: "user" | "assistant";
  content: string;
  sources?: { url: string; title: string }[];
  confidence?: number;
  language?: string;
};

type VoiceState =
  | "idle"
  | "listening"
  | "processing"
  | "thinking"
  | "speaking"
  | "error"
  | "offline";

type Source = {
  id: string;
  url: string;
  title: string | null;
  status: string;
  pages_indexed: number;
  last_crawled_at: string | null;
  error: string | null;
};

type Conversation = { id: string; title: string | null; created_at: string };

// ─── Constants ────────────────────────────────────────────────────────────────
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ur", label: "اردو", flag: "🇵🇰" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
];

const PERSONALITIES = [
  { value: "professional", label: "Professional", icon: "👔" },
  { value: "friendly", label: "Friendly", icon: "😊" },
  { value: "recruiter", label: "Recruiter", icon: "💼" },
  { value: "support", label: "Support", icon: "🎧" },
];

const SPEEDS = [
  { value: 0.75, label: "0.75×" },
  { value: 1.0, label: "1×" },
  { value: 1.25, label: "1.25×" },
  { value: 1.5, label: "1.5×" },
];

// ─── VAD tuning ───────────────────────────────────────────────────────────────
const VAD_SILENCE_THRESHOLD = 0.025;   // audio level below this = silence
const VAD_MIN_SPEECH_MS     = 400;     // must hear speech for this long before silence timer starts
const VAD_MIN_RECORD_MS     = 1800;    // keep mic open at least this long
const VAD_MAX_RECORD_MS     = 30_000;  // hard cap

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isMimeSupported(mime: string) {
  try { return MediaRecorder.isTypeSupported(mime); } catch { return false; }
}
function bestMime() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return candidates.find(isMimeSupported) || "";
}
function fileExtFromMime(mime: string) {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function VoiceAssistant() {
  const { toast } = useToast();

  // ── State ──────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<VoiceState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [currentConfidence, setCurrentConfidence] = useState<number | null>(null);
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");

  // Settings
  const [personality, setPersonality] = useState("professional");
  const [speed, setSpeed] = useState(1.0);
  const [language, setLanguage] = useState("en");
  const [silenceTimeout, setSilenceTimeout] = useState(2);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // KB state
  const [sources, setSources] = useState<Source[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [indexing, setIndexing] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const recorderRef      = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const streamRef        = useRef<MediaStream | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const analyserRef      = useRef<AnalyserNode | null>(null);
  const rafRef           = useRef<number | null>(null);
  const audioElRef       = useRef<HTMLAudioElement | null>(null);
  const silenceTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechStartRef   = useRef<number>(0);
  const recordStartRef   = useRef<number>(0);
  const vadActiveRef     = useRef(false);
  const abortRef         = useRef<AbortController | null>(null);
  const scrollRef        = useRef<HTMLDivElement>(null);
  const levelRef         = useRef(0);
  const waveformRef      = useRef<HTMLDivElement | null>(null);
  const statusRef        = useRef<VoiceState>("idle");

  // Keep statusRef in sync
  useEffect(() => { statusRef.current = status; }, [status]);

  // ── Waveform Animation ─────────────────────────────────────────────────────
  useEffect(() => {
    let animId: number;
    const updateWaveform = () => {
      if (waveformRef.current) {
        const spans = waveformRef.current.children;
        const isActive = statusRef.current === "listening" || statusRef.current === "speaking";
        for (let i = 0; i < spans.length; i++) {
          const span = spans[i] as HTMLSpanElement;
          if (isActive) {
            const level = statusRef.current === "listening" ? levelRef.current : 0.12 * (1 + Math.sin(Date.now() / 120));
            const base = 5 + Math.abs(Math.sin(Date.now() / 200 + i * 0.4)) * 10;
            span.style.height = `${Math.max(4, base + level * 44)}px`;
          } else {
            span.style.height = "4px";
          }
        }
      }
      animId = requestAnimationFrame(updateWaveform);
    };
    animId = requestAnimationFrame(updateWaveform);
    return () => cancelAnimationFrame(animId);
  }, []); // runs once, reads statusRef imperatively — no stale closure

  // ── Auth Helper ────────────────────────────────────────────────────────────
  const getAuth = useCallback(async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${API_KEY}`;
  }, []);

  // ── Data Loaders ──────────────────────────────────────────────────────────
  const loadSources = useCallback(async () => {
    try {
      const { data } = await supabase.from("kb_sources").select("*").order("created_at", { ascending: false });
      setSources((data as Source[]) || []);
    } catch { /* silent */ }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("voice_conversations")
        .select("id,title,created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      setConversations((data as Conversation[]) || []);
    } catch { /* silent */ }
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    const { data: msgs } = await supabase
      .from("voice_messages")
      .select("role,content")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    setMessages((msgs || []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    setConversationId(id);
    setShowHistory(false);
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const auth = await getAuth();
      const resp = await fetch(`${FUNCTIONS_URL}/voice-settings`, {
        headers: { Authorization: auth, apikey: API_KEY },
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json.user?.preferred_personality) setPersonality(json.user.preferred_personality);
        if (json.user?.preferred_speed) setSpeed(json.user.preferred_speed);
        if (json.user?.preferred_language) setLanguage(json.user.preferred_language);
        if (json.global?.silence_timeout) setSilenceTimeout(json.global.silence_timeout);
      }
    } catch { /* ignore */ }
  }, [getAuth]);

  useEffect(() => {
    loadSources();
    loadConversations();
    loadSettings();
  }, [loadSources, loadConversations, loadSettings]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const tearDown = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    vadActiveRef.current = false;
    levelRef.current = 0;
    recorderRef.current = null;
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = "";
      audioElRef.current = null;
    }
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setStreamingText("");
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { tearDown(); stopSpeaking(); }, [tearDown, stopSpeaking]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // ── VAD: Voice Activity Detection ─────────────────────────────────────────
  const startVAD = useCallback((stream: MediaStream, ctx: AudioContext) => {
    try {
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      an.smoothingTimeConstant = 0.4;
      src.connect(an);
      analyserRef.current = an;
      const data = new Uint8Array(an.frequencyBinCount);

      const tick = () => {
        if (!analyserRef.current || statusRef.current !== "listening") return;
        an.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length / 255;
        levelRef.current = avg;

        const elapsed = Date.now() - recordStartRef.current;

        if (avg > VAD_SILENCE_THRESHOLD) {
          // ── Speech detected ──
          if (!vadActiveRef.current) {
            vadActiveRef.current = true;
            speechStartRef.current = Date.now();
          }
          // Cancel any pending silence timer
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (vadActiveRef.current) {
          // ── Silence after speech ──
          const speechDuration = Date.now() - speechStartRef.current;
          const meetsMinSpeech = speechDuration >= VAD_MIN_SPEECH_MS;
          const meetsMinRecord = elapsed >= VAD_MIN_RECORD_MS;

          if (meetsMinSpeech && meetsMinRecord && !silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              silenceTimerRef.current = null;
              if (recorderRef.current && recorderRef.current.state === "recording") {
                recorderRef.current.stop();
              }
            }, Math.max(800, silenceTimeout * 1000));
          }
        }
        // else: silence from the start — keep mic open (wait for speech)

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.warn("VAD init failed:", err);
    }
  }, [silenceTimeout]);

  // ── Process Audio ─────────────────────────────────────────────────────────
  const handleAudio = useCallback(async (blob: Blob, mimeType: string) => {
    setStatus("processing");
    setStreamingText("");
    setCurrentConfidence(null);
    setDetectedLang(null);
    setErrorMsg(null);

    try {
      const auth = await getAuth();

      // ── 1. Speech-to-Text ───────────────────────────────────────────────
      const ext = fileExtFromMime(mimeType);
      const fd = new FormData();
      fd.append("file", blob, `recording.${ext}`);
      fd.append("language", language);

      const sttResp = await fetch(`${FUNCTIONS_URL}/voice-transcribe`, {
        method: "POST",
        headers: { Authorization: auth, apikey: API_KEY },
        body: fd,
      });

      let sttJson: { text?: string; error?: string; language?: string } = {};
      try { sttJson = await sttResp.json(); } catch { /* bad JSON */ }

      if (!sttResp.ok) {
        throw new Error(sttJson.error || `Transcription failed (${sttResp.status})`);
      }

      const userText = (sttJson.text || "").trim();
      if (!userText) {
        setStatus("idle");
        toast({
          title: "Didn't catch that",
          description: "Please speak clearly and try again.",
        });
        return;
      }

      setMessages((m) => [...m, { role: "user", content: userText }]);
      setStatus("thinking");

      // ── 2. RAG Chat (streaming) ─────────────────────────────────────────
      const abort = new AbortController();
      abortRef.current = abort;

      const chatResp = await fetch(`${FUNCTIONS_URL}/voice-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: auth,
          apikey: API_KEY,
        },
        body: JSON.stringify({
          question: userText,
          conversationId,
          personality,
          speed,
          language,
          stream: true,
        }),
        signal: abort.signal,
      });

      if (!chatResp.ok) {
        let errMsg = `Chat error (${chatResp.status})`;
        try {
          const errJson = await chatResp.json();
          errMsg = errJson.error || errMsg;
        } catch { /* ignore */ }
        throw new Error(errMsg);
      }

      // ── Parse SSE Stream ───────────────────────────────────────────────
      const reader = chatResp.body!.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = "";
      let buffer = "";
      let meta: {
        conversationId?: string;
        sources?: Msg["sources"];
        confidence?: number;
        language?: string;
      } = {};

      setStatus("speaking");

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            const dataLine = part.replace(/^data: /, "").trim();
            if (!dataLine) continue;
            try {
              const parsed = JSON.parse(dataLine);
              if (parsed.type === "metadata") {
                meta = parsed;
                setConversationId(parsed.conversationId ?? null);
                setCurrentConfidence(parsed.confidence ?? null);
                setDetectedLang(parsed.language ?? null);
              } else if (parsed.type === "chunk") {
                fullAnswer += parsed.text;
                setStreamingText(fullAnswer);
              } else if (parsed.type === "done") {
                fullAnswer = parsed.fullAnswer || fullAnswer;
              } else if (parsed.type === "error") {
                throw new Error(parsed.error || "Stream error");
              }
            } catch (parseErr) {
              // Skip malformed SSE lines
            }
          }
        }
      } catch (streamErr) {
        if ((streamErr as Error).name === "AbortError") {
          setStatus("idle");
          return;
        }
        throw streamErr;
      }

      if (!fullAnswer) {
        fullAnswer = "I'm sorry, I couldn't generate a response. Please try again.";
      }

      // Finalise message
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: fullAnswer,
          sources: meta.sources,
          confidence: meta.confidence,
          language: meta.language,
        },
      ]);
      setStreamingText("");
      abortRef.current = null;

      // ── 3. Text-to-Speech ──────────────────────────────────────────────
      try {
        const ttsResp = await fetch(`${FUNCTIONS_URL}/elevenlabs-tts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: auth,
            apikey: API_KEY,
          },
          body: JSON.stringify({ text: fullAnswer.slice(0, 4500) }),
        });

        if (ttsResp.ok) {
          const audioBlob = await ttsResp.blob();
          const url = URL.createObjectURL(audioBlob);
          const audio = new Audio(url);
          audioElRef.current = audio;
          audio.playbackRate = speed;
          audio.onended = () => {
            setStatus("idle");
            URL.revokeObjectURL(url);
            audioElRef.current = null;
          };
          audio.onerror = () => {
            setStatus("idle");
            URL.revokeObjectURL(url);
            audioElRef.current = null;
          };
          await audio.play();
          // status stays "speaking" until onended
        } else {
          // TTS failed — show text only, not an error
          setStatus("idle");
        }
      } catch (ttsErr) {
        // TTS failure is non-fatal — answer is already visible as text
        setStatus("idle");
      }

      await loadConversations();
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") { setStatus("idle"); return; }
      console.error("handleAudio error:", err);
      setErrorMsg(err.message);
      setStatus("error");
    }
  }, [getAuth, language, conversationId, personality, speed, loadConversations, toast]);

  // ── Start Listening ────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    // Stop any current speech
    stopSpeaking();
    setStatus("idle");
    setErrorMsg(null);

    // Check browser support
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg("Your browser doesn't support microphone access. Try Chrome or Edge.");
      setStatus("offline");
      return;
    }

    // Create AudioContext synchronously inside user-gesture handler (Safari requirement)
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      try {
        const ctx = new AudioContextClass();
        await ctx.resume().catch(() => {});
        audioCtxRef.current = ctx;
      } catch (err) {
        console.warn("AudioContext init failed:", err);
      }
    }

    recordStartRef.current = Date.now();
    vadActiveRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      const mime = bestMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const usedMime = rec.mimeType || mime || "audio/webm";
      recorderRef.current = rec;
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: usedMime });
        tearDown();
        // Ignore tiny blobs (< 1KB = almost certainly empty)
        if (blob.size < 1024) {
          setStatus("idle");
          toast({ title: "No audio captured", description: "Please speak clearly after tapping the mic." });
          return;
        }
        await handleAudio(blob, usedMime);
      };

      rec.onerror = (e) => {
        console.error("MediaRecorder error:", e);
        tearDown();
        setErrorMsg("Recording error. Please try again.");
        setStatus("error");
      };

      rec.start(100); // fire ondataavailable every 100ms
      setStatus("listening");

      // Start VAD (if AudioContext is available)
      if (audioCtxRef.current) {
        startVAD(stream, audioCtxRef.current);
      } else {
        // No VAD — use a fixed duration fallback (10s)
        maxTimerRef.current = setTimeout(() => {
          if (recorderRef.current?.state === "recording") recorderRef.current.stop();
        }, 10000);
      }

      // Hard max-duration safety cap
      maxTimerRef.current = setTimeout(() => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
          toast({ title: "Recording limit reached", description: "Audio sent automatically after 30 seconds." });
        }
      }, VAD_MAX_RECORD_MS);

    } catch (err) {
      tearDown();
      const e = err as DOMException;
      let msg = "Could not access microphone. Please check permissions.";
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        msg = "Microphone permission denied. Please allow microphone access in your browser settings.";
      } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
        msg = "No microphone found. Please connect a microphone and try again.";
      } else if (e.name === "NotReadableError") {
        msg = "Microphone is being used by another app. Please close it and try again.";
      }
      setErrorMsg(msg);
      setStatus("offline");
    }
  }, [stopSpeaking, tearDown, startVAD, handleAudio, toast]);

  // ── Stop Listening (manual) ───────────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  // ── Barge-in (interrupt AI speech) ────────────────────────────────────────
  const bargeIn = useCallback(() => {
    stopSpeaking();
    setStatus("idle");
    setTimeout(() => startListening(), 150);
  }, [stopSpeaking, startListening]);

  // ── Mic button handler ────────────────────────────────────────────────────
  const onMicClick = useCallback(() => {
    switch (status) {
      case "listening":  stopListening(); break;
      case "speaking":   bargeIn();       break;
      case "error":
      case "offline":
      case "idle":       startListening(); break;
      default: break;
    }
  }, [status, stopListening, bargeIn, startListening]);

  // ── Text input send ────────────────────────────────────────────────────────
  const sendTextMessage = useCallback(async () => {
    const q = textInput.trim();
    if (!q || status === "processing" || status === "thinking") return;
    setTextInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setStatus("thinking");
    setStreamingText("");
    setCurrentConfidence(null);
    setDetectedLang(null);
    setErrorMsg(null);

    try {
      const auth = await getAuth();
      const abort = new AbortController();
      abortRef.current = abort;

      const chatResp = await fetch(`${FUNCTIONS_URL}/voice-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth, apikey: API_KEY },
        body: JSON.stringify({ question: q, conversationId, personality, speed, language, stream: true }),
        signal: abort.signal,
      });

      if (!chatResp.ok) {
        const errJson = await chatResp.json().catch(() => ({ error: `Error ${chatResp.status}` }));
        throw new Error(errJson.error);
      }

      const reader = chatResp.body!.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = "";
      let buffer = "";
      let meta: { conversationId?: string; sources?: Msg["sources"]; confidence?: number; language?: string } = {};
      setStatus("speaking");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const dataLine = part.replace(/^data: /, "").trim();
          if (!dataLine) continue;
          try {
            const parsed = JSON.parse(dataLine);
            if (parsed.type === "metadata") { meta = parsed; setConversationId(parsed.conversationId); setCurrentConfidence(parsed.confidence); setDetectedLang(parsed.language); }
            else if (parsed.type === "chunk") { fullAnswer += parsed.text; setStreamingText(fullAnswer); }
            else if (parsed.type === "done") { fullAnswer = parsed.fullAnswer || fullAnswer; }
          } catch { /* skip */ }
        }
      }

      setMessages((m) => [...m, { role: "assistant", content: fullAnswer || "I couldn't generate a response.", sources: meta.sources, confidence: meta.confidence, language: meta.language }]);
      setStreamingText("");
      setStatus("idle");
      abortRef.current = null;
      await loadConversations();
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") { setStatus("idle"); return; }
      setErrorMsg(err.message);
      setStatus("error");
    }
  }, [textInput, status, getAuth, conversationId, personality, speed, language, loadConversations]);

  // ── KB Management ─────────────────────────────────────────────────────────
  const reindex = async (url: string) => {
    setIndexing(true);
    try {
      const auth = await getAuth();
      const resp = await fetch(`${FUNCTIONS_URL}/kb-reindex`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth, apikey: API_KEY },
        body: JSON.stringify({ url }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Indexing failed");
      toast({ title: "Indexed", description: `${json.pages} pages, ${json.chunks} chunks.` });
      setNewUrl("");
      await loadSources();
    } catch (e) {
      toast({ title: "Indexing failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIndexing(false);
    }
  };

  const deleteSource = async (id: string) => {
    await supabase.from("kb_sources").delete().eq("id", id);
    await loadSources();
  };

  const uploadPdf = async (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) { toast({ title: "PDF only", variant: "destructive" }); return; }
    setUploadingPdf(true);
    try {
      const auth = await getAuth();
      const fd = new FormData();
      fd.append("file", file, file.name);
      const resp = await fetch(`${FUNCTIONS_URL}/kb-ingest-pdf`, {
        method: "POST",
        headers: { Authorization: auth, apikey: API_KEY },
        body: fd,
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Upload failed");
      toast({ title: "PDF indexed", description: `${json.chunks} chunks from ${file.name}.` });
      await loadSources();
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  const saveSettings = async () => {
    try {
      const auth = await getAuth();
      await fetch(`${FUNCTIONS_URL}/voice-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth, apikey: API_KEY },
        body: JSON.stringify({ preferred_personality: personality, preferred_speed: speed, preferred_language: language }),
      });
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    }
  };

  // ── Status UI helpers ─────────────────────────────────────────────────────
  const stateIcon = () => {
    switch (status) {
      case "listening":   return <MicOff className="h-6 w-6" />;
      case "processing":  return <Loader2 className="h-6 w-6 animate-spin" />;
      case "thinking":    return <Zap className="h-6 w-6 animate-pulse" />;
      case "speaking":    return <Volume2 className="h-6 w-6" />;
      case "error":       return <AlertCircle className="h-6 w-6" />;
      case "offline":     return <WifiOff className="h-6 w-6" />;
      default:            return <Mic className="h-6 w-6" />;
    }
  };

  const stateLabel = () => ({
    idle:       "Tap mic to speak",
    listening:  "Listening… tap again to send",
    processing: "Transcribing…",
    thinking:   "Thinking…",
    speaking:   "Speaking — tap to interrupt",
    error:      errorMsg || "Something went wrong — tap to retry",
    offline:    errorMsg || "Microphone unavailable",
  }[status]);

  const micButtonClass = () => {
    switch (status) {
      case "listening":   return "bg-destructive hover:bg-destructive/90 ring-4 ring-destructive/30 animate-pulse";
      case "speaking":    return "bg-emerald-600 hover:bg-emerald-700 text-white";
      case "error":
      case "offline":     return "bg-destructive/70 hover:bg-destructive";
      case "processing":
      case "thinking":    return "bg-muted cursor-not-allowed opacity-70";
      default:            return "bg-primary hover:bg-primary/90";
    }
  };

  const isBusy = status === "processing" || status === "thinking";

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold flex items-center gap-2">
              <Mic className="h-7 w-7 text-primary" /> Voice Assistant
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Speak or type your question. Powered by AI + your knowledge base.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowHistory(!showHistory)}>
              <History className="h-4 w-4" /> History
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowSettings(!showSettings)}>
              <Settings2 className="h-4 w-4" /> Settings
            </Button>
          </div>
        </div>

        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="chat">Voice Chat</TabsTrigger>
            <TabsTrigger value="kb">Knowledge Base</TabsTrigger>
          </TabsList>

          {/* ── Chat Tab ── */}
          <TabsContent value="chat" className="mt-6">
            <div className="flex gap-4">
              {/* History sidebar */}
              {showHistory && (
                <Card className="w-64 shrink-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      Conversations
                      <Button variant="ghost" size="icon" className="h-6 w-6"
                        onClick={() => { setMessages([]); setConversationId(null); }}>
                        <MessageSquare className="h-3 w-3" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <ScrollArea className="h-[400px]">
                      {conversations.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">No conversations yet.</p>
                      )}
                      {conversations.map((c) => (
                        <button key={c.id} onClick={() => loadConversation(c.id)}
                          className={cn("w-full text-left p-2 rounded-lg text-xs hover:bg-muted/60 truncate",
                            c.id === conversationId && "bg-muted")}>
                          <p className="font-medium truncate">{c.title || "New conversation"}</p>
                          <p className="text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                        </button>
                      ))}
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Main chat card */}
              <Card className="flex-1 bg-card/60 backdrop-blur-xl border-border/50">
                <CardContent className="p-0 flex flex-col h-[calc(100vh-20rem)] min-h-[500px]">
                  <ScrollArea className="flex-1 p-6">
                    {messages.length === 0 && !streamingText ? (
                      /* Welcome screen */
                      <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
                        <div className="h-20 w-20 rounded-3xl gradient-primary flex items-center justify-center shadow-xl">
                          <Mic className="h-10 w-10 text-primary-foreground" />
                        </div>
                        <div>
                          <h3 className="font-display text-xl font-semibold mb-1">Tap the mic to talk</h3>
                          <p className="text-sm text-muted-foreground max-w-sm">
                            Ask anything in voice or text. The assistant will auto-detect when you stop speaking.
                          </p>
                        </div>
                        {/* Language picker */}
                        <div className="flex gap-2 mt-2 flex-wrap justify-center">
                          {LANGUAGES.map((l) => (
                            <button key={l.code} onClick={() => setLanguage(l.code)}
                              className={cn("px-2 py-1 rounded-lg text-xs border transition-all",
                                language === l.code ? "border-primary bg-primary/10" : "border-border/50 hover:border-primary/50")}>
                              {l.flag} {l.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((m, i) => (
                          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                            <div className={cn(
                              "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                              m.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/60 backdrop-blur",
                            )}>
                              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                              {/* Confidence bar */}
                              {m.confidence !== undefined && m.confidence !== null && m.role === "assistant" && (
                                <div className="mt-2 flex items-center gap-1">
                                  <div className={cn("h-1.5 rounded-full transition-all",
                                    m.confidence >= 0.7 ? "bg-green-500" : m.confidence >= 0.5 ? "bg-yellow-500" : "bg-red-400")}
                                    style={{ width: `${Math.round(m.confidence * 60)}px` }} />
                                  <span className="text-[10px] opacity-50">{Math.round(m.confidence * 100)}% match</span>
                                </div>
                              )}
                              {/* Sources */}
                              {m.sources && m.sources.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-border/40 flex flex-wrap gap-1">
                                  {m.sources.slice(0, 3).map((s, j) => (
                                    <a key={j} href={s.url} target="_blank" rel="noreferrer"
                                      className="text-xs underline opacity-60 hover:opacity-100 truncate max-w-[200px]">
                                      {s.title || s.url}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Streaming text */}
                        {streamingText && (
                          <div className="flex justify-start">
                            <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm bg-muted/60 backdrop-blur">
                              <p className="whitespace-pre-wrap leading-relaxed">
                                {streamingText}<span className="animate-pulse ml-0.5 inline-block w-0.5 h-4 bg-current align-text-bottom" />
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Thinking indicator */}
                        {status === "thinking" && !streamingText && (
                          <div className="flex justify-start">
                            <div className="rounded-2xl px-4 py-3 bg-muted/60 backdrop-blur flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                            </div>
                          </div>
                        )}

                        <div ref={scrollRef} />
                      </div>
                    )}
                  </ScrollArea>

                  {/* ── Controls Bar ── */}
                  <div className="border-t border-border/40 p-4 space-y-3 bg-muted/20 backdrop-blur">
                    {/* Status indicators */}
                    <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {detectedLang && (
                          <span className="flex items-center gap-1">
                            <Languages className="h-3 w-3" />
                            {LANGUAGES.find((l) => l.code === detectedLang)?.label || detectedLang}
                          </span>
                        )}
                      </div>
                      {currentConfidence !== null && (
                        <div className="flex items-center gap-1">
                          <span>Confidence:</span>
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all duration-300",
                              currentConfidence >= 0.7 ? "bg-green-500" : currentConfidence >= 0.5 ? "bg-yellow-500" : "bg-red-400")}
                              style={{ width: `${currentConfidence * 100}%` }} />
                          </div>
                          <span>{Math.round(currentConfidence * 100)}%</span>
                        </div>
                      )}
                    </div>

                    {/* Error message display */}
                    {errorMsg && (status === "error" || status === "offline") && (
                      <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    {/* Waveform bars */}
                    <div className="flex items-center justify-center gap-1 h-10" ref={waveformRef}>
                      {Array.from({ length: 36 }).map((_, i) => (
                        <span key={i} className={cn(
                          "w-1.5 rounded-full transition-none",
                          status === "listening" ? "bg-primary" :
                          status === "speaking"  ? "bg-emerald-500" :
                          "bg-muted-foreground/25"
                        )} style={{ height: "4px" }} />
                      ))}
                    </div>

                    {/* Mic + send buttons */}
                    <div className="flex items-center justify-center gap-3">
                      {status === "speaking" && (
                        <Button variant="outline" size="sm" onClick={stopSpeaking} className="gap-1.5">
                          <Square className="h-3.5 w-3.5" /> Stop
                        </Button>
                      )}

                      <Button
                        id="voice-mic-btn"
                        onClick={onMicClick}
                        disabled={isBusy}
                        className={cn("rounded-full h-14 w-14 p-0 shadow-xl transition-all duration-200 text-white", micButtonClass())}
                        title={stateLabel()}
                      >
                        {stateIcon()}
                      </Button>

                      {status === "listening" && (
                        <Button variant="outline" size="sm" onClick={stopListening} className="gap-1.5">
                          <Square className="h-3.5 w-3.5" /> Send now
                        </Button>
                      )}
                    </div>

                    <p className="text-center text-xs text-muted-foreground">{stateLabel()}</p>

                    {/* Text input fallback */}
                    <div className="flex gap-2 mt-1">
                      <Input
                        placeholder="Or type your question here…"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendTextMessage()}
                        disabled={isBusy || status === "listening"}
                        className="text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={sendTextMessage}
                        disabled={!textInput.trim() || isBusy || status === "listening"}
                        title="Send text message"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Knowledge Base Tab ── */}
          <TabsContent value="kb" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Globe className="h-5 w-5" /> Add a website to index
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="https://yourwebsite.com"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    disabled={indexing}
                    onKeyDown={(e) => e.key === "Enter" && newUrl.trim() && reindex(newUrl)}
                  />
                  <Button onClick={() => reindex(newUrl)} disabled={indexing || !newUrl.trim()}>
                    {indexing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crawl & Index"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Reads sitemap.xml + follows same-origin links (up to ~30 pages). Embeds and stores chunks for RAG.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" /> Upload a PDF
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(f); }}
                />
                <Button onClick={() => pdfInputRef.current?.click()} disabled={uploadingPdf} variant="outline" className="gap-2">
                  {uploadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploadingPdf ? "Extracting & indexing…" : "Choose PDF file"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Text extracted with AI, chunked, embedded, and stored. Max 20MB.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Indexed sources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sources.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No sources yet. Add a website or PDF above.
                  </p>
                ) : sources.map((s) => (
                  <div key={s.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-card">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {s.status === "ready"
                        ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        : s.status === "failed"
                        ? <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                        : <Clock className="h-4 w-4 text-muted-foreground shrink-0 animate-spin" />
                      }
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{s.title || s.url}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.url}</p>
                        {s.error && <p className="text-xs text-destructive mt-0.5">{s.error}</p>}
                      </div>
                      <Badge variant="secondary" className="shrink-0">{s.pages_indexed} pages</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => reindex(s.url)} disabled={indexing} title="Re-index">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteSource(s.id)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ── Settings Panel ── */}
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}>
            <Card className="w-[420px] max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg">
                  <span className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> Voice Settings</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSettings(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Language */}
                <div>
                  <label className="text-sm font-medium mb-2 block flex items-center gap-1">
                    <Languages className="h-4 w-4" /> Language
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {LANGUAGES.map((l) => (
                      <button key={l.code} onClick={() => setLanguage(l.code)}
                        className={cn("p-2 rounded-lg text-xs border text-center transition-all",
                          language === l.code ? "border-primary bg-primary/10 font-medium" : "border-border/50 hover:border-primary/50")}>
                        <span className="text-lg">{l.flag}</span><br />{l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Personality */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Voice Personality</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PERSONALITIES.map((p) => (
                      <button key={p.value} onClick={() => setPersonality(p.value)}
                        className={cn("p-2 rounded-lg text-xs border text-center transition-all",
                          personality === p.value ? "border-primary bg-primary/10 font-medium" : "border-border/50 hover:border-primary/50")}>
                        <span className="text-lg">{p.icon}</span><br />{p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Speed */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Playback Speed</label>
                  <div className="flex gap-2">
                    {SPEEDS.map((s) => (
                      <button key={s.value} onClick={() => setSpeed(s.value)}
                        className={cn("flex-1 p-2 rounded-lg text-xs border text-center transition-all",
                          speed === s.value ? "border-primary bg-primary/10 font-medium" : "border-border/50 hover:border-primary/50")}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info */}
                <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/40 space-y-1">
                  <p>Silence timeout: <strong>{silenceTimeout}s</strong> — mic stops after this much silence.</p>
                  <p>Admins can adjust silence timeout from the Admin Panel.</p>
                </div>

                <Button onClick={saveSettings} className="w-full">Save Preferences</Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

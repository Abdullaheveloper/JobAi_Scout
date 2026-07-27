import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot, CheckCircle2, CircleAlert, FileUp, History, Mic, Pause, Play, Power, Settings2, Square, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { MicPermissionDialog } from "./MicPermissionDialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { VoiceRecognition } from "@/lib/voice/recognition";

type Status = "idle" | "permission" | "listening" | "speaking-user" | "silence" | "uploading" | "thinking" | "speaking" | "paused" | "ended" | "error";
type HistoryItem = { id: string; role: "user" | "assistant"; audio_url: string | null; audio_path: string | null; content: string; created_at: string };
type Message = { id: string; role: "user" | "assistant"; content: string; createdAt: Date };
type MicrophoneIssue = "permission" | "insecure" | "unavailable" | "busy" | "unsupported" | "recognition" | "network" | "no-speech";
const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const MIN_RECORDING_BYTES = 900;
const SILENCE_DELAY_MS = 3000;
const INITIAL_SPEECH_WAIT_MS = 10000;

function classifyMicrophoneError(error: unknown): MicrophoneIssue {
  if (typeof window !== "undefined" && !window.isSecureContext) return "insecure";
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return "unsupported";
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "permission";
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return "unavailable";
    if (error.name === "NotReadableError" || error.name === "AbortError") return "busy";
  }
  return "unavailable";
}

export function VoiceMode() {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [status, setStatus] = useState<Status>("idle");
  const [volume, setVolume] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [micDialogOpen, setMicDialogOpen] = useState(false);
  const [micIssue, setMicIssue] = useState<MicrophoneIssue>("permission");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadState, setUploadState] = useState<"loading" | "success" | "error">("success");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const analyserContext = useRef<AudioContext | null>(null);
  const animationFrame = useRef<number | null>(null);
  const silence = useRef<number | null>(null);
  const noSpeech = useRef<number | null>(null);
  const hasSpoken = useRef(false);
  const documentInput = useRef<HTMLInputElement | null>(null);
  const recognition = useRef<VoiceRecognition | null>(null);
  const browserTranscript = useRef("");
  const interimTranscript = useRef("");
  const requestAbort = useRef<AbortController | null>(null);
  const discardRecording = useRef(false);
  const isStarting = useRef(false);
  const conversationRef = useRef<HTMLDivElement | null>(null);

  const microphoneGuidance = useMemo(() => {
    const issues: MicrophoneIssue[] = ["permission", "insecure", "unavailable", "busy", "unsupported", "recognition", "network", "no-speech"];
    return Object.fromEntries(
      issues.map((issue) => [
        issue,
        {
          title: t(`voice.issue.${issue}.title`),
          message: t(`voice.issue.${issue}.message`),
          action: t(`voice.issue.${issue}.action`),
        },
      ]),
    ) as Record<MicrophoneIssue, { title: string; message: string; action: string }>;
  }, [t]);

  const showMicrophoneIssue = useCallback((issue: MicrophoneIssue, error?: unknown) => {
    if (error) console.warn("Voice microphone startup failed:", error);
    setMicIssue(issue); setErrorMessage(microphoneGuidance[issue].message); setStatus("error"); setMicDialogOpen(true);
  }, [microphoneGuidance]);

  const authHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY };
  };
  const clearTimers = useCallback(() => {
    if (silence.current) window.clearTimeout(silence.current);
    if (noSpeech.current) window.clearTimeout(noSpeech.current);
    silence.current = null; noSpeech.current = null;
  }, []);
  const stopAnalysis = useCallback(() => {
    if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    animationFrame.current = null;
    void analyserContext.current?.close(); analyserContext.current = null;
    setVolume(0);
  }, []);
  const stopPlayback = useCallback(() => {
    window.speechSynthesis.cancel();
    audio.current?.pause(); if (audio.current) audio.current.currentTime = 0;
    audio.current = null; setPlaying(null);
    setStatus(current => current === "speaking" ? "paused" : current);
  }, []);
  const appendMessage = useCallback((role: Message["role"], content: string) => {
    setMessages(previous => [...previous, { id: crypto.randomUUID(), role, content, createdAt: new Date() }]);
  }, []);

  useEffect(() => { conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" }); }, [messages, reducedMotion]);
  const loadHistory = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession(); if (!session.session) return;
    const { data: conversations } = await supabase.from("voice_conversations").select("id").eq("user_id", session.session.user.id).order("updated_at", { ascending: false }).limit(1);
    const id = conversationId || conversations?.[0]?.id; if (!id) return;
    setConversationId(id);
    const { data } = await supabase.from("voice_messages").select("id, role, audio_url, audio_path, content, created_at").eq("conversation_id", id).order("created_at");
    setHistory((data || []) as HistoryItem[]);
  }, [conversationId]);
  const speakFallback = useCallback((text: string) => {
    const speech = new SpeechSynthesisUtterance(text); speech.rate = speed;
    speech.onend = () => setStatus("paused"); speech.onerror = () => setStatus("paused");
    setStatus("speaking"); window.speechSynthesis.speak(speech);
  }, [speed]);
  const synthesizeAndPlay = useCallback(async (text: string, userId: string, sessionId: string, signal?: AbortSignal) => {
    const headers = await authHeaders();
    const response = await fetch(`${functionsUrl}/elevenlabs-tts`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ text, speed }), signal });
    if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || t("voice.playbackFailed")); }
    const blob = await response.blob(); const path = `${userId}/${sessionId}/assistant-${crypto.randomUUID()}.mp3`;
    const player = new Audio(URL.createObjectURL(blob)); audio.current = player;
    player.onended = () => setStatus("paused"); player.onerror = () => setStatus("paused"); setStatus("speaking"); await player.play();
    void (async () => {
      const upload = await supabase.storage.from("voice-history").upload(path, blob, { contentType: "audio/mpeg" }); if (upload.error) return;
      const { data: message } = await supabase.from("voice_messages").select("id").eq("conversation_id", sessionId).eq("role", "assistant").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (message) await supabase.from("voice_messages").update({ audio_path: path }).eq("id", message.id);
    })();
  }, [speed, t]);
  const uploadKnowledgeBase = useCallback(async (file: File) => {
    try { setUploadState("loading"); setUploadMessage(t("voice.uploadingKb")); const headers = await authHeaders(); const form = new FormData(); form.append("file", file);
      const response = await fetch(`${functionsUrl}/kb-ingest-document`, { method: "POST", headers, body: form }); const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || t("voice.kbFailed")); setUploadState("success"); setUploadMessage(t("voice.kbReady", { file: file.name }));
    } catch (error) { setUploadState("error"); setUploadMessage(error instanceof Error ? error.message : t("voice.kbFailed")); }
  }, [t]);
  useEffect(() => { if (!uploadMessage) return; const timer = window.setTimeout(() => setUploadMessage(""), 3500); return () => window.clearTimeout(timer); }, [uploadMessage]);

  const processRecording = useCallback(async (blob: Blob, recognizedText = "") => {
    if (blob.size < MIN_RECORDING_BYTES && !recognizedText.trim()) { showMicrophoneIssue("no-speech"); return; }
    if (requestAbort.current) return;
    const abort = new AbortController(); requestAbort.current = abort;
    try {
      setStatus("uploading"); setErrorMessage(""); const { data: auth } = await supabase.auth.getSession(); if (!auth.session) throw new Error(t("voice.signInRequired"));
      const extension = blob.type.includes("ogg") ? "ogg" : "webm"; const headers = await authHeaders(); let transcript = recognizedText.trim();
      if (!transcript) { const form = new FormData(); form.append("file", blob, `recording.${extension}`); form.append("language", "en-US");
        const stt = await fetch(`${functionsUrl}/voice-transcribe`, { method: "POST", headers, body: form, signal: abort.signal }); const transcription = await stt.json().catch(() => ({}));
        if (!stt.ok || !transcription.text?.trim()) throw new Error(transcription.error || t("voice.noSpeechDetected")); transcript = transcription.text;
      }
      setLiveTranscript(transcript); appendMessage("user", transcript);
      const audioPath = `${auth.session.user.id}/${crypto.randomUUID()}/user.${extension}`; const uploadAudio = supabase.storage.from("voice-history").upload(audioPath, blob, { contentType: blob.type || "audio/webm" });
      setStatus("thinking"); const chat = await fetch(`${functionsUrl}/voice-chat`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ question: transcript, conversationId, stream: false }), signal: abort.signal });
      const response = await chat.json().catch(() => ({})); if (!chat.ok) throw new Error(response.error || t("voice.assistantNoAnswer"));
      setConversationId(response.conversationId); appendMessage("assistant", response.answer);
      void uploadAudio.then(async ({ error }) => { if (error) return; const { data: message } = await supabase.from("voice_messages").select("id").eq("conversation_id", response.conversationId).eq("role", "user").order("created_at", { ascending: false }).limit(1).maybeSingle(); if (message) await supabase.from("voice_messages").update({ audio_path: audioPath }).eq("id", message.id); });
      try { await synthesizeAndPlay(response.answer, auth.session.user.id, response.conversationId, abort.signal); } catch (error) { if (!abort.signal.aborted) speakFallback(response.answer); else throw error; }
      await loadHistory();
    } catch (error) {
      if (abort.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) { setStatus("paused"); return; }
      console.error("Voice request failed", error); const message = error instanceof Error ? error.message : t("voice.requestFailed");
      showMicrophoneIssue(/speech/i.test(message) ? "no-speech" : /network|fetch/i.test(message) ? "network" : "recognition");
    } finally { if (requestAbort.current === abort) requestAbort.current = null; }
  }, [appendMessage, conversationId, loadHistory, showMicrophoneIssue, speakFallback, synthesizeAndPlay, t]);

  const stopRecording = useCallback((options: { discard?: boolean } = {}) => {
    discardRecording.current = options.discard ?? false; clearTimers(); recognition.current?.stop(); recognition.current = null; stopAnalysis();
    if (recorder.current?.state === "recording") {
      try { recorder.current.requestData(); } catch { /* recorder may already be stopping */ }
      recorder.current.stop();
    }
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
  }, [clearTimers, stopAnalysis]);
  const beginSilenceTimer = useCallback(() => {
    if (silence.current) window.clearTimeout(silence.current); setStatus("silence");
    silence.current = window.setTimeout(() => stopRecording(), SILENCE_DELAY_MS);
  }, [stopRecording]);
  const startRecording = useCallback(async () => {
    if (isStarting.current || recorder.current?.state === "recording" || requestAbort.current) return;
    isStarting.current = true; stopPlayback(); setStatus("permission");
    if (!window.isSecureContext) { showMicrophoneIssue("insecure"); isStarting.current = false; return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined" || typeof AudioContext === "undefined") { showMicrophoneIssue("unsupported"); isStarting.current = false; return; }
    try {
      try { const permission = await navigator.permissions?.query({ name: "microphone" as PermissionName }); if (permission?.state === "denied") { showMicrophoneIssue("permission"); return; } } catch { /* unavailable in some browsers */ }
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      stream.current = mic; chunks.current = []; discardRecording.current = false; browserTranscript.current = ""; interimTranscript.current = ""; setLiveTranscript(""); hasSpoken.current = false;
      if (VoiceRecognition.isSupported()) { const engine = new VoiceRecognition(); recognition.current = engine; engine.start({ language: "en", continuous: true, interimResults: true, onResult: (text, final) => {
        // A browser transcript is a stronger speech signal than a raw volume
        // threshold, especially with quiet laptop and Bluetooth microphones.
        hasSpoken.current = true;
        if (noSpeech.current) window.clearTimeout(noSpeech.current); noSpeech.current = null;
        if (silence.current) window.clearTimeout(silence.current); silence.current = null;
        setStatus("speaking-user");
        if (final) { browserTranscript.current = `${browserTranscript.current} ${text}`.trim(); interimTranscript.current = ""; }
        else interimTranscript.current = text;
        setLiveTranscript(`${browserTranscript.current} ${interimTranscript.current}`.trim());
      }, onError: error => { if (error) setErrorMessage(error); } }); }
      const recording = new MediaRecorder(mic); recorder.current = recording; recording.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data); };
      recording.onstop = () => { recorder.current = null; if (discardRecording.current) { discardRecording.current = false; setStatus("paused"); return; } const blob = new Blob(chunks.current, { type: recording.mimeType || "audio/webm" }); const recognizedText = `${browserTranscript.current} ${interimTranscript.current}`.trim();
        // Do not discard a usable recording just because the local meter was
        // quiet. The existing server transcription is the reliable fallback.
        if (!hasSpoken.current && !recognizedText && blob.size < MIN_RECORDING_BYTES) { showMicrophoneIssue("no-speech"); return; }
        window.setTimeout(() => void processRecording(blob, recognizedText), recognizedText ? 150 : 500); };
      const context = new AudioContext(); analyserContext.current = context; const source = context.createMediaStreamSource(mic); const analyser = context.createAnalyser(); analyser.fftSize = 256; source.connect(analyser);
      const detect = () => { if (recorder.current?.state !== "recording") return; const data = new Uint8Array(analyser.frequencyBinCount); analyser.getByteTimeDomainData(data); const level = data.reduce((sum, value) => sum + Math.abs(value - 128), 0) / data.length / 128; setVolume(level);
        if (level > 0.012) { hasSpoken.current = true; if (silence.current) window.clearTimeout(silence.current); silence.current = null; if (noSpeech.current) window.clearTimeout(noSpeech.current); noSpeech.current = null; setStatus("speaking-user"); }
        else if (hasSpoken.current && !silence.current) beginSilenceTimer(); animationFrame.current = requestAnimationFrame(detect); };
      recording.start(250); setStatus("listening"); noSpeech.current = window.setTimeout(() => { if (!hasSpoken.current) stopRecording(); }, INITIAL_SPEECH_WAIT_MS); detect();
    } catch (error) { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; showMicrophoneIssue(classifyMicrophoneError(error), error); }
    finally { isStarting.current = false; }
  }, [beginSilenceTimer, processRecording, showMicrophoneIssue, stopPlayback, stopRecording]);
  const endAssistant = useCallback(() => { requestAbort.current?.abort(); requestAbort.current = null; stopRecording({ discard: true }); stopPlayback(); clearTimers(); setLiveTranscript(""); setErrorMessage(""); setStatus("ended"); }, [clearTimers, stopPlayback, stopRecording]);
  const stopListening = useCallback(() => { if (recorder.current?.state === "recording") stopRecording(); }, [stopRecording]);
  const startAssistant = useCallback(() => { if (status === "listening" || status === "speaking-user" || status === "silence") return; setErrorMessage(""); setMicDialogOpen(false); void startRecording(); }, [startRecording, status]);
  const replay = async (item: HistoryItem) => { stopPlayback(); let url = item.audio_url || ""; if (!url && item.audio_path) { const signed = await supabase.storage.from("voice-history").createSignedUrl(item.audio_path, 3600); url = signed.data?.signedUrl || ""; } if (url) { const player = new Audio(url); audio.current = player; player.onended = () => setPlaying(null); setPlaying(item.id); await player.play(); return; } speakFallback(item.content); setPlaying(item.id); };
  useEffect(() => () => endAssistant(), [endAssistant]);
  useEffect(() => { if (historyOpen) void loadHistory(); }, [historyOpen, loadHistory]);

  const stateCopy: Record<Status, { eyebrow: string; title: string; detail: string }> = {
    idle: { eyebrow: t("voice.state.idle.eyebrow"), title: t("voice.state.idle.title"), detail: t("voice.state.idle.detail") },
    permission: { eyebrow: t("voice.state.permission.eyebrow"), title: t("voice.state.permission.title"), detail: t("voice.state.permission.detail") },
    listening: { eyebrow: t("voice.state.listening.eyebrow"), title: t("voice.state.listening.title"), detail: t("voice.state.listening.detail") },
    "speaking-user": { eyebrow: t("voice.state.speaking-user.eyebrow"), title: t("voice.state.speaking-user.title"), detail: t("voice.state.speaking-user.detail") },
    silence: { eyebrow: t("voice.state.silence.eyebrow"), title: t("voice.state.silence.title"), detail: t("voice.state.silence.detail") },
    uploading: { eyebrow: t("voice.state.uploading.eyebrow"), title: t("voice.state.uploading.title"), detail: t("voice.state.uploading.detail") },
    thinking: { eyebrow: t("voice.state.thinking.eyebrow"), title: t("voice.state.thinking.title"), detail: t("voice.state.thinking.detail") },
    speaking: { eyebrow: t("voice.state.speaking.eyebrow"), title: t("voice.state.speaking.title"), detail: t("voice.state.speaking.detail") },
    paused: { eyebrow: t("voice.state.paused.eyebrow"), title: t("voice.state.paused.title"), detail: t("voice.state.paused.detail") },
    ended: { eyebrow: t("voice.state.ended.eyebrow"), title: t("voice.state.ended.title"), detail: t("voice.state.ended.detail") },
    error: { eyebrow: t("voice.state.error.eyebrow"), title: t("voice.state.error.title"), detail: errorMessage || t("voice.state.error.detail") },
  };
  const state = stateCopy[status]; const recording = status === "listening" || status === "speaking-user" || status === "silence"; const busy = status === "uploading" || status === "thinking";
  const showConversation = messages.length > 0 || liveTranscript;

  return <main className="relative min-h-[calc(100vh-8rem)] overflow-hidden rounded-[28px] border border-indigo-200/10 bg-card text-foreground shadow-[0_30px_90px_rgba(2,6,23,.6)]">
    <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(79,70,229,.22),transparent_33%),radial-gradient(circle_at_83%_20%,rgba(168,85,247,.17),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(14,165,233,.08),transparent_35%)]" />
    <div className="relative mx-auto flex min-h-[calc(100vh-8rem)] max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
      <header className="flex items-center justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[.22em] text-indigo-600 dark:text-indigo-300">{t("voice.brand")}</p><h1 className="mt-1 font-display text-xl font-semibold tracking-tight">{t("voice.title")}</h1></div><div className="flex items-center gap-1"><Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t("voice.addDocumentAria")} title={t("voice.addDocument")} onClick={() => documentInput.current?.click()}><FileUp className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t("voice.historyOpen")} title={t("voice.historyTitle")} onClick={() => setHistoryOpen(true)}><History className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className={cn("text-muted-foreground hover:bg-muted hover:text-foreground", settingsOpen && "bg-muted text-foreground")} aria-label={t("voice.settings")} title={t("voice.settings")} onClick={() => setSettingsOpen(open => !open)}><Settings2 className="h-4 w-4" /></Button><input ref={documentInput} className="hidden" type="file" accept=".pdf,.txt,.md,.csv,.doc,.docx" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadKnowledgeBase(file); event.currentTarget.value = ""; }} /></div></header>
      <section className="grid flex-1 items-center gap-6 py-8 lg:grid-cols-[1.16fr_.84fr] lg:py-10">
        <div className="relative overflow-hidden rounded-[26px] border border-border bg-muted/40 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-2xl sm:p-9"><div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/60 to-transparent" />
          <motion.div key={status} initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28 }} className="text-center"><div className={cn("mx-auto mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold", status === "error" ? "border-rose-300/25 bg-rose-500/10 text-rose-700 dark:text-rose-200" : recording ? "border-cyan-300/25 bg-cyan-400/10 text-cyan-800 dark:text-cyan-100" : busy || status === "speaking" ? "border-violet-300/25 bg-violet-400/10 text-violet-800 dark:text-violet-100" : "border-border bg-muted text-muted-foreground")}><span className={cn("h-1.5 w-1.5 rounded-full", recording ? "animate-pulse bg-cyan-300" : status === "error" ? "bg-rose-300" : "bg-indigo-300")} />{state.eyebrow}</div><h2 className="font-display text-3xl font-semibold tracking-[-.04em] text-foreground sm:text-4xl">{state.title}</h2><p aria-live="polite" className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">{state.detail}</p></motion.div>
          <div className="relative mx-auto my-7 flex h-40 max-w-lg items-center justify-center"><div aria-hidden className={cn("absolute h-32 w-32 rounded-full blur-2xl transition-colors duration-500", recording ? "bg-cyan-400/20" : status === "speaking" ? "bg-violet-500/25" : "bg-indigo-500/15")} />{busy ? <div className="relative flex h-28 w-28 items-center justify-center"><motion.span className="absolute inset-0 rounded-full border border-violet-300/40" animate={reducedMotion ? {} : { scale: [1, 1.35], opacity: [.7, 0] }} transition={{ duration: 1.8, repeat: Infinity }} /><motion.span className="absolute h-16 w-16 rounded-full border-2 border-indigo-300 border-t-transparent" animate={reducedMotion ? {} : { rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }} /><Bot className="h-7 w-7 text-violet-700 dark:text-violet-200" /></div> : <div className="w-full"><WaveformVisualizer volume={volume} isActive={recording || status === "speaking"} color={recording ? "emerald" : "indigo"} barCount={36} /></div>}</div>
          <AnimatePresence>{liveTranscript && (recording || busy) && <motion.div initial={reducedMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto mb-6 max-w-lg rounded-2xl border border-border bg-muted/50 px-4 py-3 text-start"><p className="mb-1 text-[10px] font-bold uppercase tracking-[.18em] text-indigo-700 dark:text-indigo-200">{busy ? t("voice.recognized") : t("voice.liveTranscript")}</p><p className="line-clamp-2 text-sm leading-6 text-foreground">{liveTranscript}</p></motion.div>}</AnimatePresence>
          <div className="flex flex-wrap justify-center gap-2"><Button onClick={startAssistant} disabled={recording || busy || status === "speaking"} className="h-11 gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 font-semibold text-white shadow-[0_12px_28px_rgba(99,102,241,.26)] transition hover:brightness-110"><Power className="h-4 w-4" />{t("voice.startAssistant")}</Button><Button onClick={stopListening} disabled={!recording} variant="outline" className="h-11 gap-2 rounded-xl border-border bg-muted text-foreground hover:bg-muted/80 hover:text-foreground disabled:border-border/50"><Square className="h-3.5 w-3.5 fill-current" />{t("voice.stopListening")}</Button><Button onClick={stopPlayback} disabled={status !== "speaking"} variant="outline" className="h-11 gap-2 rounded-xl border-border bg-muted text-foreground hover:bg-muted/80 hover:text-foreground disabled:border-border/50"><VolumeX className="h-4 w-4" />{t("voice.stopSpeaking")}</Button><Button onClick={endAssistant} disabled={status === "ended" || status === "idle"} variant="ghost" className="h-11 gap-2 rounded-xl text-muted-foreground hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-200"><X className="h-4 w-4" />{t("voice.endAssistant")}</Button>{status === "error" && <Button onClick={startAssistant} variant="outline" className="h-11 rounded-xl border-rose-300/30 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20"><CheckCircle2 className="me-2 h-4 w-4" />{t("voice.tryAgain")}</Button>}</div>
          <p className="mt-5 text-center text-xs text-muted-foreground">{t("voice.silenceHint")}</p>
        </div>
        <aside className="flex min-h-[370px] flex-col overflow-hidden rounded-[26px] border border-border bg-muted/50 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-xl"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-indigo-700 dark:text-indigo-200">{t("voice.currentSession")}</p><h3 className="mt-1 font-display text-base font-semibold text-foreground">{t("voice.conversation")}</h3></div><span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">{t("voice.messagesCount", { count: messages.length })}</span></div><div ref={conversationRef} className="max-h-[420px] flex-1 space-y-3 overflow-y-auto p-4">{showConversation ? messages.map(message => <motion.article key={message.id} initial={reducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("max-w-[92%] rounded-2xl px-4 py-3", message.role === "user" ? "ms-auto bg-indigo-500/20 text-indigo-50" : "border border-border bg-muted/50 text-foreground")}><p className="text-sm leading-6">{message.content}</p><time className="mt-1.5 block text-[10px] text-muted-foreground">{message.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></motion.article>) : <div className="flex h-full min-h-60 flex-col items-center justify-center px-6 text-center"><div className="mb-4 rounded-2xl border border-indigo-300/15 bg-indigo-400/10 p-3"><Mic className="h-5 w-5 text-indigo-700 dark:text-indigo-200" /></div><p className="text-sm font-medium text-muted-foreground">{t("voice.emptyTitle")}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{t("voice.emptyBody")}</p></div>}</div></aside>
      </section>
      {settingsOpen && <section className="mx-auto mb-1 w-full max-w-md rounded-2xl border border-border bg-muted/40 p-4 backdrop-blur-xl"><div className="flex items-center gap-2 text-sm font-medium text-foreground"><Volume2 className="h-4 w-4 text-indigo-700 dark:text-indigo-200" />{t("voice.speechSpeed")} <span className="ms-auto text-muted-foreground">{`${speed.toFixed(2)}x`}</span></div><Slider className="mt-4" min={0.75} max={1.5} step={0.05} value={[speed]} onValueChange={([value]) => setSpeed(value)} /></section>}
    </div>
    {uploadMessage && <div role="status" className={cn("fixed bottom-5 start-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-xl border bg-popover px-4 py-3 text-sm text-foreground shadow-2xl backdrop-blur-xl", uploadState === "error" ? "border-rose-300/40" : "border-indigo-300/25")}>{uploadState === "error" ? <CircleAlert className="h-4 w-4 shrink-0 text-rose-300" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-700 dark:text-indigo-200" />}<span>{uploadMessage}</span></div>}
    {historyOpen && <aside aria-label={t("voice.historyAria")} className="fixed inset-y-0 end-0 z-50 w-full max-w-sm overflow-auto border-s border-border bg-background/95 p-5 text-foreground shadow-2xl backdrop-blur-2xl"><div className="mb-6 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-indigo-700 dark:text-indigo-200">{t("voice.conversation")}</p><h2 className="mt-1 font-display font-semibold">{t("voice.historyTitle")}</h2></div><Button variant="ghost" size="icon" aria-label={t("voice.historyClose")} onClick={() => setHistoryOpen(false)}><X className="h-4 w-4" /></Button></div>{history.length ? <div className="space-y-2">{history.map(item => <button key={item.id} onClick={() => playing === item.id ? stopPlayback() : void replay(item)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-muted/40 p-3 text-start transition hover:bg-muted"><span className="rounded-full bg-indigo-500/15 p-2 text-indigo-700 dark:text-indigo-200">{playing === item.id ? <Pause size={15}/> : <Play size={15}/>}</span><span className="min-w-0 text-sm text-muted-foreground">{item.role === "user" ? t("voice.yourVoiceMessage") : t("voice.assistantResponse")}<small className="mt-1 block text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</small></span></button>)}</div> : <p className="text-sm text-muted-foreground">{t("voice.historyEmpty")}</p>}</aside>}
    <MicPermissionDialog open={micDialogOpen} onOpenChange={setMicDialogOpen} onRequestPermission={startAssistant} title={microphoneGuidance[micIssue].title} description={microphoneGuidance[micIssue].message} actionLabel={microphoneGuidance[micIssue].action} />
  </main>;
}

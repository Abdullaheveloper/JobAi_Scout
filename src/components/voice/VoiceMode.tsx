import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, FileUp, History, Mic, Pause, Play, Power, Settings2, Square, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { MicPermissionDialog } from "./MicPermissionDialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { VoiceRecognition } from "@/lib/voice/recognition";

type Status = "idle" | "listening" | "uploading" | "thinking" | "speaking" | "error";
type HistoryItem = { id: string; role: "user" | "assistant"; audio_url: string | null; audio_path: string | null; content: string; created_at: string };
type MicrophoneIssue = "permission" | "insecure" | "unavailable" | "busy" | "unsupported";
const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const microphoneGuidance: Record<MicrophoneIssue, { title: string; message: string; action: string }> = {
  permission: { title: "Allow microphone access", message: "Your browser has blocked microphone access for this site. Use the microphone or site-settings icon in the address bar to allow it, then try again.", action: "Try after allowing" },
  insecure: { title: "A secure connection is required", message: "Microphone access only works on HTTPS sites or on localhost. Open this app through HTTPS, or use localhost while developing.", action: "Check connection and retry" },
  unavailable: { title: "No microphone is available", message: "Connect or enable a microphone in your device settings, then try again.", action: "Try microphone again" },
  busy: { title: "Microphone is in use", message: "Another app or browser tab is using your microphone. Close it or release the device, then try again.", action: "Try microphone again" },
  unsupported: { title: "Voice capture is not supported", message: "This browser cannot record voice for the assistant. Use the latest Chrome, Edge, Firefox, or Safari.", action: "Check support and retry" },
};

function classifyMicrophoneError(error: unknown): MicrophoneIssue {
  if (typeof window !== "undefined" && !window.isSecureContext) return "insecure";
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return "unsupported";
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "permission";
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return "unavailable";
    if (error.name === "NotReadableError" || error.name === "AbortError") return "busy";
    if (error.name === "NotSupportedError") return "unsupported";
  }
  return "unavailable";
}

export function VoiceMode() {
  const [status, setStatus] = useState<Status>("idle");
  const [volume, setVolume] = useState(0);
  const [speed, setSpeed] = useState(1);
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
  const silence = useRef<number | null>(null);
  const noSpeech = useRef<number | null>(null);
  const hasSpoken = useRef(false);
  const documentInput = useRef<HTMLInputElement | null>(null);
  const recognition = useRef<VoiceRecognition | null>(null);
  const browserTranscript = useRef("");
  const requestAbort = useRef<AbortController | null>(null);
  const discardRecording = useRef(false);

  const showMicrophoneIssue = useCallback((issue: MicrophoneIssue, error?: unknown) => {
    if (error) console.warn("Voice microphone startup failed:", error);
    setMicIssue(issue);
    setErrorMessage(microphoneGuidance[issue].message);
    setStatus("error");
    setMicDialogOpen(true);
  }, []);

  const authHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY };
  };

  const stopPlayback = useCallback(() => {
    window.speechSynthesis.cancel();
    audio.current?.pause();
    if (audio.current) audio.current.currentTime = 0;
    setPlaying(null);
    setStatus(current => current === "speaking" ? "idle" : current);
  }, []);

  const loadHistory = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;
    const { data: conversations } = await supabase.from("voice_conversations").select("id").eq("user_id", session.session.user.id).order("updated_at", { ascending: false }).limit(1);
    const id = conversationId || conversations?.[0]?.id;
    if (!id) return;
    setConversationId(id);
    const { data } = await supabase.from("voice_messages").select("id, role, audio_url, audio_path, content, created_at").eq("conversation_id", id).order("created_at");
    setHistory((data || []) as HistoryItem[]);
  }, [conversationId]);

  const speakFallback = useCallback((text: string) => {
    const speech = new SpeechSynthesisUtterance(text);
    speech.rate = speed;
    speech.onend = () => setStatus("idle");
    speech.onerror = () => setStatus("idle");
    setStatus("speaking");
    window.speechSynthesis.speak(speech);
  }, [speed]);

  const synthesizeAndPlay = useCallback(async (text: string, userId: string, sessionId: string, signal?: AbortSignal) => {
    const headers = await authHeaders();
    const response = await fetch(`${functionsUrl}/voice-tts`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ text, voice: "Eve", speed }), signal });
    if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || `TTS request failed (${response.status}).`); }
    const blob = await response.blob();
    const path = `${userId}/${sessionId}/assistant-${crypto.randomUUID()}.mp3`;
    const player = new Audio(URL.createObjectURL(blob));
    audio.current = player; player.onended = () => setStatus("idle"); setStatus("speaking"); await player.play();
    // Store history audio after playback starts; storage must not delay the reply.
    void (async () => {
      const upload = await supabase.storage.from("voice-history").upload(path, blob, { contentType: "audio/mpeg" });
      if (upload.error) return;
      const { data: message } = await supabase.from("voice_messages").select("id").eq("conversation_id", sessionId).eq("role", "assistant").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (message) await supabase.from("voice_messages").update({ audio_path: path }).eq("id", message.id);
    })();
  }, [speed]);

  const uploadKnowledgeBase = useCallback(async (file: File) => {
    try {
      setUploadState("loading");
      setUploadMessage("Adding document to knowledge base…");
      const headers = await authHeaders(); const form = new FormData(); form.append("file", file);
      const response = await fetch(`${functionsUrl}/kb-ingest-document`, { method: "POST", headers, body: form });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Document upload failed (${response.status}).`);
      setUploadState("success");
      setUploadMessage(`${file.name} is ready for voice questions.`);
    } catch (error) { setUploadState("error"); setUploadMessage(error instanceof Error ? error.message : "Document upload failed."); }
  }, []);

  useEffect(() => {
    if (!uploadMessage) return;
    const timeout = window.setTimeout(() => setUploadMessage(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [uploadMessage]);

  const processRecording = useCallback(async (blob: Blob, recognizedText = "") => {
    if (!blob.size) return setStatus("idle");
    const abort = new AbortController();
    requestAbort.current = abort;
    try {
      setStatus("uploading"); setErrorMessage("");
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session) throw new Error("Please sign in to use voice assistant.");
      const extension = blob.type.includes("ogg") ? "ogg" : "webm";
      const headers = await authHeaders();
      // Chrome/Edge Web Speech is the fastest path. Gemini transcribes only
      // when the browser does not provide a final transcript.
      let transcript = recognizedText.trim();
      if (!transcript) {
        const form = new FormData(); form.append("file", blob, `recording.${extension}`); form.append("language", "en-US");
        const stt = await fetch(`${functionsUrl}/voice-transcribe`, { method: "POST", headers, body: form, signal: abort.signal });
        const transcription = await stt.json().catch(() => ({}));
        if (!stt.ok || !transcription.text?.trim()) throw new Error(transcription.error || "No speech was detected. Please speak for a little longer and try again.");
        transcript = transcription.text;
      }
      const audioPath = `${auth.session.user.id}/${crypto.randomUUID()}/user.${extension}`;
      const uploadAudio = supabase.storage.from("voice-history").upload(audioPath, blob, { contentType: blob.type || "audio/webm" });
      setStatus("thinking");
      const chat = await fetch(`${functionsUrl}/voice-chat`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ question: transcript, conversationId, stream: false }), signal: abort.signal });
      const response = await chat.json().catch(() => ({}));
      if (!chat.ok) throw new Error(response.error || `Assistant request failed (${chat.status}).`);
      setConversationId(response.conversationId);
      void uploadAudio.then(async ({ error }) => {
        if (error) return;
        const { data: message } = await supabase.from("voice_messages").select("id").eq("conversation_id", response.conversationId).eq("role", "user").order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (message) await supabase.from("voice_messages").update({ audio_path: audioPath }).eq("id", message.id);
      });
      try { await synthesizeAndPlay(response.answer, auth.session.user.id, response.conversationId, abort.signal); }
      catch (error) { if (!abort.signal.aborted) { speakFallback(response.answer); } else { throw error; } }
      await loadHistory();
    } catch (error) {
      if (abort.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        setStatus("idle");
        return;
      }
      console.error("Voice request failed", error);
      setErrorMessage(error instanceof Error ? error.message : "Voice request failed."); setStatus("error");
      window.setTimeout(() => setStatus("idle"), 3000);
    } finally {
      if (requestAbort.current === abort) requestAbort.current = null;
    }
  }, [conversationId, loadHistory, speakFallback, synthesizeAndPlay]);

  const stopRecording = useCallback((options: { discard?: boolean } = {}) => {
    discardRecording.current = options.discard ?? false;
    if (silence.current) window.clearTimeout(silence.current);
    if (noSpeech.current) window.clearTimeout(noSpeech.current);
    recognition.current?.stop();
    recognition.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    stopPlayback();
    if (!window.isSecureContext) {
      showMicrophoneIssue("insecure");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined" || typeof AudioContext === "undefined") {
      showMicrophoneIssue("unsupported");
      return;
    }

    try {
      try {
        const permission = await navigator.permissions?.query({ name: "microphone" as PermissionName });
        if (permission?.state === "denied") {
          showMicrophoneIssue("permission");
          return;
        }
      } catch {
        // Some browsers do not expose microphone permission through the Permissions API.
      }

      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = mic; chunks.current = [];
      discardRecording.current = false;
      browserTranscript.current = "";
      hasSpoken.current = false;
      if (VoiceRecognition.isSupported()) {
        const engine = new VoiceRecognition();
        recognition.current = engine;
        engine.start({ language: "en", continuous: true, interimResults: true, onResult: (text, final) => {
          if (final) browserTranscript.current = `${browserTranscript.current} ${text}`.trim();
        } });
      }
      const recording = new MediaRecorder(mic); recorder.current = recording;
      recording.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data); };
      // Prefer a browser transcript immediately; Gemini is the fallback when
      // one is not available after a short final-result grace period.
      recording.onstop = () => {
        if (discardRecording.current) {
          discardRecording.current = false;
          setStatus("idle");
          return;
        }
        if (!hasSpoken.current && !browserTranscript.current) return;
        window.setTimeout(() => processRecording(new Blob(chunks.current, { type: recording.mimeType || "audio/webm" }), browserTranscript.current), browserTranscript.current ? 150 : 600);
      };
      const context = new AudioContext(); const source = context.createMediaStreamSource(mic); const analyser = context.createAnalyser(); analyser.fftSize = 256; source.connect(analyser);
      const detect = () => {
        if (recorder.current?.state !== "recording") { context.close(); return; }
        const data = new Uint8Array(analyser.frequencyBinCount); analyser.getByteTimeDomainData(data);
        const level = data.reduce((sum, value) => sum + Math.abs(value - 128), 0) / data.length / 128; setVolume(level);
        if (level > 0.035) {
          hasSpoken.current = true;
          if (silence.current) window.clearTimeout(silence.current);
          if (noSpeech.current) window.clearTimeout(noSpeech.current);
          silence.current = null; noSpeech.current = null;
        } else if (hasSpoken.current && !silence.current) {
          // End the turn quickly after the speaker finishes, but never stop
          // immediately just because they pause before starting to speak.
          silence.current = window.setTimeout(stopRecording, 2200);
        }
        requestAnimationFrame(detect);
      };
      recording.start(); setStatus("listening");
      noSpeech.current = window.setTimeout(() => {
        if (!hasSpoken.current) { setErrorMessage("No speech detected. Please try again."); stopRecording(); }
      }, 3000);
      detect();
    } catch (error) {
      stream.current?.getTracks().forEach(track => track.stop());
      stream.current = null;
      showMicrophoneIssue(classifyMicrophoneError(error), error);
    }
  }, [processRecording, showMicrophoneIssue, stopPlayback, stopRecording]);

  const stopAssistant = useCallback(() => {
    requestAbort.current?.abort();
    requestAbort.current = null;
    stopRecording({ discard: true });
    stopPlayback();
    setErrorMessage("");
    setStatus("idle");
  }, [stopPlayback, stopRecording]);

  const startAssistant = useCallback(() => {
    if (status === "listening") return;
    stopPlayback();
    setErrorMessage("");
    setMicDialogOpen(false);
    void startRecording();
  }, [startRecording, status, stopPlayback]);

  const replay = async (item: HistoryItem) => {
    stopPlayback();
    let url = item.audio_url || "";
    if (!url && item.audio_path) { const signed = await supabase.storage.from("voice-history").createSignedUrl(item.audio_path, 3600); url = signed.data?.signedUrl || ""; }
    if (url) { const player = new Audio(url); audio.current = player; player.onended = () => setPlaying(null); setPlaying(item.id); await player.play(); return; }
    speakFallback(item.content); setPlaying(item.id);
  };

  useEffect(() => () => { stopAssistant(); }, [stopAssistant]);
  useEffect(() => { if (historyOpen) loadHistory(); }, [historyOpen, loadHistory]);
  const labels: Record<Status, string> = { idle: "Tap the microphone to speak", listening: "Listening…", uploading: "Processing your voice…", thinking: "Thinking…", speaking: "Speaking — tap the mic to interrupt", error: errorMessage || "Voice request failed." };
  const active = status === "listening" || status === "speaking";
  const currentMicGuidance = microphoneGuidance[micIssue];
  const voiceInterface = (
    <main className="min-h-[calc(100vh-8rem)] rounded-2xl border border-border bg-card text-foreground shadow-card">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">JobAI Scout</p><h1 className="mt-1 font-display text-xl font-semibold">Voice assistant</h1></div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" aria-label="Add knowledge-base document" onClick={() => documentInput.current?.click()}><FileUp className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" aria-label="History" onClick={() => setHistoryOpen(true)}><History className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className={cn("text-muted-foreground hover:text-foreground", settingsOpen && "bg-muted text-foreground")} aria-label="Voice settings" onClick={() => setSettingsOpen(open => !open)}><Settings2 className="h-4 w-4" /></Button>
            <input ref={documentInput} className="hidden" type="file" accept=".pdf,.txt,.md,.csv,.doc,.docx" onChange={event => { const file = event.target.files?.[0]; if (file) uploadKnowledgeBase(file); event.currentTarget.value = ""; }} />
          </div>
        </header>
        <section className="flex flex-1 flex-col items-center justify-center py-10 text-center sm:py-14">
          <div className="w-full max-w-xl rounded-3xl border border-border bg-muted/20 px-6 py-10 sm:px-10">
            <div className={cn("mx-auto mb-6 w-fit rounded-full border px-3 py-1 text-xs font-medium", status === "error" ? "border-destructive/30 bg-destructive/10 text-destructive" : active ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground")}>{status === "listening" ? "Listening" : status === "thinking" ? "Finding your answer" : status === "speaking" ? "Speaking" : status === "error" ? "Try again" : "Ready"}</div>
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Ask about your career.</h2>
            <p className={cn("mx-auto mt-3 min-h-6 max-w-md text-sm leading-6", status === "error" ? "text-destructive" : "text-muted-foreground")}>{labels[status]}</p>
            <div className="my-8 flex justify-center"><WaveformVisualizer volume={volume} isActive={active} color={status === "listening" ? "rose" : "indigo"} /></div>
            <Button type="button" onClick={status === "idle" || status === "error" ? startAssistant : stopAssistant} size="lg" className={cn("h-12 min-w-52 gap-2 rounded-xl px-6 font-semibold", status === "idle" || status === "error" ? "bg-primary hover:bg-primary/90" : "bg-destructive hover:bg-destructive/90 text-destructive-foreground")}>
              {status === "idle" || status === "error" ? <><Power className="h-4 w-4" /> Start voice assistant</> : <><Square className="h-4 w-4 fill-current" /> Stop voice assistant</>}
            </Button>
            <p className="mt-5 text-xs text-muted-foreground">Stop cancels recording, the current request, and any spoken response.</p>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">Add a document with the upload icon to ask questions from your own material.</p>
        </section>
        {settingsOpen && <section className="mx-auto mb-2 w-full max-w-md rounded-xl border border-border bg-muted/30 p-4"><div className="flex items-center gap-2 text-sm font-medium"><Volume2 className="h-4 w-4 text-primary" /> Speech speed <span className="ml-auto text-muted-foreground">{speed.toFixed(2)}x</span></div><Slider className="mt-4" min={0.75} max={1.5} step={0.05} value={[speed]} onValueChange={([value]) => setSpeed(value)} /></section>}
      </div>
      {uploadMessage && <div className={cn("fixed bottom-5 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-xl border bg-card/95 px-4 py-3 text-sm shadow-2xl backdrop-blur-xl", uploadState === "error" ? "border-destructive/40 text-destructive" : "border-primary/25")}>
        {uploadState === "error" ? <CircleAlert className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}<span>{uploadMessage}</span>
      </div>}
      {historyOpen && <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-sm overflow-auto border-l border-border bg-card p-5 shadow-2xl"><div className="mb-6 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Conversation</p><h2 className="mt-1 font-display font-semibold">Voice history</h2></div><Button variant="ghost" size="icon" onClick={() => setHistoryOpen(false)}><X className="h-4 w-4" /></Button></div>{history.length ? <div className="space-y-2">{history.map(item => <button key={item.id} onClick={() => playing === item.id ? stopPlayback() : replay(item)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-muted/20 p-3 text-left transition-colors hover:bg-muted/60"><span className="rounded-full bg-primary/10 p-2 text-primary">{playing === item.id ? <Pause size={15}/> : <Play size={15}/>}</span><span className="min-w-0 text-sm text-muted-foreground">{item.role === "user" ? "Your voice message" : "JobAI Scout response"}<small className="mt-1 block text-xs text-muted-foreground/70">{new Date(item.created_at).toLocaleString()}</small></span></button>)}</div> : <p className="text-sm text-muted-foreground">No voice history yet.</p>}</aside>}
      <MicPermissionDialog open={micDialogOpen} onOpenChange={setMicDialogOpen} onRequestPermission={startAssistant} title={currentMicGuidance.title} description={currentMicGuidance.message} actionLabel={currentMicGuidance.action} />
    </main>
  );

  return voiceInterface; /* Legacy voice interface retained below for safe replacement.
    <header className="w-full max-w-4xl flex items-center justify-between"><div><p className="text-xs tracking-[.22em] uppercase text-indigo-300">JobAI Scout</p><h1 className="text-xl font-semibold">Voice Assistant</h1></div><div className="flex gap-2"><Button variant="ghost" size="icon" aria-label="Add knowledge-base document" onClick={() => documentInput.current?.click()}><FileUp /></Button><Button variant="ghost" size="icon" aria-label="History" onClick={() => setHistoryOpen(true)}><History /></Button><Button variant="ghost" size="icon" aria-label="Voice settings" onClick={() => document.getElementById("voice-settings")?.classList.toggle("hidden")}><Settings2 /></Button><input ref={documentInput} className="hidden" type="file" accept=".pdf,.txt,.md,.csv,.doc,.docx" onChange={event => { const file = event.target.files?.[0]; if (file) uploadKnowledgeBase(file); event.currentTarget.value = ""; }} /></div></header>
    <section className="flex-1 w-full max-w-xl flex flex-col items-center justify-center gap-8"><div className="text-center min-h-12"><p className={cn("text-base", status === "error" ? "text-red-300" : "text-white/70")}>{labels[status]}</p></div><WaveformVisualizer volume={volume} isActive={active} color={status === "listening" ? "rose" : "indigo"} /><button aria-label={status === "listening" ? "Stop recording" : "Start speaking"} onClick={() => status === "listening" ? stopRecording() : startRecording()} disabled={status === "uploading" || status === "thinking"} className={cn("w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-105 disabled:opacity-50", status === "listening" ? "bg-rose-500 animate-pulse" : "bg-indigo-600")}><Mic size={38} /></button><p className="text-xs text-white/35">Use the upload icon to add PDF, text, Word, Markdown, or CSV knowledge.</p></section>
    <section id="voice-settings" className="hidden w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2 text-sm"><Volume2 size={16}/> Speech speed <span className="ml-auto">{speed.toFixed(2)}×</span></div><Slider className="mt-3" min={0.75} max={1.5} step={0.05} value={[speed]} onValueChange={([value]) => setSpeed(value)} /></section>
    {uploadMessage && <p className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg bg-slate-800 px-4 py-2 text-sm text-white/85 shadow-xl">{uploadMessage}</p>}
    {historyOpen && <aside className="fixed inset-y-0 right-0 w-full max-w-sm z-50 bg-[#0b0e20] border-l border-white/10 p-5 overflow-auto"><div className="flex justify-between items-center mb-6"><h2 className="font-semibold">Voice history</h2><Button variant="ghost" size="icon" onClick={() => setHistoryOpen(false)}><X /></Button></div>{history.length ? <div className="space-y-3">{history.map(item => <button key={item.id} onClick={() => playing === item.id ? stopPlayback() : replay(item)} className="w-full flex items-center gap-3 rounded-xl bg-white/5 p-4 text-left hover:bg-white/10"><span className="rounded-full bg-indigo-500/20 p-2">{playing === item.id ? <Pause size={16}/> : <Play size={16}/>}</span><span className="text-sm text-white/60">{item.role === "user" ? "Your voice message" : "JobAI Scout response"}<small className="block text-white/30 mt-1">{new Date(item.created_at).toLocaleString()}</small></span></button>)}</div> : <p className="text-sm text-white/45">No voice history yet.</p>}</aside>}
  */
}

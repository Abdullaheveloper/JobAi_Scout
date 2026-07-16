import { useCallback, useEffect, useRef, useState } from "react";
import { FileUp, History, Mic, Pause, Play, Settings2, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { VoiceRecognition } from "@/lib/voice/recognition";

type Status = "idle" | "listening" | "uploading" | "thinking" | "speaking" | "error";
type HistoryItem = { id: string; role: "user" | "assistant"; audio_url: string | null; audio_path: string | null; content: string; created_at: string };
const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export function VoiceMode() {
  const [status, setStatus] = useState<Status>("idle");
  const [volume, setVolume] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const silence = useRef<number | null>(null);
  const documentInput = useRef<HTMLInputElement | null>(null);
  const recognition = useRef<VoiceRecognition | null>(null);
  const browserTranscript = useRef("");

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

  const synthesizeAndPlay = useCallback(async (text: string, userId: string, sessionId: string) => {
    const headers = await authHeaders();
    const response = await fetch(`${functionsUrl}/voice-tts`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ text, voice: "Eve", speed }) });
    if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || `TTS request failed (${response.status}).`); }
    const blob = await response.blob();
    const path = `${userId}/${sessionId}/assistant-${crypto.randomUUID()}.mp3`;
    const upload = await supabase.storage.from("voice-history").upload(path, blob, { contentType: "audio/mpeg" });
    if (upload.error) throw upload.error;
    const { data: message } = await supabase.from("voice_messages").select("id").eq("conversation_id", sessionId).eq("role", "assistant").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (message) await supabase.from("voice_messages").update({ audio_path: path }).eq("id", message.id);
    const player = new Audio(URL.createObjectURL(blob));
    audio.current = player; player.onended = () => setStatus("idle"); setStatus("speaking"); await player.play();
  }, [speed]);

  const uploadKnowledgeBase = useCallback(async (file: File) => {
    try {
      setUploadMessage("Adding document to knowledge base…");
      const headers = await authHeaders(); const form = new FormData(); form.append("file", file);
      const response = await fetch(`${functionsUrl}/kb-ingest-document`, { method: "POST", headers, body: form });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Document upload failed (${response.status}).`);
      setUploadMessage(`${file.name} is ready for voice questions.`);
    } catch (error) { setUploadMessage(error instanceof Error ? error.message : "Document upload failed."); }
  }, []);

  const processRecording = useCallback(async (blob: Blob, recognizedText = "") => {
    if (!blob.size) return setStatus("idle");
    try {
      setStatus("uploading"); setErrorMessage("");
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session) throw new Error("Please sign in to use voice assistant.");
      const extension = blob.type.includes("ogg") ? "ogg" : "webm";
      const path = `${auth.session.user.id}/${crypto.randomUUID()}/user.${extension}`;
      const upload = await supabase.storage.from("voice-history").upload(path, blob, { contentType: blob.type || "audio/webm" });
      if (upload.error) throw new Error(`Audio upload failed: ${upload.error.message}`);
      const headers = await authHeaders();
      // Chrome/Edge Web Speech is free and avoids requiring OpenRouter audio
      // credit. Other browsers continue to use the server-side Voxtral fallback.
      let transcript = recognizedText.trim();
      if (!transcript) {
        const form = new FormData(); form.append("file", blob, `recording.${extension}`);
        const stt = await fetch(`${functionsUrl}/voice-transcribe`, { method: "POST", headers, body: form });
        const transcription = await stt.json().catch(() => ({}));
        if (!stt.ok || !transcription.text?.trim()) throw new Error(transcription.error || `Transcription failed (${stt.status}). Add at least $0.50 OpenRouter audio balance or use Chrome/Edge browser speech recognition.`);
        transcript = transcription.text;
      }
      setStatus("thinking");
      const chat = await fetch(`${functionsUrl}/voice-chat`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ question: transcript, conversationId, userAudioPath: path, stream: false }) });
      const response = await chat.json().catch(() => ({}));
      if (!chat.ok) throw new Error(response.error || `Assistant request failed (${chat.status}).`);
      setConversationId(response.conversationId);
      await synthesizeAndPlay(response.answer, auth.session.user.id, response.conversationId);
      await loadHistory();
    } catch (error) {
      console.error("Voice request failed", error);
      setErrorMessage(error instanceof Error ? error.message : "Voice request failed."); setStatus("error");
      window.setTimeout(() => setStatus("idle"), 5000);
    }
  }, [conversationId, loadHistory, synthesizeAndPlay]);

  const stopRecording = useCallback(() => {
    if (silence.current) window.clearTimeout(silence.current);
    recognition.current?.stop();
    recognition.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    stopPlayback();
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = mic; chunks.current = [];
      browserTranscript.current = "";
      if (VoiceRecognition.isSupported()) {
        const engine = new VoiceRecognition();
        recognition.current = engine;
        engine.start({ language: "en", continuous: true, interimResults: true, onResult: (text, final) => {
          if (final) browserTranscript.current = `${browserTranscript.current} ${text}`.trim();
        } });
      }
      const recording = new MediaRecorder(mic); recorder.current = recording;
      recording.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data); };
      recording.onstop = () => window.setTimeout(() => processRecording(new Blob(chunks.current, { type: recording.mimeType || "audio/webm" }), browserTranscript.current), 300);
      const context = new AudioContext(); const source = context.createMediaStreamSource(mic); const analyser = context.createAnalyser(); analyser.fftSize = 256; source.connect(analyser);
      const detect = () => {
        if (recorder.current?.state !== "recording") { context.close(); return; }
        const data = new Uint8Array(analyser.frequencyBinCount); analyser.getByteTimeDomainData(data);
        const level = data.reduce((sum, value) => sum + Math.abs(value - 128), 0) / data.length / 128; setVolume(level);
        if (level > 0.035) { if (silence.current) window.clearTimeout(silence.current); silence.current = null; }
        else if (!silence.current) silence.current = window.setTimeout(stopRecording, 1400);
        requestAnimationFrame(detect);
      };
      recording.start(); setStatus("listening"); detect();
    } catch { setErrorMessage("Microphone access was denied or is unavailable."); setStatus("error"); }
  }, [processRecording, stopPlayback, stopRecording]);

  const replay = async (item: HistoryItem) => {
    stopPlayback();
    let url = item.audio_url || "";
    if (!url && item.audio_path) { const signed = await supabase.storage.from("voice-history").createSignedUrl(item.audio_path, 3600); url = signed.data?.signedUrl || ""; }
    if (url) { const player = new Audio(url); audio.current = player; player.onended = () => setPlaying(null); setPlaying(item.id); await player.play(); return; }
    speakFallback(item.content); setPlaying(item.id);
  };

  useEffect(() => () => { stopRecording(); stopPlayback(); }, [stopPlayback, stopRecording]);
  useEffect(() => { if (historyOpen) loadHistory(); }, [historyOpen, loadHistory]);
  const labels: Record<Status, string> = { idle: "Tap the microphone to speak", listening: "Listening…", uploading: "Processing your voice…", thinking: "Thinking…", speaking: "Speaking — tap the mic to interrupt", error: errorMessage || "Voice request failed." };
  const active = status === "listening" || status === "speaking";

  return <main className="min-h-[calc(100vh-4rem)] bg-[#060816] text-white flex flex-col items-center px-5 py-8">
    <header className="w-full max-w-4xl flex items-center justify-between"><div><p className="text-xs tracking-[.22em] uppercase text-indigo-300">JobAI Scout</p><h1 className="text-xl font-semibold">Voice Assistant</h1></div><div className="flex gap-2"><Button variant="ghost" size="icon" aria-label="Add knowledge-base document" onClick={() => documentInput.current?.click()}><FileUp /></Button><Button variant="ghost" size="icon" aria-label="History" onClick={() => setHistoryOpen(true)}><History /></Button><Button variant="ghost" size="icon" aria-label="Voice settings" onClick={() => document.getElementById("voice-settings")?.classList.toggle("hidden")}><Settings2 /></Button><input ref={documentInput} className="hidden" type="file" accept=".pdf,.txt,.md,.csv,.doc,.docx" onChange={event => { const file = event.target.files?.[0]; if (file) uploadKnowledgeBase(file); event.currentTarget.value = ""; }} /></div></header>
    <section className="flex-1 w-full max-w-xl flex flex-col items-center justify-center gap-8"><div className="text-center min-h-12"><p className={cn("text-base", status === "error" ? "text-red-300" : "text-white/70")}>{labels[status]}</p></div><WaveformVisualizer volume={volume} isActive={active} color={status === "listening" ? "rose" : "indigo"} /><button aria-label={status === "listening" ? "Stop recording" : "Start speaking"} onClick={() => status === "listening" ? stopRecording() : startRecording()} disabled={status === "uploading" || status === "thinking"} className={cn("w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-105 disabled:opacity-50", status === "listening" ? "bg-rose-500 animate-pulse" : "bg-indigo-600")}><Mic size={38} /></button><p className="text-xs text-white/35">Use the upload icon to add PDF, text, Word, Markdown, or CSV knowledge.</p></section>
    <section id="voice-settings" className="hidden w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2 text-sm"><Volume2 size={16}/> Speech speed <span className="ml-auto">{speed.toFixed(2)}×</span></div><Slider className="mt-3" min={0.75} max={1.5} step={0.05} value={[speed]} onValueChange={([value]) => setSpeed(value)} /></section>
    {uploadMessage && <p className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-lg bg-slate-800 px-4 py-2 text-sm text-white/85 shadow-xl">{uploadMessage}</p>}
    {historyOpen && <aside className="fixed inset-y-0 right-0 w-full max-w-sm z-50 bg-[#0b0e20] border-l border-white/10 p-5 overflow-auto"><div className="flex justify-between items-center mb-6"><h2 className="font-semibold">Voice history</h2><Button variant="ghost" size="icon" onClick={() => setHistoryOpen(false)}><X /></Button></div>{history.length ? <div className="space-y-3">{history.map(item => <button key={item.id} onClick={() => playing === item.id ? stopPlayback() : replay(item)} className="w-full flex items-center gap-3 rounded-xl bg-white/5 p-4 text-left hover:bg-white/10"><span className="rounded-full bg-indigo-500/20 p-2">{playing === item.id ? <Pause size={16}/> : <Play size={16}/>}</span><span className="text-sm text-white/60">{item.role === "user" ? "Your voice message" : "JobAI Scout response"}<small className="block text-white/30 mt-1">{new Date(item.created_at).toLocaleString()}</small></span></button>)}</div> : <p className="text-sm text-white/45">No voice history yet.</p>}</aside>}
  </main>;
}

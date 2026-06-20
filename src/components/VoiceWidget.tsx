import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Mic, MicOff, X, Loader2, Volume2, Square, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string; sources?: { url: string; title: string }[] };
type Status = "idle" | "listening" | "thinking" | "speaking";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export function VoiceWidget() {
  const location = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hide on auth/landing pages
  const onDashboard = location.pathname.startsWith("/dashboard") ||
    location.pathname.startsWith("/recruiter") || location.pathname.startsWith("/admin");
  // Hide widget on the dedicated assistant page (it has its own UI)
  const onAssistant = location.pathname === "/dashboard/assistant";

  const tearDown = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current?.state !== "closed") audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    setLevel(0);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = "";
      audioElRef.current = null;
    }
    setStatus("idle");
  }, []);

  const startMeter = (stream: MediaStream) => {
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 256;
    src.connect(an);
    analyserRef.current = an;
    const data = new Uint8Array(an.frequencyBinCount);
    const tick = () => {
      an.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      setLevel(sum / data.length / 255);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const startListening = useCallback(async () => {
    // Interrupt any current speech
    stopSpeaking();
    setLiveTranscript("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = ["audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        tearDown();
        if (blob.size < 1024) {
          setStatus("idle");
          toast({ title: "Didn't catch that", description: "Recording was too short.", variant: "destructive" });
          return;
        }
        await handleAudio(blob);
      };
      rec.start();
      setStatus("listening");
      startMeter(stream);
    } catch (e) {
      console.error(e);
      toast({ title: "Microphone error", description: "Please allow microphone access.", variant: "destructive" });
    }
  }, [stopSpeaking, toast, tearDown]);

  const stopListening = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  const handleAudio = async (blob: Blob) => {
    setStatus("thinking");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const auth = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;

      // 1. STT
      const fd = new FormData();
      fd.append("file", blob, "recording.webm");
      const sttResp = await fetch(`${FUNCTIONS_URL}/voice-transcribe`, {
        method: "POST", headers: { Authorization: auth, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }, body: fd,
      });
      const sttJson = await sttResp.json();
      if (!sttResp.ok) throw new Error(sttJson.error || "Transcription failed");
      const userText = (sttJson.text || "").trim();
      if (!userText) {
        setStatus("idle");
        toast({ title: "Didn't catch that", description: "Try again." });
        return;
      }
      setLiveTranscript("");
      setMessages((m) => [...m, { role: "user", content: userText }]);

      // 2. RAG chat
      const chatResp = await fetch(`${FUNCTIONS_URL}/voice-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ question: userText, conversationId }),
      });
      const chatJson = await chatResp.json();
      if (!chatResp.ok) throw new Error(chatJson.error || "Chat failed");
      const answer: string = chatJson.answer;
      setConversationId(chatJson.conversationId);
      setMessages((m) => [...m, { role: "assistant", content: answer, sources: chatJson.sources }]);

      // 3. TTS
      setStatus("speaking");
      const ttsResp = await fetch(`${FUNCTIONS_URL}/elevenlabs-tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ text: answer.slice(0, 4500) }),
      });
      if (!ttsResp.ok) throw new Error("TTS failed");
      const audioBlob = await ttsResp.blob();
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioElRef.current = audio;
      audio.onended = () => { setStatus("idle"); URL.revokeObjectURL(url); audioElRef.current = null; };
      audio.onerror = () => { setStatus("idle"); };
      await audio.play();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
      setStatus("idle");
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveTranscript]);

  useEffect(() => () => { tearDown(); stopSpeaking(); }, [tearDown, stopSpeaking]);

  if (!onDashboard || onAssistant) return null;

  const onMicClick = () => {
    if (status === "listening") stopListening();
    else if (status === "speaking") { stopSpeaking(); startListening(); }
    else if (status === "idle") startListening();
  };

  return (
    <>
      {/* Floating button */}
      <button
        aria-label="Open voice assistant"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full",
          "bg-primary/90 backdrop-blur-xl shadow-2xl border border-primary-foreground/20",
          "flex items-center justify-center text-primary-foreground",
          "hover:scale-110 transition-transform",
          status === "listening" && "ring-4 ring-primary/40 animate-pulse",
          status === "speaking" && "ring-4 ring-accent/40",
        )}
      >
        {status === "thinking" ? <Loader2 className="h-6 w-6 animate-spin" /> : <Mic className="h-6 w-6" />}
      </button>

      {/* Panel */}
      {open && (
        <div
          className={cn(
            "fixed bottom-24 right-6 z-50 w-[min(380px,calc(100vw-3rem))] h-[520px]",
            "rounded-2xl border border-border/40 shadow-2xl",
            "bg-card/80 backdrop-blur-2xl",
            "flex flex-col overflow-hidden animate-in slide-in-from-bottom-4",
          )}
        >
          <div className="flex items-center justify-between p-4 border-b border-border/40">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                <Mic className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm">Voice Assistant</p>
                <p className="text-xs text-muted-foreground capitalize">{status}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 && (
              <div className="text-center text-sm text-muted-foreground mt-8 px-4">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Tap the mic and ask anything about this site or your career.
              </div>
            )}
            <div className="space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 backdrop-blur",
                  )}>
                    {m.content}
                  </div>
                </div>
              ))}
              {liveTranscript && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-primary/40 text-primary-foreground italic">
                    {liveTranscript}
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* Waveform + controls */}
          <div className="border-t border-border/40 p-4 space-y-3">
            <div className="flex items-center justify-center gap-1 h-8">
              {Array.from({ length: 24 }).map((_, i) => {
                const active = status === "listening" || status === "speaking";
                const base = active ? 4 + Math.abs(Math.sin((Date.now() / 200) + i)) * 8 : 3;
                const h = active ? Math.max(3, base + level * 32) : 3;
                return (
                  <span
                    key={i}
                    className={cn(
                      "w-1 rounded-full transition-all",
                      status === "listening" ? "bg-primary" : status === "speaking" ? "bg-accent" : "bg-muted-foreground/30",
                    )}
                    style={{ height: `${h}px` }}
                  />
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-2">
              {status === "speaking" && (
                <Button variant="outline" size="sm" onClick={stopSpeaking} className="gap-1">
                  <Square className="h-3 w-3" /> Stop
                </Button>
              )}
              <Button
                onClick={onMicClick}
                disabled={status === "thinking"}
                size="lg"
                className={cn(
                  "rounded-full h-14 w-14 p-0",
                  status === "listening" && "bg-destructive hover:bg-destructive/90",
                )}
              >
                {status === "thinking" ? <Loader2 className="h-5 w-5 animate-spin" /> :
                 status === "listening" ? <MicOff className="h-5 w-5" /> :
                 status === "speaking" ? <Volume2 className="h-5 w-5" /> :
                 <Mic className="h-5 w-5" />}
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {status === "idle" && "Tap mic to speak"}
              {status === "listening" && "Listening... tap to send"}
              {status === "thinking" && "Thinking..."}
              {status === "speaking" && "Speaking — tap mic to interrupt"}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
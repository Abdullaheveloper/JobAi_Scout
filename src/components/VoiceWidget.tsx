import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Mic, MicOff, X, Loader2, Volume2, Square, MessageSquare, Minimize2, Maximize2, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// Browser-native voice engine
import { VoiceRecognition } from "@/lib/voice/recognition";
import { voiceSynthesis } from "@/lib/voice/synthesis";
import { VoiceActivityDetector } from "@/lib/voice/vad";

type Msg = { role: "user" | "assistant"; content: string; sources?: { url: string; title: string }[]; confidence?: number };
type VoiceState = "idle" | "listening" | "processing" | "thinking" | "speaking" | "interrupted" | "error" | "offline";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export function VoiceWidget() {
  const location = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [status, setStatus] = useState<VoiceState>("idle");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [detectedLang, setDetectedLang] = useState<string | null>(null);

  const recognitionRef = useRef<VoiceRecognition | null>(null);
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  
  const [volume, setVolume] = useState(0);
  const waveformRef = useRef<HTMLDivElement | null>(null);

  // ─── Waveform Animation Loop ───
  useEffect(() => {
    let animId: number;
    const updateWaveform = () => {
      if (waveformRef.current && (status === "listening" || status === "speaking")) {
        const spans = waveformRef.current.children;
        const currentLevel = status === "listening" ? volume : 0.12 * (1 + Math.sin(Date.now() / 120));
        for (let i = 0; i < spans.length; i++) {
          const span = spans[i] as HTMLSpanElement;
          const base = 4 + Math.abs(Math.sin((Date.now() / 200) + i)) * 8;
          const h = Math.max(3, base + currentLevel * 32);
          span.style.height = `${h}px`;
        }
      }
      animId = requestAnimationFrame(updateWaveform);
    };

    if (status === "listening" || status === "speaking") {
      animId = requestAnimationFrame(updateWaveform);
    } else {
      if (waveformRef.current) {
        const spans = waveformRef.current.children;
        for (let i = 0; i < spans.length; i++) {
          (spans[i] as HTMLSpanElement).style.height = "3px";
        }
      }
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [status, volume]);

  const onDashboard = location.pathname.startsWith("/dashboard") ||
    location.pathname.startsWith("/recruiter") || location.pathname.startsWith("/admin");
  const onAssistant = location.pathname === "/dashboard/assistant";

  // Load latest conversation history when widget is opened
  useEffect(() => {
    if (!open) return;
    
    const loadLatestConversation = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Get latest conversation
        const { data: convos, error: convoErr } = await supabase
          .from("voice_conversations")
          .select("id")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (convoErr || !convos || convos.length === 0) return;
        const latestConvoId = convos[0].id;
        setConversationId(latestConvoId);

        // Load messages
        const { data: msgs, error: msgsErr } = await supabase
          .from("voice_messages")
          .select("role, content")
          .eq("conversation_id", latestConvoId)
          .order("created_at", { ascending: true });

        if (msgsErr || !msgs) return;
        setMessages(msgs.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content
        })));
      } catch (err) {
        console.warn("Failed to load voice widget history:", err);
      }
    };

    loadLatestConversation();
  }, [open]);

  const stopSpeaking = useCallback(() => {
    voiceSynthesis.stop();
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setStreamingText("");
    if (status === "speaking") setStatus("idle");
  }, [status]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    vadRef.current?.stop();
    vadRef.current = null;
    if (status === "listening") setStatus("idle");
  }, [status]);

  const getAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;
  };

  const handleQuerySubmit = async (queryText: string) => {
    if (!queryText.trim()) { setStatus("idle"); return; }
    setMessages((m) => [...m, { role: "user", content: queryText }]);
    setStatus("thinking");

    try {
      const auth = await getAuth();
      const abort = new AbortController();
      abortRef.current = abort;

      const chatResp = await fetch(`${FUNCTIONS_URL}/voice-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: auth,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ question: queryText, conversationId, stream: true }),
        signal: abort.signal,
      });

      if (!chatResp.ok) throw new Error("Assistant response failed");

      const reader = chatResp.body!.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = "";
      let meta: { conversationId?: string; sources?: Msg["sources"]; confidence?: number; language?: string } = {};
      
      setStatus("speaking");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const dataLine = line.replace(/^data: /, "").trim();
          if (!dataLine) continue;
          try {
            const parsed = JSON.parse(dataLine);
            if (parsed.type === "metadata") {
              meta = parsed;
              setConversationId(parsed.conversationId);
              setDetectedLang(parsed.language);
            } else if (parsed.type === "chunk") {
              fullAnswer += parsed.text;
              setStreamingText(fullAnswer);
            } else if (parsed.type === "done") {
              fullAnswer = parsed.fullAnswer || fullAnswer;
            }
          } catch { /* skip parsing errors */ }
        }
      }

      setMessages((m) => [...m, { role: "assistant", content: fullAnswer, sources: meta.sources, confidence: meta.confidence }]);
      setStreamingText("");
      abortRef.current = null;

      // Speak back using browser TTS
      setStatus("speaking");
      await voiceSynthesis.speak(fullAnswer, {
        language: meta.language || 'en',
        onEnd: () => setStatus("idle"),
        onError: () => setStatus("idle"),
      });

    } catch (e) {
      if ((e as Error).name === "AbortError") { setStatus("idle"); return; }
      console.error(e);
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const startListening = useCallback(async () => {
    stopSpeaking();
    setVolume(0);

    if (VoiceRecognition.isSupported()) {
      const recognition = new VoiceRecognition();
      recognitionRef.current = recognition;

      const started = recognition.start({
        language: 'en',
        continuous: false,
        interimResults: true,
        onResult: (transcript, isFinal) => {
          if (isFinal) {
            stopListening();
            if (transcript.trim()) {
              handleQuerySubmit(transcript.trim());
            }
          } else {
            setStreamingText(transcript);
          }
        },
        onError: (err) => {
          console.warn("Speech recognition error:", err);
          stopListening();
        },
        onEnd: () => {
          if (status === "listening") setStatus("idle");
        }
      });

      if (started) {
        setStatus("listening");
        return;
      }
    }

    // Fallback: VAD Mode
    try {
      const vad = new VoiceActivityDetector({
        silenceThreshold: 0.025,
        minSpeechMs: 400,
        minRecordMs: 1800,
        maxRecordMs: 30000,
        onVolumeChange: (level) => setVolume(level),
        onSpeechEnd: () => {
          stopListening();
        },
        onError: (err) => {
          console.error("VAD error:", err);
          setStatus("error");
        }
      });
      vadRef.current = vad;
      const stream = await vad.start();
      if (stream) setStatus("listening");
    } catch {
      setStatus("offline");
      toast({ title: "Microphone error", description: "Please allow microphone access.", variant: "destructive" });
    }
  }, [stopSpeaking, toast, status]);

  const bargeIn = useCallback(() => {
    stopSpeaking();
    setStatus("idle");
    setTimeout(() => startListening(), 100);
  }, [stopSpeaking, startListening]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamingText]);
  useEffect(() => () => { stopSpeaking(); stopListening(); }, [stopSpeaking, stopListening]);

  if (!onDashboard || onAssistant) return null;

  const onMicClick = () => {
    switch (status) {
      case "listening": stopListening(); break;
      case "speaking": bargeIn(); break;
      case "idle":
      case "offline":
      case "error":
        startListening();
        break;
    }
  };

  const stateLabel = () => {
    const labels: Record<VoiceState, string> = {
      idle: "Tap mic to speak", listening: "Listening...", processing: "Transcribing...",
      thinking: "Thinking...", speaking: "Speaking — tap to interrupt", interrupted: "Interrupted",
      error: "Error occurred", offline: "Microphone unavailable",
    };
    return labels[status];
  };

  return (
    <>
      {/* Floating button */}
      <button aria-label="Open voice assistant" onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-2xl",
          "bg-primary/90 backdrop-blur-xl border border-primary-foreground/20",
          "flex items-center justify-center text-primary-foreground",
          "hover:scale-110 transition-all",
          status === "listening" && "ring-4 ring-primary/40 animate-pulse",
          status === "speaking" && "ring-4 ring-accent/40",
        )}>
        {status === "processing" || status === "thinking" ? <Loader2 className="h-6 w-6 animate-spin" /> : <Mic className="h-6 w-6" />}
      </button>

      {/* Panel */}
      {open && !minimized && (
        <div className={cn(
          "fixed bottom-24 right-6 z-50 w-[min(400px,calc(100vw-3rem))] h-[560px]",
          "rounded-2xl border border-border/40 shadow-2xl",
          "bg-card/80 backdrop-blur-2xl",
          "flex flex-col overflow-hidden animate-in slide-in-from-bottom-4",
        )}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/40">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                <Mic className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm">Voice Assistant</p>
                <p className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                  {status === "speaking" && <Volume2 className="h-3 w-3" />}
                  {status === "listening" && <Mic className="h-3 w-3" />}
                  {stateLabel()}
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMinimized(true)}><Minimize2 className="h-3 w-3" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 && !streamingText && (
              <div className="text-center text-sm text-muted-foreground mt-8 px-4">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Tap the mic and ask anything.</p>
                {detectedLang && <p className="flex items-center justify-center gap-1 mt-2"><Languages className="h-3 w-3" />{detectedLang.toUpperCase()}</p>}
              </div>
            )}
            <div className="space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/60 backdrop-blur",
                  )}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.confidence !== undefined && m.confidence !== null && (
                      <div className="mt-1 flex items-center gap-1">
                        <div className={cn("h-1 rounded-full", m.confidence >= 0.7 ? "bg-green-400" : m.confidence >= 0.5 ? "bg-yellow-400" : "bg-red-400")}
                          style={{ width: `${m.confidence * 30}px` }} />
                        <span className="text-[10px] opacity-50">{Math.round(m.confidence * 100)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {streamingText && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-muted/60 backdrop-blur">
                    <p className="whitespace-pre-wrap">{streamingText}<span className="animate-pulse">|</span></p>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* Controls */}
          <div className="border-t border-border/40 p-4 space-y-2">
            {/* Mini waveform */}
            <div className="flex items-center justify-center gap-0.5 h-8" ref={waveformRef}>
              {Array.from({ length: 28 }).map((_, i) => (
                <span key={i} className={cn(
                  "w-1 rounded-full transition-all duration-75",
                  status === "listening" ? "bg-primary" : status === "speaking" ? "bg-accent" : "bg-muted-foreground/30",
                )} style={{ height: "3px" }} />
              ))}
            </div>

            <div className="flex items-center justify-center gap-2">
              {status === "speaking" && (
                <Button variant="outline" size="sm" onClick={stopSpeaking} className="gap-1">
                  <Square className="h-3 w-3" /> Stop
                </Button>
              )}
              <Button onClick={onMicClick} disabled={status === "processing" || status === "thinking"}
                size="lg" className={cn("rounded-full h-14 w-14 p-0 shadow-lg",
                  status === "listening" && "bg-destructive hover:bg-destructive/90 ring-4 ring-destructive/30 animate-pulse",
                  status === "speaking" && "bg-accent hover:bg-accent/90 text-accent-foreground")}>
                {status === "processing" || status === "thinking" ? <Loader2 className="h-5 w-5 animate-spin" /> :
                 status === "listening" ? <MicOff className="h-5 w-5" /> :
                 status === "speaking" ? <Volume2 className="h-5 w-5" /> :
                 <Mic className="h-5 w-5" />}
              </Button>
              {status === "listening" && (
                <Button variant="outline" size="sm" onClick={stopListening} className="gap-1">
                  <Square className="h-3 w-3" /> Send
                </Button>
              )}
            </div>
            <p className="text-center text-xs text-muted-foreground">{stateLabel()}</p>
          </div>
        </div>
      )}

      {/* Minimized bar */}
      {open && minimized && (
        <button onClick={() => setMinimized(false)}
          className="fixed bottom-24 right-6 z-50 px-4 py-2 rounded-xl bg-card/80 backdrop-blur-xl border border-border/40 shadow-lg flex items-center gap-2 text-sm animate-in slide-in-from-bottom-2">
          <div className="h-6 w-6 rounded-full gradient-primary flex items-center justify-center">
            <Mic className="h-3 w-3 text-primary-foreground" />
          </div>
          <span>Voice Assistant</span>
          <Maximize2 className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    </>
  );
}

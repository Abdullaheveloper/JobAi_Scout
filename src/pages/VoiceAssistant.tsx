import { useEffect, useRef, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, Loader2, Volume2, Square, Globe, Trash2, RefreshCw, CheckCircle2, Clock, AlertCircle, FileText, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string; sources?: { url: string; title: string }[] };
type Status = "idle" | "listening" | "thinking" | "speaking";
type Source = { id: string; url: string; title: string | null; status: string; pages_indexed: number; last_crawled_at: string | null; error: string | null };

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export default function VoiceAssistant() {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("idle");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  // KB state
  const [sources, setSources] = useState<Source[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [indexing, setIndexing] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const loadSources = useCallback(async () => {
    const { data } = await supabase.from("kb_sources").select("*").order("created_at", { ascending: false });
    setSources((data as Source[]) || []);
  }, []);

  useEffect(() => { loadSources(); }, [loadSources]);

  const tearDown = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current?.state !== "closed") audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current = null; }
    setStatus("idle");
  }, []);

  const startMeter = (stream: MediaStream) => {
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 256;
    src.connect(an);
    const data = new Uint8Array(an.frequencyBinCount);
    const tick = () => {
      an.getByteFrequencyData(data);
      let sum = 0; for (let i = 0; i < data.length; i++) sum += data[i];
      setLevel(sum / data.length / 255);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const getAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;
  };

  const handleAudio = async (blob: Blob) => {
    setStatus("thinking");
    try {
      const auth = await getAuth();
      const fd = new FormData();
      fd.append("file", blob, "recording.webm");
      const sttResp = await fetch(`${FUNCTIONS_URL}/voice-transcribe`, {
        method: "POST", headers: { Authorization: auth, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }, body: fd,
      });
      const sttJson = await sttResp.json();
      if (!sttResp.ok) throw new Error(sttJson.error || "Transcription failed");
      const userText = (sttJson.text || "").trim();
      if (!userText) { setStatus("idle"); return; }
      setMessages((m) => [...m, { role: "user", content: userText }]);

      const chatResp = await fetch(`${FUNCTIONS_URL}/voice-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ question: userText, conversationId }),
      });
      const chatJson = await chatResp.json();
      if (!chatResp.ok) throw new Error(chatJson.error || "Chat failed");
      setConversationId(chatJson.conversationId);
      setMessages((m) => [...m, { role: "assistant", content: chatJson.answer, sources: chatJson.sources }]);

      setStatus("speaking");
      const ttsResp = await fetch(`${FUNCTIONS_URL}/elevenlabs-tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ text: chatJson.answer.slice(0, 4500) }),
      });
      if (!ttsResp.ok) throw new Error("TTS failed");
      const audioBlob = await ttsResp.blob();
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioElRef.current = audio;
      audio.onended = () => { setStatus("idle"); URL.revokeObjectURL(url); audioElRef.current = null; };
      await audio.play();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
      setStatus("idle");
    }
  };

  const startListening = useCallback(async () => {
    stopSpeaking();
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
        if (blob.size < 1024) { setStatus("idle"); return; }
        await handleAudio(blob);
      };
      rec.start();
      setStatus("listening");
      startMeter(stream);
    } catch (e) {
      toast({ title: "Microphone error", description: "Please allow microphone access.", variant: "destructive" });
    }
  }, [stopSpeaking, tearDown, toast]);

  const stopListening = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }, []);

  const onMicClick = () => {
    if (status === "listening") stopListening();
    else if (status === "speaking") { stopSpeaking(); startListening(); }
    else if (status === "idle") startListening();
  };

  const reindex = async (url: string) => {
    setIndexing(true);
    try {
      const auth = await getAuth();
      const resp = await fetch(`${FUNCTIONS_URL}/kb-reindex`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
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
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "PDF only", description: "Please upload a .pdf file.", variant: "destructive" });
      return;
    }
    setUploadingPdf(true);
    try {
      const auth = await getAuth();
      const fd = new FormData();
      fd.append("file", file, file.name);
      const resp = await fetch(`${FUNCTIONS_URL}/kb-ingest-pdf`, {
        method: "POST",
        headers: { Authorization: auth, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
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

  useEffect(() => () => { tearDown(); stopSpeaking(); }, [tearDown, stopSpeaking]);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto animate-fade-in">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Mic className="h-7 w-7 text-primary" />
            Voice Assistant
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ask anything by voice. Answers come from your indexed website + general career knowledge.
          </p>
        </div>

        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="chat">Voice Chat</TabsTrigger>
            <TabsTrigger value="kb">Knowledge Base</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="mt-6">
            <Card className="bg-card/60 backdrop-blur-xl border-border/50">
              <CardContent className="p-0 flex flex-col h-[calc(100vh-20rem)] min-h-[480px]">
                <ScrollArea className="flex-1 p-6">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-12">
                      <div className="h-20 w-20 rounded-3xl gradient-primary flex items-center justify-center shadow-xl">
                        <Mic className="h-10 w-10 text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="font-display text-xl font-semibold mb-1">Tap the mic to talk</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                          I'll answer using your indexed website. For career questions, I'll help even if it's not in the site.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((m, i) => (
                        <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                          <div className={cn(
                            "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                            m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/60 backdrop-blur",
                          )}>
                            <p>{m.content}</p>
                            {m.sources && m.sources.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-border/40 flex flex-wrap gap-1">
                                {m.sources.slice(0, 3).map((s, j) => (
                                  <a key={j} href={s.url} target="_blank" rel="noreferrer"
                                    className="text-xs underline opacity-70 hover:opacity-100 truncate max-w-[200px]">
                                    {s.title || s.url}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {/* Waveform + controls */}
                <div className="border-t border-border/40 p-6 space-y-4 bg-muted/20 backdrop-blur">
                  <div className="flex items-center justify-center gap-1 h-12">
                    {Array.from({ length: 32 }).map((_, i) => {
                      const active = status === "listening" || status === "speaking";
                      const base = active ? 6 + Math.abs(Math.sin((Date.now() / 200) + i * 0.4)) * 10 : 4;
                      const h = active ? Math.max(4, base + level * 40) : 4;
                      return (
                        <span
                          key={i}
                          className={cn(
                            "w-1.5 rounded-full transition-all",
                            status === "listening" ? "bg-primary" :
                            status === "speaking" ? "bg-accent" :
                            "bg-muted-foreground/30",
                          )}
                          style={{ height: `${h}px` }}
                        />
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    {status === "speaking" && (
                      <Button variant="outline" onClick={stopSpeaking} className="gap-2">
                        <Square className="h-4 w-4" /> Stop
                      </Button>
                    )}
                    <Button
                      onClick={onMicClick}
                      disabled={status === "thinking"}
                      className={cn(
                        "rounded-full h-16 w-16 p-0 shadow-xl",
                        status === "listening" && "bg-destructive hover:bg-destructive/90",
                      )}
                    >
                      {status === "thinking" ? <Loader2 className="h-6 w-6 animate-spin" /> :
                       status === "listening" ? <MicOff className="h-6 w-6" /> :
                       status === "speaking" ? <Volume2 className="h-6 w-6" /> :
                       <Mic className="h-6 w-6" />}
                    </Button>
                  </div>
                  <p className="text-center text-xs text-muted-foreground capitalize">
                    {status === "idle" && "Tap mic to speak"}
                    {status === "listening" && "Listening — tap to send"}
                    {status === "thinking" && "Thinking..."}
                    {status === "speaking" && "Speaking — tap mic to interrupt"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

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
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadPdf(f);
                  }}
                />
                <Button
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={uploadingPdf}
                  variant="outline"
                  className="gap-2"
                >
                  {uploadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploadingPdf ? "Extracting & indexing..." : "Choose PDF file"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Text is extracted with AI, chunked, embedded, and stored. Max 20MB. The assistant will answer from this content too.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Indexed sources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sources.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No sources yet. Add a website above.</p>
                ) : sources.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-card">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {s.status === "ready" ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> :
                       s.status === "failed" ? <AlertCircle className="h-4 w-4 text-destructive shrink-0" /> :
                       <Clock className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{s.title || s.url}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.url}</p>
                        {s.error && <p className="text-xs text-destructive">{s.error}</p>}
                      </div>
                      <Badge variant="secondary" className="shrink-0">{s.pages_indexed} pages</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => reindex(s.url)} disabled={indexing}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteSource(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

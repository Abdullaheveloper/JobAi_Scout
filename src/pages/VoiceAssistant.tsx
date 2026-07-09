import { useEffect, useRef, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mic, Loader2, Volume2, Globe, Trash2, RefreshCw, CheckCircle2,
  Clock, AlertCircle, FileText, Upload, Settings2, Languages,
  MessageSquare, Zap, X, AlertTriangle, ShieldCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// Chat and Voice components/stores
import { useChatStore } from "@/stores/chat-store";
import { useVoiceStore } from "@/stores/voice-store";
import { useChat } from "@/hooks/useChat";
import { useVoice } from "@/hooks/useVoice";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { ConversationList } from "@/components/chat/ConversationList";
import { VoiceMode } from "@/components/voice/VoiceMode";
import { VoiceStatusBadge } from "@/components/voice/VoiceStatusBadge";
import { MicPermissionDialog } from "@/components/voice/MicPermissionDialog";

type Source = {
  id: string;
  url: string;
  title: string | null;
  status: string;
  pages_indexed: number;
  last_crawled_at: string | null;
  error: string | null;
  document_type: string;
  file_size?: number;
};

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

export default function VoiceAssistant() {
  const { toast } = useToast();
  
  // Zustand store and hooks
  const chatStore = useChatStore();
  const voiceStore = useVoiceStore();
  const voice = useVoice();
  
  // Local state
  const [sources, setSources] = useState<Source[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [indexing, setIndexing] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [micPermOpen, setMicPermOpen] = useState(false);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  // Load knowledge base sources
  const loadSources = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("kb_sources")
        .select("*")
        .order("created_at", { ascending: false });
      setSources((data as Source[]) || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadSources();
    chatStore.loadConversations();
    
    // Check microphone permission
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
        voiceStore.setMicPermission(result.state === 'prompt' ? 'unknown' : result.state);
        result.onchange = () => {
          voiceStore.setMicPermission(result.state === 'prompt' ? 'unknown' : result.state);
        };
      }).catch(() => {});
    }
  }, [loadSources]);

  // Handle URL indexing
  const handleIndexUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    setIndexing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ? `Bearer ${session.access_token}` : "";
      
      const res = await fetch(`${supabase.supabaseUrl}/functions/v1/kb-reindex`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
          apikey: supabase.supabaseKey,
        },
        body: JSON.stringify({ url: newUrl.trim() }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to start crawling URL");
      }
      
      toast({
        title: "Indexing Started",
        description: "The website is being crawled and stored in the vector database.",
      });
      setNewUrl("");
      loadSources();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Indexing failed",
        description: (err as Error).message,
      });
    } finally {
      setIndexing(false);
    }
  };

  // Handle Document upload (PDF, DOCX, TXT, CSV, MD)
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Maximum supported file size is 20MB",
      });
      return;
    }

    setUploadingDoc(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ? `Bearer ${session.access_token}` : "";

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${supabase.supabaseUrl}/functions/v1/kb-ingest-document`, {
        method: "POST",
        headers: {
          Authorization: token,
          apikey: supabase.supabaseKey,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to upload document");
      }

      toast({
        title: "Document Uploaded",
        description: `${file.name} has been processed and added to your knowledge base.`,
      });
      loadSources();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: (err as Error).message,
      });
    } finally {
      setUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  };

  // Trigger mic permission dialog or start voice mode
  const handleVoiceModeToggle = () => {
    if (voiceStore.micPermission === 'denied') {
      toast({
        variant: "destructive",
        title: "Microphone Access Denied",
        description: "Please check your browser settings to allow microphone permission.",
      });
      return;
    }
    if (voiceStore.micPermission === 'unknown') {
      setMicPermOpen(true);
    } else {
      voiceStore.toggleVoiceMode();
    }
  };

  const handleRequestMicPermission = async () => {
    setMicPermOpen(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      voiceStore.setMicPermission('granted');
      voiceStore.setVoiceMode(true);
    } catch {
      voiceStore.setMicPermission('denied');
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "Could not request microphone access.",
      });
    }
  };

  const handleDeleteSource = async (id: string) => {
    try {
      const { error } = await supabase.from("kb_sources").delete().eq("id", id);
      if (error) throw error;
      setSources(s => s.filter(x => x.id !== id));
      toast({ title: "Source deleted" });
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to delete source", description: (e as Error).message });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden relative">
        {/* Left Panel: Conversations Sidebar */}
        <div className="w-80 border-r border-white/10 bg-slate-950/40 backdrop-blur-md flex flex-col h-full flex-shrink-0">
          <ConversationList className="flex-1" />
          
          {/* Quick Voice mode activation footer */}
          <div className="p-4 border-t border-white/10 flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-white/50">Voice Engine</span>
              <span className="text-[10px] text-white/20 font-mono">WebSpeech API</span>
            </div>
            <Button
              onClick={handleVoiceModeToggle}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl gap-2 flex items-center px-4"
              size="sm"
            >
              <Mic size={14} />
              Voice Mode
            </Button>
          </div>
        </div>

        {/* Center Panel: Main Chat Container */}
        <div className="flex-1 flex flex-col h-full bg-slate-900/10">
          {/* Top Chat header */}
          <div className="h-14 px-6 border-b border-white/10 bg-slate-950/20 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <h1 className="text-sm font-semibold text-white/80">
                {chatStore.activeConversationId
                  ? chatStore.conversations.find(c => c.id === chatStore.activeConversationId)?.title || "Active Chat"
                  : "New Conversation"}
              </h1>
              <VoiceStatusBadge />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className="h-8 text-white/50 hover:text-white hover:bg-white/5 gap-1.5 rounded-lg"
              >
                <Settings2 size={15} />
                <span className="text-xs">Voice Config</span>
              </Button>
            </div>
          </div>

          {/* Chat list + settings panel */}
          <div className="flex-1 overflow-hidden relative flex">
            <ChatContainer className="flex-1 h-full" />

            {/* Slide-out Voice Config Panel */}
            {showSettings && (
              <div className="w-80 border-l border-white/10 bg-slate-950/90 backdrop-blur-md p-6 overflow-y-auto space-y-6 flex-shrink-0 absolute right-0 top-0 bottom-0 z-10 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Voice Settings</h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)} className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/10 rounded-full">
                    <X size={14} />
                  </Button>
                </div>

                {/* Persona selector */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/45 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap size={12} className="text-indigo-400" />
                    Assistant Persona
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PERSONALITIES.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => voice.updateSettings({ personality: p.value })}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all",
                          voice.settings.personality === p.value
                            ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                            : "bg-white/5 border-transparent text-white/60 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <span className="text-lg">{p.icon}</span>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Language selector */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/45 uppercase tracking-wider flex items-center gap-1.5">
                    <Languages size={12} className="text-indigo-400" />
                    Speech Language
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => voice.updateSettings({ language: l.code })}
                        className={cn(
                          "py-1.5 rounded-lg border text-xs font-medium transition-all flex items-center justify-center gap-1",
                          voice.settings.language === l.code
                            ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                            : "bg-white/5 border-transparent text-white/60 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <span>{l.flag}</span>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Speed selector */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/45 uppercase tracking-wider flex items-center gap-1.5">
                    <Volume2 size={12} className="text-indigo-400" />
                    Speech Speed
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {SPEEDS.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => voice.updateSettings({ speed: s.value })}
                        className={cn(
                          "py-1.5 rounded-lg border text-xs font-medium transition-all",
                          voice.settings.speed === s.value
                            ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                            : "bg-white/5 border-transparent text-white/60 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60 font-medium">Auto-Speak Replies</span>
                    <input
                      type="checkbox"
                      checked={voice.settings.autoSpeak}
                      onChange={e => voice.updateSettings({ autoSpeak: e.target.checked })}
                      className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-0"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60 font-medium">Continuous Mic</span>
                    <input
                      type="checkbox"
                      checked={voice.settings.continuousMode}
                      onChange={e => voice.updateSettings({ continuousMode: e.target.checked })}
                      className="rounded bg-white/10 border-white/20 text-indigo-600 focus:ring-0"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Knowledge Base Manager */}
        <div className="w-80 border-l border-white/10 bg-slate-950/30 backdrop-blur-md flex flex-col h-full flex-shrink-0">
          <div className="px-6 py-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Knowledge Base</h2>
            <p className="text-[10px] text-white/30 mt-1">Grounded RAG Pipeline Context</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
            {/* Index Webpage */}
            <Card className="bg-white/5 border-white/10 text-white rounded-2xl">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-white/80 flex items-center gap-1.5">
                  <Globe size={13} className="text-indigo-400" />
                  Index Website URL
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <form onSubmit={handleIndexUrl} className="flex gap-1.5 mt-2">
                  <Input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://example.com/docs"
                    className="h-8 text-xs bg-white/5 border-white/10 text-white focus:border-indigo-500 rounded-xl"
                  />
                  <Button type="submit" disabled={indexing} className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-3" size="sm">
                    {indexing ? <Loader2 className="animate-spin" size={12} /> : "Index"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Document Uploader */}
            <Card className="bg-white/5 border-white/10 text-white rounded-2xl">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-white/80 flex items-center gap-1.5">
                  <FileText size={13} className="text-indigo-400" />
                  Upload Document
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div
                  onClick={() => docInputRef.current?.click()}
                  className="mt-2 border border-dashed border-white/20 hover:border-indigo-500/50 hover:bg-indigo-500/5 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all group"
                >
                  <Upload size={18} className="text-white/30 group-hover:text-indigo-400 transition-colors mb-1.5" />
                  <span className="text-[10px] text-white/50 text-center font-medium">Drag or tap to upload</span>
                  <span className="text-[9px] text-white/25 mt-0.5">PDF, DOCX, TXT, CSV, MD (Max 20MB)</span>
                </div>
                <input
                  type="file"
                  ref={docInputRef}
                  onChange={handleDocUpload}
                  accept=".pdf,.docx,.doc,.txt,.csv,.md"
                  className="hidden"
                />
                {uploadingDoc && (
                  <div className="flex items-center gap-2 mt-2 px-1 text-[10px] text-indigo-400">
                    <Loader2 className="animate-spin" size={10} />
                    Processing and chunking document...
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sources List */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-white/50 px-1">Indexed Sources</h3>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {sources.length === 0 ? (
                  <p className="text-[10px] text-white/20 text-center py-4">No sources indexed yet</p>
                ) : (
                  sources.map((src) => {
                    const isPdf = src.document_type === "pdf" || src.url.startsWith("pdf://");
                    const isDocx = src.document_type === "docx";
                    const isCsv = src.document_type === "csv";
                    const isMd = src.document_type === "md";
                    const isFile = isPdf || isDocx || isCsv || isMd;

                    return (
                      <div key={src.id} className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {isFile ? (
                            <FileText size={13} className="text-blue-400 flex-shrink-0" />
                          ) : (
                            <Globe size={13} className="text-green-400 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs text-white/80 font-medium truncate leading-normal">
                              {src.title || src.url}
                            </p>
                            <p className="text-[9px] text-white/30 flex items-center gap-1.5 mt-0.5 leading-none">
                              {src.status === "ready" ? (
                                <span className="text-emerald-400 flex items-center gap-0.5">
                                  <CheckCircle2 size={8} /> Chunks active
                                </span>
                              ) : src.status === "failed" ? (
                                <span className="text-rose-500 flex items-center gap-0.5" title={src.error || ""}>
                                  <AlertCircle size={8} /> Failed
                                </span>
                              ) : (
                                <span className="text-amber-400 flex items-center gap-0.5">
                                  <Clock size={8} /> Ingesting...
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSource(src.id)}
                          className="h-6 w-6 text-white/20 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg flex-shrink-0"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Voice Mode Overlay */}
      <VoiceMode />

      {/* Microphone Permission Modal */}
      <MicPermissionDialog
        open={micPermOpen}
        onOpenChange={setMicPermOpen}
        onRequestPermission={handleRequestMicPermission}
      />
    </DashboardLayout>
  );
}

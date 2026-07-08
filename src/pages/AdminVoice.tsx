import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mic, Settings, BarChart3, Globe, Search, AlertTriangle, Loader2,
  RefreshCw, Trash2, CheckCircle2, Clock, AlertCircle, ToggleLeft,
  ToggleRight, Languages, MessageSquare, Zap, Activity,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

type GlobalSettings = {
  id: string;
  assistant_enabled: boolean;
  silence_timeout: number;
  confidence_threshold: number;
  supported_languages: string[];
  default_personality: string;
  default_speed: number;
};
type AdminStats = {
  total_conversations: number;
  total_messages: number;
  total_searches: number;
  failed_searches: number;
  low_confidence: number;
  avg_confidence: number;
  avg_latency_ms: number;
  top_queries: { query: string; count: number }[];
  daily_activity: { date: string; searches: number }[];
  language_breakdown: { language: string; count: number }[];
};
type SearchLog = {
  id: string;
  query: string;
  top_similarity: number | null;
  confidence_score: number | null;
  result_count: number | null;
  language_detected: string | null;
  response_latency_ms: number | null;
  was_successful: boolean;
  created_at: string;
};
type Source = {
  id: string;
  url: string;
  title: string | null;
  status: string;
  pages_indexed: number;
  last_crawled_at: string | null;
  error: string | null;
};

export default function AdminVoice() {
  const { toast } = useToast();

  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [searchLogs, setSearchLogs] = useState<SearchLog[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [testQuery, setTestQuery] = useState("");
  const [testResults, setTestResults] = useState<null | { query: string; similarity: number; count: number }>(null);

  // Local state for editing
  const [editEnabled, setEditEnabled] = useState(true);
  const [editSilence, setEditSilence] = useState(2);
  const [editConfidence, setEditConfidence] = useState(0.70);

  const getAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;
  };

  const loadSettings = useCallback(async () => {
    try {
      const auth = await getAuth();
      const resp = await fetch(`${FUNCTIONS_URL}/voice-settings`, {
        headers: { Authorization: auth, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      if (resp.ok) {
        const json = await resp.json();
        const g = json.global;
        setSettings(g);
        setEditEnabled(g.assistant_enabled);
        setEditSilence(g.silence_timeout);
        setEditConfidence(g.confidence_threshold);
      }
    } catch { /* ignore */ }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_voice_admin_stats");
      if (!error && data) setStats(data as unknown as AdminStats);
    } catch { /* ignore */ }
  }, []);

  const loadSearchLogs = useCallback(async () => {
    const { data } = await supabase
      .from("voice_search_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setSearchLogs((data as SearchLog[]) || []);
  }, []);

  const loadSources = useCallback(async () => {
    const { data } = await supabase.from("kb_sources").select("*").order("created_at", { ascending: false });
    setSources((data as Source[]) || []);
  }, []);

  useEffect(() => {
    Promise.all([loadSettings(), loadStats(), loadSearchLogs(), loadSources()]).finally(() => setLoading(false));
  }, [loadSettings, loadStats, loadSearchLogs, loadSources]);

  const saveGlobalSettings = async () => {
    setSaving(true);
    try {
      const auth = await getAuth();
      const resp = await fetch(`${FUNCTIONS_URL}/voice-settings?action=global`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({
          assistant_enabled: editEnabled,
          silence_timeout: editSilence,
          confidence_threshold: editConfidence,
        }),
      });
      if (!resp.ok) throw new Error("Save failed");
      toast({ title: "Settings saved" });
      await loadSettings();
    } catch (e) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const reindexAll = async () => {
    setReindexing(true);
    try {
      const auth = await getAuth();
      for (const src of sources) {
        await fetch(`${FUNCTIONS_URL}/kb-reindex`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: auth, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({ url: src.url }),
        });
      }
      toast({ title: "Reindex complete", description: `${sources.length} sources reindexed.` });
      await loadSources();
    } catch (e) {
      toast({ title: "Reindex failed", description: (e as Error).message, variant: "destructive" });
    } finally { setReindexing(false); }
  };

  const deleteSource = async (id: string) => {
    await supabase.from("kb_sources").delete().eq("id", id);
    toast({ title: "Source deleted" });
    await loadSources();
  };

  const testRetrieval = async () => {
    if (!testQuery.trim()) return;
    try {
      const auth = await getAuth();
      // Use voice-chat but we just want to see the search results, not the LLM response
      const resp = await fetch(`${FUNCTIONS_URL}/voice-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ question: testQuery, stream: false }),
      });
      const json = await resp.json();
      if (resp.ok) {
        setTestResults({
          query: testQuery,
          similarity: json.confidence || 0,
          count: json.sources?.length || 0,
        });
      }
    } catch { toast({ title: "Test failed", variant: "destructive" }); }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto animate-fade-in">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Mic className="h-7 w-7 text-primary" /> Voice Assistant Admin
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure and monitor the voice assistant system.
          </p>
        </div>

        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="settings" className="gap-1"><Settings className="h-3 w-3" /> Settings</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1"><BarChart3 className="h-3 w-3" /> Analytics</TabsTrigger>
            <TabsTrigger value="knowledge" className="gap-1"><Globe className="h-3 w-3" /> Knowledge</TabsTrigger>
            <TabsTrigger value="searches" className="gap-1"><Search className="h-3 w-3" /> Searches</TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-6 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Settings className="h-5 w-5" /> Global Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {/* Enable/Disable */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Assistant Enabled</p>
                    <p className="text-xs text-muted-foreground">Turn the voice assistant on/off for all users</p>
                  </div>
                  <button onClick={() => setEditEnabled(!editEnabled)} className="text-primary">
                    {editEnabled ? <ToggleRight className="h-8 w-8" /> : <ToggleLeft className="h-8 w-8 text-muted-foreground" />}
                  </button>
                </div>

                {/* Silence Timeout */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Silence Timeout (seconds)</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button key={s} onClick={() => setEditSilence(s)}
                        className={cn("flex-1 p-2 rounded-lg text-sm border text-center transition-all",
                          editSilence === s ? "border-primary bg-primary/10 font-medium" : "border-border/50 hover:border-primary/50")}>
                        {s}s
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Auto-stop recording after this many seconds of silence.</p>
                </div>

                {/* Confidence Threshold */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Confidence Threshold: {Math.round(editConfidence * 100)}%</label>
                  <input type="range" min="0.3" max="0.95" step="0.05" value={editConfidence}
                    onChange={(e) => setEditConfidence(parseFloat(e.target.value))}
                    className="w-full accent-primary" />
                  <p className="text-xs text-muted-foreground mt-1">Below this threshold, the assistant says "I couldn't find that information."</p>
                </div>

                <Button onClick={saveGlobalSettings} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save Settings
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Search className="h-5 w-5" /> Test Retrieval</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input placeholder="Enter a test question..." value={testQuery} onChange={(e) => setTestQuery(e.target.value)} />
                  <Button onClick={testRetrieval} disabled={!testQuery.trim()}>Test</Button>
                </div>
                {testResults && (
                  <div className="p-3 rounded-lg border border-border/50 bg-muted/30 space-y-1">
                    <p className="text-sm font-medium">Query: "{testResults.query}"</p>
                    <p className="text-xs text-muted-foreground">Confidence: {Math.round(testResults.similarity * 100)}% | Results: {testResults.count}</p>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full",
                        testResults.similarity >= 0.7 ? "bg-green-500" : testResults.similarity >= 0.5 ? "bg-yellow-500" : "bg-red-500")}
                        style={{ width: `${testResults.similarity * 100}%` }} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-6 space-y-4">
            {stats && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Conversations", value: stats.total_conversations, icon: MessageSquare, color: "text-primary" },
                    { label: "Messages", value: stats.total_messages, icon: MessageSquare, color: "text-blue-500" },
                    { label: "Total Searches", value: stats.total_searches, icon: Search, color: "text-green-500" },
                    { label: "Avg Confidence", value: `${Math.round(stats.avg_confidence * 100)}%`, icon: Zap, color: "text-yellow-500" },
                    { label: "Failed Searches", value: stats.failed_searches, icon: AlertTriangle, color: "text-red-500" },
                    { label: "Low Confidence", value: stats.low_confidence, icon: AlertCircle, color: "text-orange-500" },
                    { label: "Avg Latency", value: `${Math.round(stats.avg_latency_ms)}ms`, icon: Activity, color: "text-purple-500" },
                    { label: "Languages", value: stats.language_breakdown?.length || 0, icon: Languages, color: "text-cyan-500" },
                  ].map((stat, i) => (
                    <Card key={i}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <stat.icon className={cn("h-5 w-5 shrink-0", stat.color)} />
                        <div>
                          <p className="text-2xl font-bold">{stat.value}</p>
                          <p className="text-xs text-muted-foreground">{stat.label}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Top queries */}
                <Card>
                  <CardHeader><CardTitle className="text-lg">Top Questions</CardTitle></CardHeader>
                  <CardContent>
                    {stats.top_queries?.length > 0 ? (
                      <div className="space-y-2">
                        {stats.top_queries.map((q, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-lg border border-border/30">
                            <span className="text-sm truncate flex-1">{q.query}</span>
                            <Badge variant="secondary">{q.count}x</Badge>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-muted-foreground text-center py-4">No searches yet</p>}
                  </CardContent>
                </Card>

                {/* Language breakdown */}
                {stats.language_breakdown?.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Languages className="h-5 w-5" /> Language Usage</CardTitle></CardHeader>
                    <CardContent className="flex gap-3 flex-wrap">
                      {stats.language_breakdown.map((l) => (
                        <Badge key={l.language} variant="outline" className="px-3 py-1">{l.language?.toUpperCase()} ({l.count})</Badge>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Knowledge Tab */}
          <TabsContent value="knowledge" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2"><Globe className="h-5 w-5" /> Indexed Sources ({sources.length})</span>
                  <Button variant="outline" size="sm" onClick={reindexAll} disabled={reindexing || sources.length === 0} className="gap-1">
                    {reindexing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Reindex All
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sources.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No sources indexed yet.</p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {sources.map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-card">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {s.status === "ready" ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> :
                             s.status === "failed" ? <AlertCircle className="h-4 w-4 text-destructive shrink-0" /> :
                             <Clock className="h-4 w-4 text-muted-foreground shrink-0" />}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{s.title || s.url}</p>
                              <p className="text-xs text-muted-foreground truncate">{s.url}</p>
                              {s.last_crawled_at && <p className="text-[10px] text-muted-foreground">Last crawled: {new Date(s.last_crawled_at).toLocaleString()}</p>}
                              {s.error && <p className="text-xs text-destructive">{s.error}</p>}
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Badge variant="secondary">{s.pages_indexed} pages</Badge>
                              <Badge variant={s.status === "ready" ? "default" : "outline"}>{s.status}</Badge>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => deleteSource(s.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Searches Tab */}
          <TabsContent value="searches" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="h-5 w-5" /> Recent Searches ({searchLogs.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {searchLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No searches recorded yet.</p>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {searchLogs.map((log) => (
                        <div key={log.id} className={cn(
                          "p-3 rounded-lg border",
                          !log.was_successful ? "border-red-500/30 bg-red-500/5" :
                          (log.confidence_score || 0) < 0.5 ? "border-yellow-500/30 bg-yellow-500/5" :
                          "border-border/50"
                        )}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{log.query}</p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                {log.confidence_score !== null && (
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded",
                                    log.confidence_score >= 0.7 ? "bg-green-500/10 text-green-600" :
                                    log.confidence_score >= 0.5 ? "bg-yellow-500/10 text-yellow-600" :
                                    "bg-red-500/10 text-red-600"
                                  )}>
                                    {Math.round(log.confidence_score * 100)}% confidence
                                  </span>
                                )}
                                {log.language_detected && <span>{log.language_detected.toUpperCase()}</span>}
                                {log.response_latency_ms !== null && <span>{log.response_latency_ms}ms</span>}
                                {log.result_count !== null && <span>{log.result_count} results</span>}
                                {!log.was_successful && <span className="text-red-500 font-medium">FAILED</span>}
                              </div>
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

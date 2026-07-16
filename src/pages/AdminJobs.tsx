import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCw, Trash2 } from "lucide-react";

export default function AdminJobs() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<any[]>([]);
  const [sourceType, setSourceType] = useState("rss");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    if (data) setJobs(data);
    const { data: sourceData } = await (supabase as any).from("job_sources").select("*").order("created_at", { ascending: false });
    if (sourceData) setSources(sourceData);
    setLoading(false);
  };

  const addSource = async () => {
    if (!sourceName.trim() || !sourceUrl.trim()) return;
    const { error } = await (supabase as any).from("job_sources").insert({ source_type: sourceType, name: sourceName.trim(), url: sourceUrl.trim(), enabled: true });
    if (error) return toast({ title: "Could not add source", description: error.message, variant: "destructive" });
    setSourceName(""); setSourceUrl(""); toast({ title: "Job source added" }); fetchJobs();
  };
  const toggleSource = async (source: any) => {
    const { error } = await (supabase as any).from("job_sources").update({ enabled: !source.enabled }).eq("id", source.id);
    if (error) toast({ title: "Could not update source", description: error.message, variant: "destructive" }); else fetchJobs();
  };
  const deleteSource = async (id: string) => {
    const { error } = await (supabase as any).from("job_sources").delete().eq("id", id);
    if (error) toast({ title: "Could not remove source", description: error.message, variant: "destructive" }); else { toast({ title: "Source removed" }); fetchJobs(); }
  };

  const deleteJob = async (id: string) => {
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setJobs((prev) => prev.filter((j) => j.id !== id));
      toast({ title: "Job deleted" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold">Manage Jobs</h1>
          <p className="text-muted-foreground mt-1">View and manage all job listings</p>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-5 space-y-4">
            <div><h2 className="font-display text-lg font-semibold">Collection Sources</h2><p className="text-sm text-muted-foreground">Add permitted RSS feeds or official company careers pages.</p></div>
            <div className="grid gap-3 md:grid-cols-[160px_1fr_2fr_auto] items-end"><div><Label>Type</Label><Select value={sourceType} onValueChange={setSourceType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="rss">RSS / XML Feed</SelectItem><SelectItem value="company_career">Company Careers</SelectItem></SelectContent></Select></div><div><Label>Name</Label><Input value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="Company or feed name" /></div><div><Label>URL</Label><Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." /></div><Button onClick={addSource}><Plus className="mr-1 h-4 w-4" />Add</Button></div>
            {sources.length > 0 && <div className="space-y-2">{sources.map((source) => <div key={source.id} className="flex items-center gap-3 rounded-lg border p-3"><Badge variant="outline">{source.source_type}</Badge><div className="min-w-0 flex-1"><p className="font-medium">{source.name}</p><p className="truncate text-xs text-muted-foreground">{source.url}</p>{source.last_error ? <p className="mt-1 text-xs text-destructive">Last error: {source.last_error}</p> : source.last_collected_at ? <p className="mt-1 text-xs text-muted-foreground">Last collected: {new Date(source.last_collected_at).toLocaleString()} · {source.last_result_count || 0} jobs</p> : <p className="mt-1 text-xs text-muted-foreground">Not collected yet</p>}</div><Button variant="outline" size="sm" onClick={() => toggleSource(source)}>{source.enabled ? "Enabled" : "Disabled"}</Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteSource(source.id)}><Trash2 className="h-4 w-4" /></Button></div>)}</div>}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.title}</TableCell>
                      <TableCell>{job.company}</TableCell>
                      <TableCell>{job.location || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{job.source}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={job.is_active ? "default" : "secondary"}>
                          {job.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteJob(job.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

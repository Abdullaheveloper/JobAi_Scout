import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Bookmark, MapPin, DollarSign, Building2, Trash2, ExternalLink } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

export default function SavedJobs() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<(Job & { saved_job_id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSaved();
  }, [user]);

  const fetchSaved = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("saved_jobs")
      .select("id, job_id, jobs(*)")
      .eq("user_id", user.id)
      .order("saved_at", { ascending: false });
    if (data) {
      setJobs(data.filter((d) => d.jobs).map((d) => ({ ...(d.jobs as unknown as Job), saved_job_id: d.id })));
    }
    setLoading(false);
  };

  const unsave = async (savedJobId: string) => {
    await supabase.from("saved_jobs").delete().eq("id", savedJobId);
    setJobs((prev) => prev.filter((j) => j.saved_job_id !== savedJobId));
    toast({ title: "Job removed from saved" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold">Saved Jobs</h1>
          <p className="text-muted-foreground mt-1">Jobs you've bookmarked for later</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : jobs.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <Bookmark className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-display text-xl font-semibold">No saved jobs yet</h3>
              <p className="text-muted-foreground mt-1">Browse jobs and save the ones you're interested in</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Card key={job.saved_job_id} className="shadow-card hover:shadow-card-hover transition-all">
                <CardContent className="p-5 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-lg font-semibold">{job.title}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{job.company}</span>
                      {job.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
                    </div>
                    {job.skills && job.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {job.skills.slice(0, 5).map((s) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {job.job_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={job.job_url} target="_blank" rel="noopener noreferrer">Apply <ExternalLink className="ml-1 h-3 w-3" /></a>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => unsave(job.saved_job_id)} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

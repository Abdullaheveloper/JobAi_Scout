import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Bookmark, MapPin, Building2, Trash2, ExternalLink, Sparkles, Briefcase } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { PORTAL_COLORS } from "@/lib/constants";

type RecommendedJob = Tables<"recommended_jobs">;
type Job = Tables<"jobs">;

interface SavedRecommendedJob {
  saved_job_id: string;
  rec_job: RecommendedJob;
}

interface SavedRegularJob {
  saved_job_id: string;
  job: Job;
}

export default function SavedJobs() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [savedRecJobs, setSavedRecJobs] = useState<SavedRecommendedJob[]>([]);
  const [savedRegJobs, setSavedRegJobs] = useState<SavedRegularJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSaved();
  }, [user]);

  const fetchSaved = async () => {
    if (!user) return;

    // Fetch saved recommended jobs
    const { data: recSaved } = await supabase
      .from("saved_jobs")
      .select("id, recommended_job_id, saved_at")
      .eq("user_id", user.id)
      .not("recommended_job_id", "is", null)
      .order("saved_at", { ascending: false });

    if (recSaved?.length) {
      const recIds = recSaved.map(s => s.recommended_job_id).filter(Boolean);
      const { data: recJobs } = await supabase
        .from("recommended_jobs")
        .select("*")
        .in("id", recIds as string[]);
      const jobMap = new Map((recJobs || []).map(j => [j.id, j]));
      setSavedRecJobs(
        recSaved.map(s => ({
          saved_job_id: s.id,
          rec_job: jobMap.get(s.recommended_job_id!)!,
        })).filter(s => s.rec_job)
      );
    } else {
      setSavedRecJobs([]);
    }

    // Fetch saved regular jobs (backward compat)
    const { data: regSaved } = await supabase
      .from("saved_jobs")
      .select("id, job_id, saved_at, jobs(*)")
      .eq("user_id", user.id)
      .is("recommended_job_id", null)
      .order("saved_at", { ascending: false });

    if (regSaved) {
      setSavedRegJobs(
        regSaved
          .filter(d => d.jobs)
          .map(d => ({ saved_job_id: d.id, job: d.jobs as unknown as Job }))
      );
    } else {
      setSavedRegJobs([]);
    }

    setLoading(false);
  };

  const unsave = async (savedJobId: string) => {
    await supabase.from("saved_jobs").delete().eq("id", savedJobId);
    setSavedRecJobs(prev => prev.filter(j => j.saved_job_id !== savedJobId));
    setSavedRegJobs(prev => prev.filter(j => j.saved_job_id !== savedJobId));
    toast({ title: "Job removed from saved" });
  };

  const totalCount = savedRecJobs.length + savedRegJobs.length;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Saved Jobs</h1>
            <p className="text-muted-foreground mt-1">Jobs you've bookmarked — never auto-deleted</p>
          </div>
          {totalCount > 0 && (
            <Badge variant="secondary" className="text-sm px-3 py-1">
              <Bookmark className="h-3.5 w-3.5 mr-1" />
              {totalCount} saved
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : totalCount === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <Bookmark className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-display text-xl font-semibold">No saved jobs yet</h3>
              <p className="text-muted-foreground mt-1">Browse recommended jobs and save the ones you're interested in</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Recommended Jobs from Extension */}
            {savedRecJobs.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-lg font-semibold">From Extension Scans</h2>
                  <Badge variant="outline">{savedRecJobs.length}</Badge>
                </div>
                <div className="space-y-3">
                  {savedRecJobs.map(({ saved_job_id, rec_job: job }) => {
                    const score = job.match_score || 0;
                    const portalColor = PORTAL_COLORS[job.source_portal] || "bg-gray-200 text-gray-700";
                    return (
                      <Card key={saved_job_id} className="shadow-card hover:shadow-card-hover transition-all group">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                                score >= 70 ? "bg-green-50 text-green-700 border-green-300" :
                                score >= 50 ? "bg-yellow-50 text-yellow-700 border-yellow-300" :
                                "bg-red-50 text-red-700 border-red-300"
                              }`}>
                                {score}%
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {job.source_url ? (
                                    <a href={job.source_url} target="_blank" rel="noopener noreferrer" className="font-display text-base font-semibold text-foreground group-hover:text-primary transition-colors hover:underline flex items-center gap-1">
                                      {job.title}
                                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </a>
                                  ) : (
                                    <h3 className="font-display text-base font-semibold">{job.title}</h3>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                                  <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{job.company}</span>
                                  {job.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
                                  {job.salary && <span>{job.salary}</span>}
                                  {job.employment_type && <span>{job.employment_type}</span>}
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${portalColor}`}>
                                    {job.source_portal}
                                  </span>
                                  {(job.skills_required || []).slice(0, 4).map(skill => (
                                    <Badge key={skill} variant="outline" className="text-xs font-normal">{skill}</Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              {job.source_url && (
                                <Button variant="outline" size="sm" asChild>
                                  <a href={job.source_url} target="_blank" rel="noopener noreferrer">Apply <ExternalLink className="ml-1 h-3 w-3" /></a>
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => unsave(saved_job_id)} className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Regular Saved Jobs (backward compat) */}
            {savedRegJobs.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Briefcase className="h-4 w-4 text-accent" />
                  <h2 className="font-display text-lg font-semibold">From Job Board</h2>
                  <Badge variant="outline">{savedRegJobs.length}</Badge>
                </div>
                <div className="space-y-3">
                  {savedRegJobs.map(({ saved_job_id, job }) => (
                    <Card key={saved_job_id} className="shadow-card hover:shadow-card-hover transition-all">
                      <CardContent className="p-5 flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display text-lg font-semibold">{job.title}</h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{job.company}</span>
                            {job.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
                          </div>
                          {job.skills && job.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {job.skills.slice(0, 5).map(s => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {job.job_url && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={job.job_url} target="_blank" rel="noopener noreferrer">Apply <ExternalLink className="ml-1 h-3 w-3" /></a>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => unsave(saved_job_id)} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

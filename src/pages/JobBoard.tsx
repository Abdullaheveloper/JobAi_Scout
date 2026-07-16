import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, MapPin, DollarSign, Bookmark, BookmarkCheck, ExternalLink, Building2, Clock, RefreshCw, Filter, Download, Chrome, Sparkles, Briefcase, ChevronDown, ChevronUp, ArrowUpRight, X } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { PORTAL_COLORS } from "@/lib/constants";

type RecommendedJob = Tables<"recommended_jobs">;
type Job = Tables<"jobs">;
const COLLECTED_PAGE_SIZE = 30;

function isNewJob(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000;
}

function MatchExplanation({ explanation }: { explanation: any }) {
  const [open, setOpen] = useState(false);
  if (!explanation || typeof explanation !== "object") return null;
  const items = [];
  if (explanation.skillsMatch?.matched?.length) {
    items.push({ icon: "✓", color: "text-green-600", text: `${explanation.skillsMatch.matched.length} skills match: ${explanation.skillsMatch.matched.slice(0, 4).join(", ")}` });
  }
  if (explanation.roleMatch?.matched) items.push({ icon: "✓", color: "text-green-600", text: `Role match: ${explanation.roleMatch.detail}` });
  if (explanation.experienceMatch?.score >= 70) items.push({ icon: "✓", color: "text-green-600", text: `Experience: ${explanation.experienceMatch.detail}` });
  if (explanation.locationMatch?.score >= 80) items.push({ icon: "✓", color: "text-green-600", text: `Location: ${explanation.locationMatch.detail}` });
  if (explanation.locationMatch?.score < 50) items.push({ icon: "⚠", color: "text-yellow-600", text: `Location: ${explanation.locationMatch?.detail || "Differs"}` });
  if (explanation.salaryMatch?.score < 50 && explanation.salaryMatch?.score > 0) items.push({ icon: "⚠", color: "text-yellow-600", text: `Salary: ${explanation.salaryMatch?.detail || "Mismatch"}` });
  if (!items.length) return null;

  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Why this matches
      </button>
      {open && (
        <div className="mt-1.5 space-y-0.5">
          {items.map((item, i) => (
            <div key={i} className={`flex items-center gap-1.5 text-xs ${item.color}`}>
              <span>{item.icon}</span>
              <span className="text-muted-foreground">{item.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExtensionOnboarding({ hasJobs, onCollect, collecting }: { hasJobs: boolean; onCollect: () => void; collecting: boolean }) {
  if (hasJobs) return null;
  const steps = [
    "Download and install the JobAI Scout extension",
    "Open chrome://extensions, enable Developer mode",
    "Click 'Load unpacked' and select the extension folder",
    "Login with your JobAI credentials in the extension",
    "Visit LinkedIn, Indeed, or Glassdoor job listings",
    "Click 'Scan Jobs' to discover matching opportunities",
    "Matching jobs appear here automatically!",
  ];

  const handleDownload = () => {
    fetch("/jobai-extension.zip")
      .then(res => { if (!res.ok) throw new Error(`Download failed: ${res.status}`); return res.blob(); })
      .then(blob => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "jobai-extension.zip"; a.click(); URL.revokeObjectURL(a.href); })
      .catch(() => {});
  };

  return (
    <Card className="border-dashed border-2 border-primary/30 bg-primary/5 shadow-card">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Chrome className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Connect the Job Scout Extension</h3>
            <p className="text-sm text-muted-foreground">Install the browser extension to discover and sync matching jobs from LinkedIn, Indeed, Glassdoor & more</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Button onClick={handleDownload} className="gap-2 mb-3">
              <Download className="h-4 w-4" /> Download Extension
            </Button>
            <Button onClick={onCollect} disabled={collecting} variant="outline" className="gap-2 mb-3 ml-2">
              <RefreshCw className={`h-4 w-4 ${collecting ? "animate-spin" : ""}`} /> {collecting ? "Collecting…" : "Collect Job Sources"}
            </Button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="badge badge-blue px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">v2.0.0</span>
              <span>Chrome, Edge, Brave, Opera</span>
            </div>
          </div>
          <div>
            <ol className="space-y-1.5">
              {steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function JobBoard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [recJobs, setRecJobs] = useState<RecommendedJob[]>([]);
  const [collectedJobs, setCollectedJobs] = useState<any[]>([]);
  const [savedRecIds, setSavedRecIds] = useState<Set<string>>(new Set());
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [remoteFilter, setRemoteFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [collectedPage, setCollectedPage] = useState(1);

  useEffect(() => {
    if (!user) return;

    fetchRecommendedJobs();

    // Supabase Realtime subscription to reload jobs automatically
    const channel = supabase
      .channel("recommended-jobs-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "recommended_jobs",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchRecommendedJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchRecommendedJobs = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("recommended_jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("match_score", { ascending: false });
    if (data) setRecJobs(data);

    const { data: collected } = await supabase.from("jobs").select("*").eq("is_active", true).eq("status" as any, "active").order("posted_at" as any, { ascending: false }).limit(100);
    if (collected) setCollectedJobs(collected);

    const { data: saved } = await supabase
      .from("saved_jobs")
      .select("recommended_job_id")
      .eq("user_id", user.id)
      .not("recommended_job_id", "is", null);
    if (saved) setSavedRecIds(new Set(saved.map(s => s.recommended_job_id!).filter(Boolean)));
    const { data: savedRegular } = await supabase.from("saved_jobs").select("job_id").eq("user_id", user.id).not("job_id", "is", null);
    if (savedRegular) setSavedJobIds(new Set(savedRegular.map(s => s.job_id!).filter(Boolean)));
    setLoading(false);
  };

  const handleRefresh = async () => {
    setScraping(true);
    try {
      const role = profile?.desired_roles?.[0] || "";
      const skills = profile?.skills || [];
      const query = role || (skills.length ? skills.slice(0, 3).join(" ") : "software developer");
      const userCity = locationFilter.trim() || "";
      const collectionLocation = userCity && !userCity.toLowerCase().includes("pakistan") ? `${userCity}, Pakistan` : (userCity || "Pakistan");
      const { data, error } = await supabase.functions.invoke("collect-jobs", {
        body: { query, location: collectionLocation, keywords: [query], locations: [collectionLocation], maxItems: 25 },
      });
      if (error) throw error;
      await fetchRecommendedJobs();
      toast({ title: "Job collection complete", description: `Found ${data.found} jobs, added ${data.inserted} new listings.${data.sourceErrors?.length ? ` ${data.sourceErrors.length} source(s) need attention.` : ""}` });
    } catch (err: any) {
      toast({ title: "Refresh failed", description: err.message || "Could not fetch new jobs", variant: "destructive" });
    } finally {
      setScraping(false);
    }
  };

  const toggleSaveJob = async (jobId: string) => {
    if (!user) return;
    if (savedJobIds.has(jobId)) {
      await supabase.from("saved_jobs").delete().eq("user_id", user.id).eq("job_id", jobId);
      setSavedJobIds(prev => { const next = new Set(prev); next.delete(jobId); return next; });
    } else {
      await supabase.from("saved_jobs").insert({ user_id: user.id, job_id: jobId });
      setSavedJobIds(prev => new Set(prev).add(jobId));
    }
  };

  const applyToCollectedJob = async (job: any) => {
    if (!user) return;
    if (job.recruiter_id) {
      const { error } = await supabase.from("job_applications").insert({ user_id: user.id, job_id: job.id });
      if (error && !error.message.toLowerCase().includes("duplicate")) return toast({ title: "Application failed", description: error.message, variant: "destructive" });
      toast({ title: "Application submitted" });
      return;
    }
    if (job.source_url) window.open(job.source_url, "_blank", "noopener,noreferrer");
  };

  const filteredCollected = useMemo(() => collectedJobs.filter((job) => {
    const term = search.toLowerCase();
    if (term && !`${job.title} ${job.company}`.toLowerCase().includes(term)) return false;
    if (locationFilter && !String(job.location || "").toLowerCase().includes(locationFilter.toLowerCase())) return false;
    if (jobTypeFilter !== "all" && String(job.job_type || "").toLowerCase() !== jobTypeFilter) return false;
    if (sourceFilter !== "all" && job.source !== sourceFilter) return false;
    if (remoteFilter !== "all" && String(job.work_mode || job.location || "").toLowerCase().indexOf(remoteFilter) < 0) return false;
    return true;
  }), [collectedJobs, search, locationFilter, jobTypeFilter, sourceFilter, remoteFilter]);
  const collectedTotalPages = Math.max(1, Math.ceil(filteredCollected.length / COLLECTED_PAGE_SIZE));
  const paginatedCollected = filteredCollected.slice((collectedPage - 1) * COLLECTED_PAGE_SIZE, collectedPage * COLLECTED_PAGE_SIZE);
  useEffect(() => { setCollectedPage(1); }, [search, locationFilter, jobTypeFilter, sourceFilter, remoteFilter]);

  const toggleSaveRec = async (recJobId: string) => {
    if (!user) return;
    if (savedRecIds.has(recJobId)) {
      await supabase.from("saved_jobs").delete().eq("user_id", user.id).eq("recommended_job_id", recJobId);
      setSavedRecIds(prev => { const next = new Set(prev); next.delete(recJobId); return next; });
      toast({ title: "Job unsaved" });
    } else {
      await supabase.from("saved_jobs").insert({ user_id: user.id, recommended_job_id: recJobId });
      setSavedRecIds(prev => new Set(prev).add(recJobId));
      toast({ title: "Job saved!" });
    }
  };

  const filtered = useMemo(() => {
    return recJobs.filter(j => {
      if (search) {
        const s = search.toLowerCase();
        if (!j.title.toLowerCase().includes(s) && !j.company.toLowerCase().includes(s)) return false;
      }
      if (locationFilter) {
        if (!j.location?.toLowerCase().includes(locationFilter.toLowerCase())) return false;
      }
      if (jobTypeFilter !== "all") {
        const emp = (j.employment_type || "").toLowerCase();
        if (jobTypeFilter === "remote" && !emp.includes("remote")) return false;
        if (jobTypeFilter !== "remote" && emp !== jobTypeFilter) return false;
      }
      if (sourceFilter !== "all" && j.source_portal !== sourceFilter) return false;
      if (scoreFilter !== "all") {
        const score = j.match_score || 0;
        if (scoreFilter === "80+" && score < 80) return false;
        if (scoreFilter === "60-79" && (score < 60 || score >= 80)) return false;
        if (scoreFilter === "40-59" && (score < 40 || score >= 60)) return false;
      }
      if (remoteFilter === "remote" && !(j.location || "").toLowerCase().includes("remote")) return false;
      if (remoteFilter === "hybrid" && !(j.location || "").toLowerCase().includes("hybrid")) return false;
      return true;
    });
  }, [recJobs, search, locationFilter, jobTypeFilter, sourceFilter, scoreFilter, remoteFilter]);

  const uniquePortals = useMemo(() => {
    const portals = new Set([
      ...recJobs.map(j => j.source_portal),
      ...collectedJobs.map(j => j.source),
    ].filter(Boolean));
    return [...portals];
  }, [recJobs, collectedJobs]);

  const hasActiveFilters = Boolean(search || locationFilter || jobTypeFilter !== "all" || sourceFilter !== "all" || remoteFilter !== "all");
  const clearFilters = () => {
    setSearch("");
    setLocationFilter("");
    setJobTypeFilter("all");
    setSourceFilter("all");
    setScoreFilter("all");
    setRemoteFilter("all");
  };
  const sourceLabel = (source?: string | null) => (source || "Job board").replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const relativeDate = (date?: string | null) => {
    if (!date) return "Recently added";
    const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
    if (days <= 0) return "Today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-8">
        <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card px-6 py-7 shadow-card md:px-8 md:py-9">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary"><Sparkles className="h-3.5 w-3.5" /> Job discovery</div>
              <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">A better way to find your next role.</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground md:text-base">Search a clean, deduplicated stream of roles from job boards, employer career pages, recruiter listings, and feeds.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Indeed", "Multi-board", "Recruiters", "Company careers", "RSS feeds"].map((source) => <Badge key={source} variant="secondary" className="border border-border/70 bg-background/60 px-2.5 py-1 font-normal">{source}</Badge>)}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
              <Button onClick={handleRefresh} disabled={scraping} className="min-w-48 gap-2 gradient-primary border-0 shadow-lg shadow-primary/20">
                <RefreshCw className={`h-4 w-4 ${scraping ? "animate-spin" : ""}`} />
                {scraping ? "Collecting roles..." : "Refresh job sources"}
              </Button>
              <p className="text-xs text-muted-foreground">{collectedJobs.length} roles currently indexed</p>
            </div>
          </div>
        </section>

        <Card className="border-border/80 bg-card/90 shadow-card">
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Job title, skill, or company" value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 border-border/80 bg-background/60 pl-11" />
              </div>
              <div className="relative lg:w-64">
                <MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="City, country, or remote" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="h-11 border-border/80 bg-background/60 pl-11" />
              </div>
              <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="h-11 gap-2 border-border/80 bg-background/40">
                <Filter className="h-4 w-4" /> {showFilters ? "Hide filters" : "Filters"}
                {hasActiveFilters && <span className="h-2 w-2 rounded-full bg-primary" />}
              </Button>
            </div>
            {showFilters && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/70 pt-4">
                <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}><SelectTrigger className="w-[155px] bg-background/60"><SelectValue placeholder="Job type" /></SelectTrigger><SelectContent><SelectItem value="all">Any job type</SelectItem><SelectItem value="full-time">Full-time</SelectItem><SelectItem value="part-time">Part-time</SelectItem><SelectItem value="contract">Contract</SelectItem><SelectItem value="internship">Internship</SelectItem></SelectContent></Select>
                <Select value={sourceFilter} onValueChange={setSourceFilter}><SelectTrigger className="w-[170px] bg-background/60"><SelectValue placeholder="Source" /></SelectTrigger><SelectContent><SelectItem value="all">Every source</SelectItem>{uniquePortals.map(p => <SelectItem key={p} value={p}>{sourceLabel(p)}</SelectItem>)}</SelectContent></Select>
                <Select value={remoteFilter} onValueChange={setRemoteFilter}><SelectTrigger className="w-[155px] bg-background/60"><SelectValue placeholder="Work mode" /></SelectTrigger><SelectContent><SelectItem value="all">Any work mode</SelectItem><SelectItem value="remote">Remote</SelectItem><SelectItem value="hybrid">Hybrid</SelectItem></SelectContent></Select>
                {hasActiveFilters && <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clearFilters}><X className="h-3.5 w-3.5" /> Clear filters</Button>}
              </div>
            )}
          </CardContent>
        </Card>
        {filteredCollected.length > 0 && (
          <section className="space-y-3">
            <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-xl font-semibold">Open roles</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{filteredCollected.length} matching role{filteredCollected.length !== 1 ? "s" : ""} · Page {collectedPage} of {collectedTotalPages}</p>
              </div>
              <Badge variant="secondary" className="w-fit border border-border/70 bg-muted/50 font-normal">Updated from live sources</Badge>
            </div>
            {paginatedCollected.map((job) => (
              <Card key={`modern-${job.id}`} className="group overflow-hidden border-border/80 bg-card shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-card-hover">
                <CardContent className="p-0">
                  <div className="flex gap-4 p-5 md:gap-5 md:p-6">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-display text-base font-bold text-primary">{(job.company || "J").charAt(0).toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">{sourceLabel(job.source)}</Badge>
                        {isNewJob(job.posted_at || job.created_at) && <Badge className="bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 hover:bg-emerald-500/15">New</Badge>}
                      </div>
                      <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-primary md:text-xl">{job.title}</h3>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5 font-medium text-foreground/85"><Building2 className="h-3.5 w-3.5 text-primary/70" />{job.company || "Company not listed"}</span>
                        {job.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
                        {job.job_type && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{job.job_type}</span>}
                        {job.salary && <span className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" />{job.salary}</span>}
                      </div>
                      {job.description && <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground line-clamp-2">{job.description}</p>}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {(job.skills || []).slice(0, 4).map((skill: string) => <Badge key={skill} variant="secondary" className="bg-muted/65 px-2 py-0.5 text-xs font-normal">{skill}</Badge>)}
                        <span className="ml-auto text-xs text-muted-foreground">{relativeDate(job.posted_at || job.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Button variant="ghost" size="icon" aria-label={savedJobIds.has(job.id) ? "Remove from saved jobs" : "Save job"} onClick={() => toggleSaveJob(job.id)} className={savedJobIds.has(job.id) ? "text-primary" : "text-muted-foreground"}>{savedJobIds.has(job.id) ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}</Button>
                      {(job.source_url || job.recruiter_id) && <Button size="sm" onClick={() => applyToCollectedJob(job)} className="hidden gap-1.5 sm:inline-flex">{job.recruiter_id ? "Apply" : "View role"}<ArrowUpRight className="h-3.5 w-3.5" /></Button>}
                    </div>
                  </div>
                  {(job.source_url || job.recruiter_id) && <div className="border-t border-border/60 px-5 py-3 sm:hidden"><Button size="sm" className="w-full gap-1.5" onClick={() => applyToCollectedJob(job)}>{job.recruiter_id ? "Apply to this role" : "View role"}<ArrowUpRight className="h-3.5 w-3.5" /></Button></div>}
                </CardContent>
              </Card>
            ))}
            {collectedTotalPages > 1 && <div className="flex items-center justify-center gap-3 pt-3"><Button variant="outline" size="sm" disabled={collectedPage === 1} onClick={() => setCollectedPage((page) => Math.max(1, page - 1))}>Previous</Button><span className="text-sm text-muted-foreground">{collectedPage} / {collectedTotalPages}</span><Button variant="outline" size="sm" disabled={collectedPage === collectedTotalPages} onClick={() => setCollectedPage((page) => Math.min(collectedTotalPages, page + 1))}>Next</Button></div>}
          </section>
        )}

        {false && filteredCollected.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1"><p className="text-sm text-muted-foreground">{filteredCollected.length} collected job{filteredCollected.length !== 1 ? "s" : ""} · Page {collectedPage} of {collectedTotalPages}</p><Badge variant="secondary">All sources</Badge></div>
            {paginatedCollected.map((job) => (
              <Card key={job.id} className="shadow-card hover:shadow-card-hover transition-all"><CardContent className="p-5 flex items-start justify-between gap-4"><div className="min-w-0"><h3 className="font-display text-lg font-semibold">{job.title}</h3><div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap"><span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{job.company}</span>{job.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}{job.job_type && <span>{job.job_type}</span>}{job.posted_at && <span>Posted {new Date(job.posted_at).toLocaleDateString()}</span>}</div><div className="flex gap-1.5 mt-2"><Badge variant="outline">{job.source}</Badge>{(job.skills || []).slice(0, 4).map((skill: string) => <Badge key={skill} variant="outline">{skill}</Badge>)}</div>{job.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{job.description}</p>}</div><div className="flex flex-col gap-2"><Button variant="ghost" size="icon" onClick={() => toggleSaveJob(job.id)}>{savedJobIds.has(job.id) ? <BookmarkCheck className="h-5 w-5 text-primary" /> : <Bookmark className="h-5 w-5" />}</Button>{(job.source_url || job.recruiter_id) && <Button size="sm" onClick={() => applyToCollectedJob(job)}>{job.recruiter_id ? "Apply" : <>Apply <ExternalLink className="ml-1 h-3.5 w-3.5" /></>}</Button>}</div></CardContent></Card>
            ))}
            {collectedTotalPages > 1 && <div className="flex items-center justify-center gap-3 pt-2"><Button variant="outline" size="sm" disabled={collectedPage === 1} onClick={() => setCollectedPage((page) => Math.max(1, page - 1))}>Previous</Button><span className="text-sm text-muted-foreground">Page {collectedPage} / {collectedTotalPages}</span><Button variant="outline" size="sm" disabled={collectedPage === collectedTotalPages} onClick={() => setCollectedPage((page) => Math.min(collectedTotalPages, page + 1))}>Next</Button></div>}
          </section>
        )}
        {!loading && collectedJobs.length > 0 && filteredCollected.length === 0 && (
          <Card className="border-dashed border-border/90 bg-card/60 shadow-card">
            <CardContent className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><Filter className="h-5 w-5 text-primary" /></div>
              <h3 className="font-display text-xl font-semibold">No roles match this search</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Your saved collection has {collectedJobs.length} roles. Adjust the filters to bring them back into view.</p>
              <Button className="mt-5 gap-1.5" variant="outline" onClick={clearFilters}><X className="h-3.5 w-3.5" /> Clear filters</Button>
            </CardContent>
          </Card>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : collectedJobs.length > 0 ? null : filtered.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-display text-xl font-semibold">
                {recJobs.length === 0 ? "No jobs discovered yet" : "No jobs match your filters"}
              </h3>
              <p className="text-muted-foreground mt-1">
                {recJobs.length === 0
                  ? "Run a refresh to collect current roles from your connected job sources."
                  : "Try adjusting your filters or search terms."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <p className="text-sm text-muted-foreground">{filtered.length} job{filtered.length !== 1 ? "s" : ""} found</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" /> Sorted by match score
              </div>
            </div>
            {filtered.map((job) => {
              const score = job.match_score || 0;
              const isSaved = savedRecIds.has(job.id);
              const isNew = isNewJob(job.synced_at || job.created_at);
              const portalColor = PORTAL_COLORS[job.source_portal] || "bg-gray-200 text-gray-700";
              return (
                <Card key={job.id} className="shadow-card hover:shadow-card-hover transition-all group">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Match Score Ring */}
                        <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                          score >= 70 ? "bg-green-50 text-green-700 border-green-300" :
                          score >= 50 ? "bg-yellow-50 text-yellow-700 border-yellow-300" :
                          "bg-red-50 text-red-700 border-red-300"
                        }`}>
                          {score}%
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {job.source_url ? (
                              <a href={job.source_url} target="_blank" rel="noopener noreferrer" className="font-display text-lg font-semibold text-foreground group-hover:text-primary transition-colors hover:underline flex items-center gap-1.5">
                                {job.title}
                                <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </a>
                            ) : (
                              <h3 className="font-display text-lg font-semibold text-foreground">{job.title}</h3>
                            )}
                            {isNew && <Badge className="bg-blue-500 text-white animate-pulse text-[10px]">NEW</Badge>}
                            {score >= 80 && <Badge className="bg-green-100 text-green-800 border-green-200">Top Match</Badge>}
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{job.company}</span>
                            {job.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
                            {job.salary && <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{job.salary}</span>}
                            {job.employment_type && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{job.employment_type}</span>}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${portalColor}`}>
                              {job.source_portal}
                            </span>
                            {(job.skills_required || []).slice(0, 5).map(skill => (
                              <Badge key={skill} variant="outline" className="text-xs font-normal">{skill}</Badge>
                            ))}
                          </div>
                          {job.description && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{job.description}</p>
                          )}
                          <MatchExplanation explanation={job.match_explanation} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => toggleSaveRec(job.id)} className={isSaved ? "text-primary" : "text-muted-foreground"}>
                          {isSaved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                        </Button>
                        {job.source_url && (
                          <Button size="sm" className="gradient-primary border-0 gap-1" asChild>
                            <a href={job.source_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" /> Apply
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, MapPin, DollarSign, Bookmark, BookmarkCheck, ExternalLink, Building2, Clock, RefreshCw, Filter, Sparkles, Briefcase, ChevronDown, ChevronUp, ArrowUpRight, X, Copy, Check, LoaderCircle, CheckCircle2, AlertCircle, Square } from "lucide-react";
import type { Database, Tables } from "@/integrations/supabase/types";
import { PORTAL_COLORS } from "@/lib/constants";
import { JOB_ADAPTER_STEPS, isScrapeSessionActive, isVisibleJobMatch, parseAdapterStatuses, runningAdapterPosition, scrapeCompletionMessage, type JobScrapeSession } from "@/lib/job-scrape";

type RecommendedJob = Tables<"recommended_jobs">;
type Job = Tables<"jobs">;
type CollectedJob = Database["public"]["Functions"]["search_scrape_session_jobs"]["Returns"][number];
type CoverLetterJob = Pick<Job, "id" | "title" | "company">;
type MatchExplanationData = {
  skillsMatch?: { matched?: string[] };
  roleMatch?: { matched?: boolean; detail?: string };
  experienceMatch?: { score?: number; detail?: string };
  locationMatch?: { score?: number; detail?: string };
  salaryMatch?: { score?: number; detail?: string };
};
const COLLECTED_PAGE_SIZE = 30;

function isNewJob(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000;
}

function MatchExplanation({ explanation }: { explanation: MatchExplanationData | null }) {
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

export default function JobBoard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recJobs, setRecJobs] = useState<RecommendedJob[]>([]);
  const [collectedJobs, setCollectedJobs] = useState<CollectedJob[]>([]);
  const [collectedTotal, setCollectedTotal] = useState(0);
  const [savedRecIds, setSavedRecIds] = useState<Set<string>>(new Set());
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scrapeSession, setScrapeSession] = useState<JobScrapeSession | null>(null);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [remoteFilter, setRemoteFilter] = useState("all");
  const [includeRemoteLocations, setIncludeRemoteLocations] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [collectedPage, setCollectedPage] = useState(1);
  const [coverLetterJob, setCoverLetterJob] = useState<CoverLetterJob | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [generatingCoverLetterFor, setGeneratingCoverLetterFor] = useState<string | null>(null);
  const [copiedCoverLetter, setCopiedCoverLetter] = useState(false);
  const scrapeLockRef = useRef(false);
  const startingSessionRef = useRef(false);
  const previousSessionIdRef = useRef<string | null>(null);
  const hydratedSessionRef = useRef<string | null>(null);
  const announcedSessionRef = useRef<string | null>(null);

  const fetchCollectedJobs = useCallback(async (page: number, sessionId?: string | null, silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    const pageStart = (page - 1) * COLLECTED_PAGE_SIZE;
    const terms = [...new Set(search.trim()
      .replace(/[^a-zA-Z0-9 .+#-]/g, " ")
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length >= 2))].slice(0, 8);
    const rpcParams = {
      p_session_id: sessionId || null,
      p_terms: terms,
      p_source: sourceFilter === "all" ? null : sourceFilter,
      p_location: locationFilter.trim() || null,
      p_job_type: jobTypeFilter === "all" ? null : jobTypeFilter,
      p_work_mode: remoteFilter === "all" ? null : remoteFilter,
      p_include_remote: includeRemoteLocations && Boolean(locationFilter.trim()),
      p_limit: COLLECTED_PAGE_SIZE,
      p_offset: pageStart,
    };
    let { data, error } = await supabase.rpc("search_scrape_session_jobs", rpcParams);
    // Allow the page to work while a hosted project is still applying the
    // migration that adds the remote-location argument.
    if (error && /p_include_remote|search_scrape_session_jobs/i.test(error.message)) {
      const { p_include_remote: _ignored, ...legacyParams } = rpcParams;
      ({ data, error } = await supabase.rpc("search_scrape_session_jobs", legacyParams));
    }

    if (error) {
      if (!silent) toast({ title: "Could not load jobs", description: error.message || "Your matching jobs could not be loaded. Please try again.", variant: "destructive" });
    } else {
      const visibleJobs = (data || []).filter((job) => isVisibleJobMatch(job.match_score) && Boolean(job.recruiter_id || job.source_url));
      setCollectedJobs(visibleJobs);
      setCollectedTotal(Number(data?.[0]?.total_count || 0));
    }
    if (!silent) setLoading(false);
  }, [includeRemoteLocations, jobTypeFilter, locationFilter, remoteFilter, search, sourceFilter, toast, user]);

  const fetchLatestSession = useCallback(async (hydrateInputs = false): Promise<JobScrapeSession | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("job_scrape_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[browse-jobs] scrape session load failed", error.message);
      return null;
    }
    const session = data as JobScrapeSession | null;
    setScrapeSession(session);
    const active = isScrapeSessionActive(session);
    // Keep the optimistic click lock while the Edge Function is still creating
    // the new row; otherwise a fast poll could see the previous completed row
    // and briefly permit a duplicate click.
    if (active || !startingSessionRef.current) {
      setScraping(active);
      scrapeLockRef.current = active;
    }
    if (hydrateInputs && session && hydratedSessionRef.current !== session.id) {
      hydratedSessionRef.current = session.id;
      setSearch(session.search_query);
      setLocationFilter(session.location || "");
    }
    return session;
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const fetchProfileData = async () => {
      const { data: recommended } = await supabase
        .from("recommended_jobs")
        .select("*")
        .eq("user_id", user.id)
        .order("match_score", { ascending: false });
      if (recommended) setRecJobs(recommended);

      const { data: saved } = await supabase
        .from("saved_jobs")
        .select("recommended_job_id")
        .eq("user_id", user.id)
        .not("recommended_job_id", "is", null);
      if (saved) setSavedRecIds(new Set(saved.map(s => s.recommended_job_id!).filter(Boolean)));
      const { data: savedRegular } = await supabase.from("saved_jobs").select("job_id").eq("user_id", user.id).not("job_id", "is", null);
      if (savedRegular) setSavedJobIds(new Set(savedRegular.map(s => s.job_id!).filter(Boolean)));
    };
    fetchProfileData();

    // Preserve the existing recommended-jobs live refresh.
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
        () => { void fetchProfileData(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void fetchLatestSession(true);
  }, [fetchLatestSession, user]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => void fetchCollectedJobs(collectedPage, scrapeSession?.id), 250);
    return () => window.clearTimeout(timer);
  }, [collectedPage, fetchCollectedJobs, scrapeSession?.id, user]);

  useEffect(() => {
    if (!user || !scraping) return;
    let disposed = false;
    const refreshProgress = async () => {
      const latest = await fetchLatestSession(false);
      if (disposed || !latest) return;
      if (startingSessionRef.current && latest.id === previousSessionIdRef.current) return;
      startingSessionRef.current = false;
      await fetchCollectedJobs(1, latest.id, true);
      if (!isScrapeSessionActive(latest)) {
        scrapeLockRef.current = false;
        setScraping(false);
        setCollectedPage(1);
        const announcementKey = `${latest.id}:${latest.session_status}`;
        if (announcedSessionRef.current !== announcementKey) {
          announcedSessionRef.current = announcementKey;
          toast({
            title: latest.session_status === "completed" ? "Job scraping complete" : "Job scraping finished",
            description: scrapeCompletionMessage(latest),
            variant: latest.session_status === "failed" ? "destructive" : "default",
          });
        }
      }
    };
    void refreshProgress();
    const timer = window.setInterval(() => void refreshProgress(), 1_250);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [fetchCollectedJobs, fetchLatestSession, scraping, toast, user]);

  const handleScrapeJobs = async () => {
    if (scrapeLockRef.current) return;
    if (!search.trim()) {
      toast({ title: "Add a skill or keyword", description: "Enter the role, skill, or keyword you want JobAI Scout to find.", variant: "destructive" });
      return;
    }
    previousSessionIdRef.current = scrapeSession?.id || null;
    startingSessionRef.current = true;
    scrapeLockRef.current = true;
    setScraping(true);
    try {
      const query = search.trim();
      const { data, error } = await supabase.functions.invoke("collect-jobs", {
        body: {
          query,
          location: locationFilter.trim() || null,
          jobType: jobTypeFilter,
          workMode: remoteFilter,
          maxItems: 25,
        },
      });
      if (error) {
        const response = (error as { context?: Response }).context;
        const details = response ? await response.clone().json().catch(() => null) : null;
        if (details?.session) {
          startingSessionRef.current = false;
          setScrapeSession(details.session as JobScrapeSession);
          setScraping(isScrapeSessionActive(details.session));
          scrapeLockRef.current = isScrapeSessionActive(details.session);
          return;
        }
        throw new Error(details?.error || error.message || "Could not start job scraping");
      }
      const session = data?.session as JobScrapeSession | undefined;
      startingSessionRef.current = false;
      if (session) setScrapeSession(session);
      setCollectedPage(1);
      await fetchCollectedJobs(1, session?.id, true);
      const active = isScrapeSessionActive(session);
      setScraping(active);
      scrapeLockRef.current = active;
      if (session && !active) {
        announcedSessionRef.current = `${session.id}:${session.session_status}`;
        toast({ title: session.session_status === "completed" ? "Job scraping complete" : "Job scraping finished", description: scrapeCompletionMessage(session), variant: session.session_status === "failed" ? "destructive" : "default" });
      }
    } catch (error: unknown) {
      // The browser request may be interrupted while the server-side session is
      // still running. Reconcile with the database before presenting a failure.
      const latest = await fetchLatestSession(false);
      if (isScrapeSessionActive(latest)) {
        startingSessionRef.current = false;
        toast({ title: "Scraping is still running", description: "The connection was interrupted, but JobAI Scout is continuing the active session." });
        return;
      }
      scrapeLockRef.current = false;
      startingSessionRef.current = false;
      setScraping(false);
      toast({ title: "Could not start scraping", description: error instanceof Error ? error.message : "Please check your connection and try again.", variant: "destructive" });
    }
  };

  const handleStopScraping = async () => {
    if (!user || !scrapeSession?.id) {
      toast({ title: "Still preparing the scrape", description: "The stop control will be available as soon as the session is registered." });
      return;
    }
    const { error } = await supabase.from("job_scrape_sessions").update({
      session_status: "stopped",
      current_adapter: null,
      completed_at: new Date().toISOString(),
    }).eq("id", scrapeSession.id).eq("user_id", user.id).in("session_status", ["pending", "running"]);
    if (error) {
      toast({ title: "Could not stop scraping", description: error.message, variant: "destructive" });
      return;
    }
    setScraping(false);
    scrapeLockRef.current = false;
    startingSessionRef.current = false;
    toast({ title: "Scraping stopped", description: "Jobs already collected were kept and remain available below." });
    await fetchCollectedJobs(1, scrapeSession.id, true);
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

  const applyToCollectedJob = async (job: CollectedJob) => {
    if (!user) return;
    if (job.recruiter_id) {
      const { error } = await supabase.from("job_applications").insert({ user_id: user.id, job_id: job.id });
      if (error && !error.message.toLowerCase().includes("duplicate")) return toast({ title: "Application failed", description: error.message, variant: "destructive" });
      toast({ title: "Application submitted" });
      return;
    }
    if (job.source_url) {
      window.open(job.source_url, "_blank", "noopener,noreferrer");
      return;
    }
    toast({ title: "Application link unavailable", description: "This source did not supply a direct application link for this role.", variant: "destructive" });
  };

  const tailorCoverLetter = async (job: CoverLetterJob) => {
    if (!user || generatingCoverLetterFor) return;

    setCoverLetterJob(job);
    setCoverLetter("");
    setCopiedCoverLetter(false);
    setGeneratingCoverLetterFor(job.id);

    try {
      // The edge function uses the signed-in session to read the user's private
      // profile. The client supplies only the selected, stored job identifier.
      const { data, error } = await supabase.functions.invoke("generate-cover-letter", {
        body: { jobId: job.id },
      });
      if (error) {
        const response = (error as { context?: Response }).context;
        const details = response ? await response.clone().json().catch(() => null) : null;
        throw new Error(details?.error || error.message || "Could not tailor your cover letter.");
      }
      if (!data?.coverLetter) throw new Error("The AI did not return a cover letter. Please try again.");
      setCoverLetter(data.coverLetter);
    } catch (err: unknown) {
      setCoverLetterJob(null);
      const description = err instanceof Error ? err.message : "Please check your profile and try again.";
      toast({ title: "Could not tailor the letter", description, variant: "destructive" });
    } finally {
      setGeneratingCoverLetterFor(null);
    }
  };

  const copyCoverLetter = async () => {
    if (!coverLetter) return;
    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopiedCoverLetter(true);
      window.setTimeout(() => setCopiedCoverLetter(false), 1800);
    } catch {
      toast({ title: "Copy was blocked", description: "Select the letter and copy it manually.", variant: "destructive" });
    }
  };

  const collectedTotalPages = Math.max(1, Math.ceil(collectedTotal / COLLECTED_PAGE_SIZE));
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
      // The Browse Jobs experience has one recommendation quality floor for
      // both newly scraped and existing recommended records.
      if (!isVisibleJobMatch(j.match_score)) return false;
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
  const sourceOptions = useMemo(() => [
    { value: "linkedin_apify", label: "LinkedIn" },
    { value: "indeed_apify", label: "Indeed" },
    { value: "rss", label: "RSS feeds" },
    { value: "company_career", label: "Company careers" },
    ...uniquePortals.filter((source) => !["linkedin_apify", "indeed_apify", "rss", "company_career"].includes(String(source))).map((source) => ({ value: String(source), label: sourceLabel(source) })),
  ], [uniquePortals]);
  const adapterStatuses = useMemo(
    () => parseAdapterStatuses(scraping && !isScrapeSessionActive(scrapeSession) ? null : scrapeSession?.adapter_statuses),
    [scrapeSession, scraping],
  );
  const activeAdapterPosition = runningAdapterPosition(scrapeSession);
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
                {JOB_ADAPTER_STEPS.map((adapter) => {
                  const status = adapterStatuses[adapter.key];
                  const stateClasses = status === "running"
                    ? "border-blue-700 bg-blue-950 text-blue-50"
                    : status === "completed"
                      ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300"
                      : status === "failed"
                        ? "border-red-500/60 bg-red-500/20 text-red-300"
                        : "border-sky-300/70 bg-sky-400 text-sky-950";
                  const StatusIcon = status === "running" ? LoaderCircle : status === "completed" ? CheckCircle2 : status === "failed" ? AlertCircle : Clock;
                  return (
                    <Button
                      key={adapter.key}
                      type="button"
                      size="sm"
                      disabled
                      aria-label={`${adapter.label}: ${status}`}
                      title={`${adapter.label}: ${status}`}
                      className={`h-8 gap-1.5 px-3 text-xs capitalize disabled:pointer-events-none disabled:opacity-100 ${stateClasses}`}
                    >
                      <StatusIcon className={`h-3.5 w-3.5 ${status === "running" ? "animate-spin" : ""}`} />
                      {adapter.label}: {status}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
              <Button onClick={scraping ? handleStopScraping : handleScrapeJobs} disabled={!scraping && !search.trim()} className={`min-w-48 gap-2 border-0 shadow-lg ${scraping ? "bg-rose-600 hover:bg-rose-500 shadow-rose-500/20" : "gradient-primary shadow-primary/20"}`}>
                {scraping ? <Square className="h-4 w-4 fill-current" /> : <RefreshCw className="h-4 w-4" />}
                {scraping ? "Stop Scraping" : "Scrape Jobs"}
              </Button>
              <p className="max-w-56 text-right text-xs text-muted-foreground">One click checks all four sources in order. Location is optional.</p>
              <p className="text-xs text-muted-foreground">{collectedTotal} matching roles in this session</p>
            </div>
          </div>
        </section>

        <Card className="border-border/80 bg-card/90 shadow-card">
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-required="true" aria-label="Skill, job title, or keyword" placeholder="Skill, job title, or keyword (required)" value={search} disabled={scraping} onChange={(e) => setSearch(e.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && search.trim() && !scraping) void handleScrapeJobs(); }} className="h-11 border-border/80 bg-background/60 pl-11" />
              </div>
              <div className="relative lg:w-64">
                <MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label="Preferred job location" placeholder="City, country, or remote (optional)" value={locationFilter} disabled={scraping} onChange={(e) => setLocationFilter(e.target.value)} className="h-11 border-border/80 bg-background/60 pl-11" />
              </div>
              <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="h-11 gap-2 border-border/80 bg-background/40">
                <Filter className="h-4 w-4" /> {showFilters ? "Hide filters" : "Filters"}
                {hasActiveFilters && <span className="h-2 w-2 rounded-full bg-primary" />}
              </Button>
            </div>
            {showFilters && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/70 pt-4">
                <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}><SelectTrigger className="w-[155px] bg-background/60"><SelectValue placeholder="Job type" /></SelectTrigger><SelectContent><SelectItem value="all">Any job type</SelectItem><SelectItem value="full-time">Full-time</SelectItem><SelectItem value="part-time">Part-time</SelectItem><SelectItem value="contract">Contract</SelectItem><SelectItem value="internship">Internship</SelectItem></SelectContent></Select>
                <Select value={sourceFilter} onValueChange={setSourceFilter}><SelectTrigger className="w-[170px] bg-background/60"><SelectValue placeholder="Source" /></SelectTrigger><SelectContent><SelectItem value="all">Every source</SelectItem>{sourceOptions.map((source) => <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>)}</SelectContent></Select>
                <Select value={remoteFilter} onValueChange={setRemoteFilter}><SelectTrigger className="w-[155px] bg-background/60"><SelectValue placeholder="Work mode" /></SelectTrigger><SelectContent><SelectItem value="all">Any work mode</SelectItem><SelectItem value="remote">Remote</SelectItem><SelectItem value="hybrid">Hybrid</SelectItem></SelectContent></Select>
                <label className="flex h-10 items-center gap-2 rounded-md border border-border/70 bg-background/60 px-3 text-sm text-muted-foreground">
                  <Checkbox checked={includeRemoteLocations} onCheckedChange={(checked) => setIncludeRemoteLocations(checked === true)} />
                  Include remote / Pakistan-wide
                </label>
                {hasActiveFilters && <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clearFilters}><X className="h-3.5 w-3.5" /> Clear filters</Button>}
              </div>
            )}
            {scrapeSession && (
              <div className="mt-4 rounded-2xl border border-border/70 bg-background/45 p-4" role="status" aria-live="polite">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {isScrapeSessionActive(scrapeSession) && activeAdapterPosition
                        ? `Running adapter ${activeAdapterPosition} of ${JOB_ADAPTER_STEPS.length}`
                        : scrapeCompletionMessage(scrapeSession)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Search: {scrapeSession.search_query}{scrapeSession.location ? ` in ${scrapeSession.location}` : " in any location"}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[300px]">
                    <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2"><p className="text-base font-bold">{scrapeSession.total_jobs_scraped}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Scraped</p></div>
                    <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2"><p className="text-base font-bold">{scrapeSession.total_jobs_saved}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Saved</p></div>
                    <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2"><p className="text-base font-bold text-emerald-400">{scrapeSession.total_jobs_displayed}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Shown</p></div>
                  </div>
                </div>
                {(() => {
                  const summary = scrapeSession.exclusion_summary as Record<string, number> | null;
                  if (!summary) return null;
                  const details = [
                    [summary.optional_filters, "job-type/work-mode"],
                    [summary.invalid_or_duplicate, "invalid or duplicate"],
                    [summary.career_level, "career level"],
                    [summary.below_match_score, "below 40% match"],
                  ].filter(([count]) => Number(count) > 0);
                  return details.length ? <p className="mt-3 text-xs text-muted-foreground">Excluded: {details.map(([count, label]) => `${count} ${label}`).join(" · ")}. Remote/Pakistan-wide roles are {includeRemoteLocations ? "included" : "excluded"} for this location search.</p> : null;
                })()}
                {(() => {
                  const errors = scrapeSession.adapter_errors as Record<string, string[]> | null;
                  const messages = Object.entries(errors || {}).flatMap(([adapter, entries]) => entries.map((message) => `${adapter.replace(/_/g, " ")}: ${message}`));
                  return messages.length ? <p className="mt-2 text-xs text-amber-300">Source details: {messages.join(" · ")}</p> : null;
                })()}
              </div>
            )}
          </CardContent>
        </Card>
        {collectedJobs.length > 0 && (
          <section className="space-y-3">
            <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-xl font-semibold">Open roles</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{collectedTotal} matching role{collectedTotal !== 1 ? "s" : ""} · Page {collectedPage} of {collectedTotalPages}</p>
              </div>
              <Badge variant="secondary" className="w-fit border border-border/70 bg-muted/50 font-normal">Updated from live sources</Badge>
            </div>
            {collectedJobs.map((job) => (
              <Card key={`modern-${job.id}`} className="group overflow-hidden border-border/80 bg-card shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-card-hover">
                <CardContent className="p-0">
                  <div className="flex gap-4 p-5 md:gap-5 md:p-6">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-display text-base font-bold text-primary">{(job.company || "J").charAt(0).toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">{sourceLabel(job.source)}</Badge>
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">Match {Math.round(Number(job.match_score || 0))}%</Badge>
                        {isNewJob(job.posted_at || job.created_at) && <Badge className="bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 hover:bg-emerald-500/15">New</Badge>}
                      </div>
                      <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-primary md:text-xl">{job.title}</h3>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5 font-medium text-foreground/85"><Building2 className="h-3.5 w-3.5 text-primary/70" />{job.company || "Company not listed"}</span>
                        {job.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
                        {job.job_type && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{job.job_type}</span>}
                        {(job.salary_min || job.salary_max) && <span className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" />{job.salary_currency ? `${job.salary_currency} ` : ""}{job.salary_min ? Number(job.salary_min).toLocaleString() : ""}{job.salary_min && job.salary_max ? " - " : ""}{job.salary_max ? Number(job.salary_max).toLocaleString() : ""}</span>}
                      </div>
                      {job.description && <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground line-clamp-2">{job.description}</p>}
                      <MatchExplanation explanation={job.match_explanation as MatchExplanationData | null} />
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {(job.skills || []).slice(0, 4).map((skill: string) => <Badge key={skill} variant="secondary" className="bg-muted/65 px-2 py-0.5 text-xs font-normal">{skill}</Badge>)}
                        <span className="ml-auto text-xs text-muted-foreground">{relativeDate(job.posted_at || job.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Button variant="ghost" size="icon" aria-label={savedJobIds.has(job.id) ? "Remove from saved jobs" : "Save job"} onClick={() => toggleSaveJob(job.id)} className={savedJobIds.has(job.id) ? "text-primary" : "text-muted-foreground"}>{savedJobIds.has(job.id) ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}</Button>
                      <Button variant="outline" size="sm" onClick={() => void tailorCoverLetter(job)} disabled={Boolean(generatingCoverLetterFor)} className="hidden gap-1.5 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 sm:inline-flex">
                        {generatingCoverLetterFor === job.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {generatingCoverLetterFor === job.id ? "Tailoring..." : "Tailor letter"}
                      </Button>
                      <Button size="sm" onClick={() => applyToCollectedJob(job)} className="hidden gap-1.5 sm:inline-flex">Apply<ArrowUpRight className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-border/60 px-5 py-3 sm:hidden">
                    <Button variant="outline" size="sm" onClick={() => void tailorCoverLetter(job)} disabled={Boolean(generatingCoverLetterFor)} className="gap-1.5 border-primary/30 bg-primary/5 text-primary">
                      {generatingCoverLetterFor === job.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Tailor letter
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={() => applyToCollectedJob(job)}>Apply<ArrowUpRight className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {collectedTotalPages > 1 && <div className="flex items-center justify-center gap-3 pt-3"><Button variant="outline" size="sm" disabled={collectedPage === 1} onClick={() => setCollectedPage((page) => Math.max(1, page - 1))}>Previous</Button><span className="text-sm text-muted-foreground">{collectedPage} / {collectedTotalPages}</span><Button variant="outline" size="sm" disabled={collectedPage === collectedTotalPages} onClick={() => setCollectedPage((page) => Math.min(collectedTotalPages, page + 1))}>Next</Button></div>}
          </section>
        )}

        {!loading && collectedJobs.length === 0 && collectedTotal === 0 && hasActiveFilters && (
          <Card className="border-dashed border-border/90 bg-card/60 shadow-card">
            <CardContent className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><Filter className="h-5 w-5 text-primary" /></div>
              <h3 className="font-display text-xl font-semibold">No roles match this search</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Only roles with a 50% or higher match and a suitable career level are shown. Try a broader keyword, remove a filter, or run a new scrape.</p>
              <Button className="mt-5 gap-1.5" variant="outline" onClick={clearFilters}><X className="h-3.5 w-3.5" /> Clear filters</Button>
            </CardContent>
          </Card>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : collectedTotal > 0 ? null : filtered.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-display text-xl font-semibold">
                {recJobs.length === 0 ? "No jobs discovered yet" : "No jobs match your filters"}
              </h3>
              <p className="text-muted-foreground mt-1">
                {recJobs.length === 0
                  ? "Enter a skill or keyword, then use Scrape Jobs to check all connected sources."
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
                          <MatchExplanation explanation={job.match_explanation as MatchExplanationData | null} />
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
      <Dialog open={Boolean(coverLetterJob)} onOpenChange={(open) => { if (!open && !generatingCoverLetterFor) setCoverLetterJob(null); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-primary/20 bg-card p-5 sm:p-6">
          <DialogHeader>
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></div>
            <DialogTitle className="font-display text-xl">Tailored cover letter</DialogTitle>
            <DialogDescription>
              {coverLetterJob ? `Written from your profile for ${coverLetterJob.title} at ${coverLetterJob.company || "this company"}. Review and edit it before applying.` : ""}
            </DialogDescription>
          </DialogHeader>
          {generatingCoverLetterFor ? (
            <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-primary/25 bg-primary/5 px-5 text-center">
              <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
              <div><p className="font-medium">Reading the role and your profile</p><p className="mt-1 text-sm text-muted-foreground">Creating a specific, truthful letter…</p></div>
            </div>
          ) : (
            <Textarea aria-label="Tailored cover letter" value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} rows={13} className="resize-y border-white/15 bg-black text-white leading-7 placeholder:text-white/45 focus-visible:ring-primary" />
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setCoverLetterJob(null)} disabled={Boolean(generatingCoverLetterFor)}>Close</Button>
            <Button type="button" variant="outline" onClick={() => coverLetterJob && void tailorCoverLetter(coverLetterJob)} disabled={Boolean(generatingCoverLetterFor)} className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Regenerate</Button>
            <Button type="button" onClick={() => void copyCoverLetter()} disabled={!coverLetter || Boolean(generatingCoverLetterFor)} className="gap-1.5 gradient-primary border-0">
              {copiedCoverLetter ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copiedCoverLetter ? "Copied" : "Copy letter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

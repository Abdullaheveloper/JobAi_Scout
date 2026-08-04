import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, MapPin, DollarSign, Bookmark, BookmarkCheck, ExternalLink, Building2, Clock, RefreshCw, Filter, Sparkles, Briefcase, ChevronDown, ChevronUp, ArrowUpRight, X, Copy, Check, LoaderCircle, CheckCircle2, AlertCircle, Square } from "lucide-react";
import type { Database, Tables } from "@/integrations/supabase/types";
import { JOB_ADAPTER_STEPS, hasSuccessfulScrapeResults, isScrapeSessionActive, isVisibleJobMatch, parseAdapterStatuses, runningAdapterPosition, scrapeCompletionMessage, type JobAdapterKey, type JobScrapeSession } from "@/lib/job-scrape";
import { plainJobDescription } from "@/lib/job-description";
import { FuzzyAutocompleteInput, jobTaxonomy, locationTaxonomy } from "@/lib/fuzzy-taxonomy";
import { useTranslation } from "react-i18next";
import { MixedDir } from "@/components/MixedDir";
import { isUsageLimitError } from "@/lib/usage-limits-client";
import { useMatchPreferencesGate } from "@/hooks/useMatchPreferencesGate";
import { useUsageLimitGate } from "@/hooks/useUsageLimitGate";
import { setVisibleJobId } from "@/lib/assistant/screen-context";

type RecommendedJob = Tables<"recommended_jobs">;
type Job = Tables<"jobs">;
type CollectedJob = Database["public"]["Functions"]["search_scrape_session_jobs"]["Returns"][number];
type CoverLetterJob = Pick<Job, "id" | "title" | "company">;
type JobInteraction = {
  job_id: string | null;
  recommended_job_id: string | null;
  first_viewed_at: string | null;
  opened_at: string | null;
  first_saved_at: string | null;
  applied_at: string | null;
};
type MatchExplanationData = {
  skillsMatch?: { matched?: string[] };
  roleMatch?: { matched?: boolean; detail?: string };
  experienceMatch?: { score?: number; detail?: string };
  locationMatch?: { score?: number; detail?: string };
  salaryMatch?: { score?: number; detail?: string };
};
const COLLECTED_PAGE_SIZE = 30;

function MatchExplanation({ explanation }: { explanation: MatchExplanationData | null }) {
  const { t } = useTranslation();
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
        {t("jobs.whyMatches")}
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
  const { t } = useTranslation();
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { gateOverlay, minMatchThreshold } = useMatchPreferencesGate();
  const { showUsageLimit, usageLimitNotice } = useUsageLimitGate();
  const [recJobs, setRecJobs] = useState<RecommendedJob[]>([]);
  const [collectedJobs, setCollectedJobs] = useState<CollectedJob[]>([]);
  const [collectedTotal, setCollectedTotal] = useState(0);
  const [savedRecIds, setSavedRecIds] = useState<Set<string>>(new Set());
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [jobInteractions, setJobInteractions] = useState<Map<string, JobInteraction>>(new Map());
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scrapeSession, setScrapeSession] = useState<JobScrapeSession | null>(null);
  const [search, setSearch] = useState("");
  const [titleFilter, setTitleFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [experienceFilter, setExperienceFilter] = useState("all");
  const [salaryMinFilter, setSalaryMinFilter] = useState("");
  const [salaryMaxFilter, setSalaryMaxFilter] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("all");
  const [postedDateFilter, setPostedDateFilter] = useState("all");
  const [selectedMinScore, setSelectedMinScore] = useState(minMatchThreshold);
  const [scoreFilter, setScoreFilter] = useState("all");
  const [remoteFilter, setRemoteFilter] = useState("all");
  const [includeRemoteLocations, setIncludeRemoteLocations] = useState(true);
  const [selectedAdapters, setSelectedAdapters] = useState<Set<JobAdapterKey>>(() => new Set(JOB_ADAPTER_STEPS.map((adapter) => adapter.key)));
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

  useEffect(() => setSelectedMinScore(minMatchThreshold), [minMatchThreshold]);
  useEffect(() => {
    if (!user || selectedMinScore === minMatchThreshold) return;
    const timer = window.setTimeout(async () => {
      const { error } = await supabase.from("profiles").update({ min_match_threshold: selectedMinScore }).eq("user_id", user.id);
      if (!error) await refreshProfile();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [minMatchThreshold, refreshProfile, selectedMinScore, user]);

  useEffect(() => () => setVisibleJobId(null), []);

  const markJobInteraction = useCallback(async (jobId: string, action: "viewed" | "opened" | "applied", recommended = false) => {
    if (!user) return;
    const now = new Date().toISOString();
    const key = `${recommended ? "recommended" : "job"}:${jobId}`;
    setJobInteractions((previous) => {
      const next = new Map(previous);
      const current = next.get(key) || { job_id: recommended ? null : jobId, recommended_job_id: recommended ? jobId : null, first_viewed_at: null, opened_at: null, first_saved_at: null, applied_at: null };
      next.set(key, { ...current, first_viewed_at: current.first_viewed_at || now, opened_at: action !== "viewed" ? current.opened_at || now : current.opened_at, applied_at: action === "applied" ? current.applied_at || now : current.applied_at });
      return next;
    });
    const callRpc = supabase.rpc as unknown as (name: string, params: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    const { error } = await callRpc("mark_job_interaction", { p_job_id: jobId, p_action: action, p_recommended: recommended });
    if (error) console.error("[jobs] interaction tracking failed", error.message);
  }, [user]);

  const fetchCollectedJobs = useCallback(async (page: number, requestedSessionId?: string | null, silent = false) => {
    if (!user) {
      if (!silent) {
        setCollectedJobs([]);
        setCollectedTotal(0);
        setLoading(false);
      }
      return;
    }
    // While a new scrape session is being created there is deliberately no
    // database fallback. Scraper mode must contain only this session's jobs.
    const activeSessionId = requestedSessionId || scrapeSession?.id || null;
    if (scraping && !activeSessionId) {
      setCollectedJobs([]);
      setCollectedTotal(0);
      if (!silent) setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    const pageStart = (page - 1) * COLLECTED_PAGE_SIZE;
    const unifiedParams = {
      p_query: search.trim() || null,
      p_title: titleFilter.trim() || null,
      p_company: companyFilter.trim() || null,
      p_location: locationFilter.trim() || null,
      p_job_type: jobTypeFilter === "all" ? null : jobTypeFilter,
      p_experience_level: experienceFilter === "all" ? null : experienceFilter,
      p_salary_min: salaryMinFilter ? Number(salaryMinFilter) : null,
      p_salary_max: salaryMaxFilter ? Number(salaryMaxFilter) : null,
      p_work_mode: remoteFilter === "all" ? null : remoteFilter,
      p_source_type: sourceTypeFilter === "all" ? null : sourceTypeFilter,
      p_posted_days: postedDateFilter === "all" ? null : Number(postedDateFilter),
      p_min_match_score: selectedMinScore,
      p_limit: COLLECTED_PAGE_SIZE,
      p_offset: pageStart,
    };
    const sessionParams = {
      p_session_id: activeSessionId,
      p_terms: search.trim().toLowerCase().split(/\s+/).filter((term) => term.length >= 2).slice(0, 8),
      p_source: null,
      p_location: locationFilter.trim() || null,
      p_job_type: jobTypeFilter === "all" ? null : jobTypeFilter,
      p_work_mode: remoteFilter === "all" ? null : remoteFilter,
      p_include_remote: includeRemoteLocations && Boolean(locationFilter.trim()),
      p_min_match_score: selectedMinScore,
      p_limit: COLLECTED_PAGE_SIZE,
      p_offset: pageStart,
    };
    const rpcName = scraping && activeSessionId ? "search_scrape_session_jobs" : "search_jobs_unified";
    const rpcParams = rpcName === "search_scrape_session_jobs" ? sessionParams : unifiedParams;
    const { data, error } = await (supabase.rpc as unknown as (
      name: string,
      params: Record<string, unknown>,
    ) => Promise<{ data: CollectedJob[] | null; error: { message: string } | null }>)(rpcName, rpcParams);

    if (error) {
      if (!silent) toast({ title: t("jobs.toastLoadFailed"), description: error.message || t("jobs.toastLoadFailedBody"), variant: "destructive" });
    } else {
      setCollectedJobs(data || []);
      setCollectedTotal(Number(data?.[0]?.total_count || 0));
    }
    if (!silent) setLoading(false);
  }, [companyFilter, experienceFilter, includeRemoteLocations, jobTypeFilter, locationFilter, postedDateFilter, remoteFilter, salaryMaxFilter, salaryMinFilter, scrapeSession?.id, scraping, search, selectedMinScore, sourceTypeFilter, titleFilter, toast, user]);

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
      const { data: interactions } = await supabase
        .from("job_user_interactions")
        .select("job_id,recommended_job_id,first_viewed_at,opened_at,first_saved_at,applied_at")
        .eq("user_id", user.id);
      if (interactions) {
        const rows = interactions as unknown as JobInteraction[];
        setJobInteractions(new Map(rows.map((row) => [row.job_id ? `job:${row.job_id}` : `recommended:${row.recommended_job_id}`, row])));
      }
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
    void fetchLatestSession(false);
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
      toast({ title: t("jobs.toastAddKeywordTitle"), description: t("jobs.toastAddKeywordBody"), variant: "destructive" });
      return;
    }
    previousSessionIdRef.current = scrapeSession?.id || null;
    startingSessionRef.current = true;
    scrapeLockRef.current = true;
    setScraping(true);
    setScrapeSession(null);
    setCollectedJobs([]);
    setCollectedTotal(0);
    try {
      const query = search.trim();
      const { data, error } = await supabase.functions.invoke("collect-jobs", {
        body: {
          query,
          location: locationFilter.trim() || null,
          jobType: jobTypeFilter,
          workMode: remoteFilter,
          maxItems: 25,
          adapters: [...selectedAdapters],
        },
      });
      if (error) {
        const response = (error as { context?: Response }).context;
        const details = response ? await response.clone().json().catch(() => null) : null;
        if (isUsageLimitError(details) || isUsageLimitError(data)) {
          showUsageLimit((details || data) as Parameters<typeof showUsageLimit>[0], { variant: "banner" });
          throw new Error((details as { error?: string })?.error || "Usage limit reached");
        }
        if (details?.session) {
          startingSessionRef.current = false;
          setScrapeSession(details.session as JobScrapeSession);
          setScraping(isScrapeSessionActive(details.session));
          scrapeLockRef.current = isScrapeSessionActive(details.session);
          return;
        }
        throw new Error(details?.error || error.message || "Could not start job scraping");
      }
      if (isUsageLimitError(data)) {
        showUsageLimit(data, { variant: "banner" });
        throw new Error(data.error || "Usage limit reached");
      }
      const session = data?.session as JobScrapeSession | undefined;
      startingSessionRef.current = false;
      if (session) setScrapeSession(session);
      setCollectedPage(1);
      const active = isScrapeSessionActive(session);
      setScraping(active);
      scrapeLockRef.current = active;
      if (session && !active) {
        announcedSessionRef.current = `${session.id}:${session.session_status}`;
        toast({ title: session.session_status === "completed" ? t("jobs.toastScrapeComplete") : t("jobs.toastScrapeFinished"), description: scrapeCompletionMessage(session), variant: session.session_status === "failed" ? "destructive" : "default" });
      }
    } catch (error: unknown) {
      // The browser request may be interrupted while the server-side session is
      // still running. Reconcile with the database before presenting a failure.
      const latest = await fetchLatestSession(false);
      if (isScrapeSessionActive(latest)) {
        startingSessionRef.current = false;
        toast({ title: t("jobs.toastScrapeStillRunningTitle"), description: t("jobs.toastScrapeStillRunningBody") });
        return;
      }
      scrapeLockRef.current = false;
      startingSessionRef.current = false;
      setScraping(false);
      if (/usage limit|disabled for your account/i.test(error instanceof Error ? error.message : "")) {
        return;
      }
      toast({ title: t("jobs.toastScrapeStartFailedTitle"), description: error instanceof Error ? error.message : t("jobs.toastScrapeStartFailedBody"), variant: "destructive" });
    }
  };

  const handleStopScraping = async () => {
    if (!user || !scrapeSession?.id) {
      toast({ title: t("jobs.toastScrapePreparingTitle"), description: t("jobs.toastScrapePreparingBody") });
      return;
    }
    const stoppedStatuses = parseAdapterStatuses(scrapeSession.adapter_statuses);
    for (const adapter of JOB_ADAPTER_STEPS) {
      if (stoppedStatuses[adapter.key] === "running" || stoppedStatuses[adapter.key] === "waiting") {
        stoppedStatuses[adapter.key] = "stopped";
      }
    }
    const stoppedAt = new Date().toISOString();
    setScrapeSession((current) => current ? {
      ...current,
      adapter_statuses: stoppedStatuses,
      session_status: "stopped",
      current_adapter: null,
      completed_at: stoppedAt,
    } : current);
    setScraping(false);
    scrapeLockRef.current = false;
    startingSessionRef.current = false;

    const { error } = await supabase.from("job_scrape_sessions").update({
      session_status: "stopped",
      current_adapter: null,
      completed_at: stoppedAt,
      adapter_statuses: stoppedStatuses,
    }).eq("id", scrapeSession.id).eq("user_id", user.id).in("session_status", ["pending", "running"]);
    if (error) {
      toast({ title: t("jobs.toastScrapeStopFailed"), description: error.message, variant: "destructive" });
      await fetchLatestSession(false);
      return;
    }
    toast({ title: t("jobs.toastScrapeStoppedTitle"), description: t("jobs.toastScrapeStoppedBody") });
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
      void markJobInteraction(jobId, "viewed");
    }
  };

  const applyToCollectedJob = async (job: CollectedJob) => {
    if (!user) return;
    if (job.recruiter_id) {
      const { error } = await supabase.from("job_applications").insert({ user_id: user.id, job_id: job.id });
      if (error && !error.message.toLowerCase().includes("duplicate")) return toast({ title: t("jobs.toastApplyFailed"), description: error.message, variant: "destructive" });
      const now = new Date().toISOString();
      setJobInteractions((previous) => {
        const next = new Map(previous);
        const key = `job:${job.id}`;
        const current = next.get(key) || { job_id: job.id, recommended_job_id: null, first_viewed_at: null, opened_at: null, first_saved_at: null, applied_at: null };
        next.set(key, { ...current, first_viewed_at: current.first_viewed_at || now, opened_at: current.opened_at || now, applied_at: current.applied_at || now });
        return next;
      });
      void markJobInteraction(job.id, "applied");
      toast({ title: t("jobs.toastApplySubmitted") });
      return;
    }
    if (job.source_url) {
      void markJobInteraction(job.id, "applied");
      window.open(job.source_url, "_blank", "noopener,noreferrer");
      return;
    }
    toast({ title: t("jobs.toastApplyLinkUnavailableTitle"), description: t("jobs.toastApplyLinkUnavailableBody"), variant: "destructive" });
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
      const description = err instanceof Error ? err.message : t("jobs.toastCoverFailedBody");
      toast({ title: t("jobs.toastCoverFailedTitle"), description, variant: "destructive" });
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
      toast({ title: t("jobs.toastCopyBlockedTitle"), description: t("jobs.toastCopyBlockedBody"), variant: "destructive" });
    }
  };

  const collectedTotalPages = Math.max(1, Math.ceil(collectedTotal / COLLECTED_PAGE_SIZE));
  useEffect(() => { setCollectedPage(1); }, [search, titleFilter, companyFilter, locationFilter, jobTypeFilter, experienceFilter, salaryMinFilter, salaryMaxFilter, remoteFilter, sourceTypeFilter, postedDateFilter, selectedMinScore]);

  const toggleSaveRec = async (recJobId: string) => {
    if (!user) return;
    if (savedRecIds.has(recJobId)) {
      await supabase.from("saved_jobs").delete().eq("user_id", user.id).eq("recommended_job_id", recJobId);
      setSavedRecIds(prev => { const next = new Set(prev); next.delete(recJobId); return next; });
      toast({ title: t("jobs.toastJobUnsaved") });
    } else {
      await supabase.from("saved_jobs").insert({ user_id: user.id, recommended_job_id: recJobId });
      setSavedRecIds(prev => new Set(prev).add(recJobId));
      void markJobInteraction(recJobId, "viewed", true);
      toast({ title: t("jobs.toastJobSaved") });
    }
  };

  // The unified module renders jobs from `jobs` + per-user scrape results.
  // Legacy recommended_jobs cards are intentionally excluded to avoid mixing
  // a second result source into either database mode or active scraper mode.
  const filtered = useMemo(() => [] as RecommendedJob[], []);

  const hasActiveFilters = Boolean(search || titleFilter || companyFilter || locationFilter || jobTypeFilter !== "all" || experienceFilter !== "all" || salaryMinFilter || salaryMaxFilter || remoteFilter !== "all" || sourceTypeFilter !== "all" || postedDateFilter !== "all" || selectedMinScore !== minMatchThreshold);
  const clearFilters = () => {
    setSearch("");
    setTitleFilter("");
    setCompanyFilter("");
    setLocationFilter("");
    setJobTypeFilter("all");
    setExperienceFilter("all");
    setSalaryMinFilter("");
    setSalaryMaxFilter("");
    setSourceTypeFilter("all");
    setPostedDateFilter("all");
    setSelectedMinScore(minMatchThreshold);
    setScoreFilter("all");
    setRemoteFilter("all");
  };
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
  const interactionFor = (jobId: string, recommended = false) => jobInteractions.get(`${recommended ? "recommended" : "job"}:${jobId}`);
  const hasVisited = (jobId: string, recommended = false) => {
    const interaction = interactionFor(jobId, recommended);
    return Boolean(interaction?.first_viewed_at || interaction?.opened_at || interaction?.first_saved_at || interaction?.applied_at);
  };
  const wasOpened = (jobId: string, recommended = false) => Boolean(interactionFor(jobId, recommended)?.opened_at);
  const wasApplied = (jobId: string, recommended = false) => Boolean(interactionFor(jobId, recommended)?.applied_at);

  return (
    <DashboardLayout>
      {gateOverlay}
      <div className="space-y-6 animate-fade-in pb-8">
        <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card px-6 py-7 shadow-card md:px-8 md:py-9">
          <div className="absolute -end-16 -top-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary"><Sparkles className="h-3.5 w-3.5" /> {t("jobs.discoveryEyebrow")}</div>
              <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{t("nav.searchJob", { defaultValue: "Search Job" })}</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground md:text-base">Search recruiter-posted and previously scraped jobs instantly. Fresh scraping starts only when you explicitly click Find Jobs.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {JOB_ADAPTER_STEPS.map((adapter) => {
                  const status = adapterStatuses[adapter.key];
                  const adapterLabel =
                    adapter.key === "linkedin"
                      ? t("jobs.adapterLinkedin")
                      : adapter.key === "indeed"
                        ? t("jobs.adapterIndeed")
                        : adapter.key === "rss"
                          ? t("jobs.adapterRss")
                          : t("jobs.adapterCompanyCareer");
                  const statusLabel =
                    status === "running"
                      ? t("jobs.statusRunning")
                      : status === "completed"
                        ? t("jobs.statusCompleted")
                        : status === "timed_out"
                          ? t("jobs.statusTimedOut")
                          : status === "failed"
                            ? t("jobs.statusFailed")
                            : status === "stopped"
                              ? t("jobs.statusStopped")
                              : t("jobs.statusIdle");
                  const stateClasses = status === "running"
                    ? "border-blue-700 bg-blue-950 text-blue-50"
                    : status === "completed"
                      ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-300"
                      : status === "timed_out"
                        ? "border-amber-500/60 bg-amber-500/20 text-amber-300"
                      : status === "failed"
                        ? "border-red-500/60 bg-red-500/20 text-red-300"
                        : status === "stopped"
                          ? "border-slate-500/60 bg-slate-500/20 text-slate-300"
                        : "border-sky-300/70 bg-sky-400 text-sky-950";
                  const StatusIcon = status === "running"
                    ? LoaderCircle
                    : status === "completed"
                      ? CheckCircle2
                      : status === "failed" || status === "timed_out"
                        ? AlertCircle
                        : status === "stopped"
                          ? Square
                          : Clock;
                  return (
                    <Button
                      key={adapter.key}
                      type="button"
                      size="sm"
                      disabled
                      aria-label={t("jobs.adapterStatus", { label: adapterLabel, status: statusLabel })}
                      title={t("jobs.adapterStatus", { label: adapterLabel, status: statusLabel })}
                      className={`h-8 gap-1.5 px-3 text-xs capitalize disabled:pointer-events-none disabled:opacity-100 ${stateClasses}`}
                    >
                      <StatusIcon className={`h-3.5 w-3.5 ${status === "running" ? "animate-spin" : ""}`} />
                      {t("jobs.adapterStatus", { label: adapterLabel, status: statusLabel })}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
              {usageLimitNotice}
              <Button onClick={scraping ? handleStopScraping : handleScrapeJobs} disabled={!scraping && (!search.trim() || selectedAdapters.size === 0)} className={`min-w-48 gap-2 border-0 shadow-lg ${scraping ? "bg-rose-600 hover:bg-rose-500 shadow-rose-500/20" : "gradient-primary shadow-primary/20"}`}>
                {scraping ? <Square className="h-4 w-4 fill-current" /> : <RefreshCw className="h-4 w-4" />}
                {scraping ? t("jobs.stopScraping") : "Find Jobs"}
              </Button>
              <p className="max-w-56 text-end text-xs text-muted-foreground">{t("jobs.scrapeHint")}</p>
              <p className="text-xs text-muted-foreground">{t("jobs.matchingRolesCount", { count: collectedTotal })}</p>
            </div>
          </div>
        </section>

        <Card className="border-border/80 bg-card/90 shadow-card">
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute start-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <FuzzyAutocompleteInput
                  taxonomy={jobTaxonomy}
                  value={search}
                  aria-required="true"
                  aria-label={t("jobs.searchPlaceholder")}
                  placeholder={t("jobs.searchPlaceholder")}
                  onChange={setSearch}
                  inputClassName="h-11 border-border/80 bg-background/60 ps-11"
                />
              </div>
              <div className="relative lg:w-64">
                <MapPin className="absolute start-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <FuzzyAutocompleteInput
                  taxonomy={locationTaxonomy}
                  value={locationFilter}
                  aria-label={t("jobs.locationAria")}
                  placeholder={t("jobs.locationPlaceholder")}
                  onChange={setLocationFilter}
                  inputClassName="h-11 border-border/80 bg-background/60 ps-11"
                />
              </div>
              <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="h-11 gap-2 border-border/80 bg-background/40">
                <Filter className="h-4 w-4" /> {showFilters ? t("jobs.hideFilters") : t("jobs.filters")}
                {hasActiveFilters && <span className="h-2 w-2 rounded-full bg-primary" />}
              </Button>
            </div>
            {showFilters && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/70 pt-4">
                <Input value={titleFilter} onChange={(event) => setTitleFilter(event.target.value)} placeholder={t("jobs.jobTitleFilter")} className="w-[180px] bg-background/60" />
                <Input value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)} placeholder={t("jobs.companyFilter")} className="w-[180px] bg-background/60" />
                <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}><SelectTrigger className="w-[155px] bg-background/60"><SelectValue placeholder={t("jobs.jobTypePlaceholder")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("jobs.anyJobType")}</SelectItem><SelectItem value="full-time">{t("jobs.fullTime")}</SelectItem><SelectItem value="part-time">{t("jobs.partTime")}</SelectItem><SelectItem value="contract">{t("jobs.contract")}</SelectItem><SelectItem value="internship">{t("jobs.internship")}</SelectItem></SelectContent></Select>
                <Select value={experienceFilter} onValueChange={setExperienceFilter}><SelectTrigger className="w-[165px] bg-background/60"><SelectValue placeholder={t("jobs.experienceLevelFilter")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("jobs.allExperience")}</SelectItem><SelectItem value="entry">{t("jobs.entryLevel")}</SelectItem><SelectItem value="mid">{t("jobs.midLevel")}</SelectItem><SelectItem value="senior">{t("jobs.seniorLevel")}</SelectItem><SelectItem value="lead">{t("jobs.leadLevel")}</SelectItem></SelectContent></Select>
                <Input type="number" min="0" value={salaryMinFilter} onChange={(event) => setSalaryMinFilter(event.target.value)} placeholder={t("jobs.minimumSalary")} className="w-[160px] bg-background/60" />
                <Input type="number" min="0" value={salaryMaxFilter} onChange={(event) => setSalaryMaxFilter(event.target.value)} placeholder={t("jobs.maximumSalary")} className="w-[160px] bg-background/60" />
                <Select value={remoteFilter} onValueChange={setRemoteFilter}><SelectTrigger className="w-[155px] bg-background/60"><SelectValue placeholder={t("jobs.workModePlaceholder")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("jobs.anyWorkMode")}</SelectItem><SelectItem value="remote">{t("jobs.remote")}</SelectItem><SelectItem value="hybrid">{t("jobs.hybrid")}</SelectItem></SelectContent></Select>
                <Select value={sourceTypeFilter} onValueChange={setSourceTypeFilter}><SelectTrigger className="w-[175px] bg-background/60"><SelectValue placeholder={t("jobs.jobSourceFilter")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("jobs.allSources")}</SelectItem><SelectItem value="recruiter">{t("jobs.recruiterPosted")}</SelectItem><SelectItem value="scraped">{t("jobs.scrapedJobs")}</SelectItem></SelectContent></Select>
                <Select value={postedDateFilter} onValueChange={setPostedDateFilter}><SelectTrigger className="w-[155px] bg-background/60"><SelectValue placeholder={t("jobs.datePostedFilter")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("jobs.anyTime")}</SelectItem><SelectItem value="1">{t("jobs.past24Hours")}</SelectItem><SelectItem value="7">{t("jobs.past7Days")}</SelectItem><SelectItem value="30">{t("jobs.past30Days")}</SelectItem></SelectContent></Select>
                <label className="flex h-10 items-center gap-2 rounded-md border border-border/70 bg-background/60 px-3 text-sm text-muted-foreground">{t("jobs.matchAtLeast")} <input aria-label={t("jobs.minimumMatchScore")} type="range" min="0" max="100" step="5" value={selectedMinScore} onChange={(event) => setSelectedMinScore(Number(event.target.value))} /><span className="w-9 font-medium text-foreground">{selectedMinScore}%</span></label>
                <label className="flex h-10 items-center gap-2 rounded-md border border-border/70 bg-background/60 px-3 text-sm text-muted-foreground">
                  <Checkbox checked={includeRemoteLocations} onCheckedChange={(checked) => setIncludeRemoteLocations(checked === true)} />
                  {t("jobs.includeRemote")}
                </label>
                <div className="flex flex-wrap items-center gap-2" aria-label={t("jobs.scrapingSources")}>
                  {JOB_ADAPTER_STEPS.map((adapter) => <label key={adapter.key} className="flex h-10 items-center gap-2 rounded-md border border-border/70 bg-background/60 px-3 text-sm text-muted-foreground">
                    <Checkbox checked={selectedAdapters.has(adapter.key)} disabled={scraping} onCheckedChange={(checked) => setSelectedAdapters((current) => { const next = new Set(current); if (checked === true) next.add(adapter.key); else next.delete(adapter.key); return next; })} />
                    {adapter.key === "linkedin" ? t("jobs.adapterLinkedin") : adapter.key === "indeed" ? t("jobs.adapterIndeed") : adapter.key === "rss" ? t("jobs.adapterRss") : t("jobs.adapterCompanyCareer")}
                  </label>)}
                </div>
                {hasActiveFilters && <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clearFilters}><X className="h-3.5 w-3.5" /> {t("jobs.clearFilters")}</Button>}
              </div>
            )}
            {scrapeSession && (
              <div className="mt-4 rounded-2xl border border-border/70 bg-background/45 p-4" role="status" aria-live="polite">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {isScrapeSessionActive(scrapeSession) && activeAdapterPosition
                        ? t("jobs.runningAdapter", { position: activeAdapterPosition, total: JOB_ADAPTER_STEPS.length })
                        : scrapeCompletionMessage(scrapeSession)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Search: {scrapeSession.search_query}{scrapeSession.location ? ` in ${scrapeSession.location}` : " in any location"}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[300px]">
                    <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2"><p className="text-base font-bold">{scrapeSession.total_jobs_scraped}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("jobs.counterScraped")}</p></div>
                    <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2"><p className="text-base font-bold">{scrapeSession.total_jobs_saved}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("jobs.counterSaved")}</p></div>
                    <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2"><p className="text-base font-bold text-success">{scrapeSession.total_jobs_displayed}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("jobs.counterShown")}</p></div>
                  </div>
                </div>
                {!hasSuccessfulScrapeResults(scrapeSession) && (() => {
                  const summary = scrapeSession.exclusion_summary as Record<string, number> | null;
                  if (!summary) return null;
                  const details = [
                    [summary.optional_filters, t("jobs.excludedJobTypeWorkMode")],
                    [summary.invalid_or_duplicate, t("jobs.excludedInvalidDuplicate")],
                    [summary.career_level, t("jobs.excludedCareerLevel")],
                    [summary.below_match_score, t("jobs.excludedBelowMatch", { threshold: minMatchThreshold })],
                  ].filter(([count]) => Number(count) > 0);
                  return details.length ? (
                    <p className="mt-3 text-xs text-muted-foreground" dir="auto">
                      {t("jobs.excludedPrefix")} {details.map(([count, label]) => `${count} ${label}`).join(" · ")}. {includeRemoteLocations ? t("jobs.remoteIncludedNote") : t("jobs.remoteExcludedNote")}
                    </p>
                  ) : null;
                })()}
                {!hasSuccessfulScrapeResults(scrapeSession) && (() => {
                  const errors = scrapeSession.adapter_errors as Record<string, string[]> | null;
                  const messages = Object.entries(errors || {}).flatMap(([adapter, entries]) => entries.map((message) => `${adapter.replace(/_/g, " ")}: ${message}`));
                  return messages.length ? (
                    <p className="mt-2 text-xs text-warning" dir="auto">
                      {t("jobs.sourceDetailsPrefix")} {messages.join(" · ")}
                    </p>
                  ) : null;
                })()}
              </div>
            )}
          </CardContent>
        </Card>
        {collectedJobs.length > 0 && (
          <section className="space-y-3">
            <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-xl font-semibold">{t("jobs.openRoles")}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{collectedTotal} matching role{collectedTotal !== 1 ? "s" : ""} · Page {collectedPage} of {collectedTotalPages}</p>
              </div>
              <Badge variant="secondary" className="w-fit border border-border/70 bg-muted/50 font-normal">{t("jobs.updatedFromSources")}</Badge>
            </div>
            {collectedJobs.map((job) => (
              <Card
                key={`modern-${job.id}`}
                tabIndex={0}
                onClick={() => void markJobInteraction(job.id, "viewed")}
                onPointerEnter={() => setVisibleJobId(job.id)}
                onFocusCapture={() => setVisibleJobId(job.id)}
                className={`group overflow-hidden border-border/80 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-card-hover ${hasVisited(job.id) ? "bg-muted/35" : "bg-card"}`}
              >
                <CardContent className="p-0">
                  <div className="flex gap-4 p-5 md:gap-5 md:p-6">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-display text-base font-bold text-primary">{(job.company || "J").charAt(0).toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {job.match_score !== null && <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">Match {Math.round(Number(job.match_score))}%</Badge>}
                        {!hasVisited(job.id) && <Badge className="bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-500/15">New</Badge>}
                        {hasVisited(job.id) && <Badge variant="outline" className="px-2 py-0.5 text-[10px] font-semibold">Viewed</Badge>}
                        {savedJobIds.has(job.id) && <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600">Saved</Badge>}
                        {wasApplied(job.id) && <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Applied</Badge>}
                      </div>
                      <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-primary md:text-xl"><MixedDir>{job.title}</MixedDir></h3>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5 font-medium text-foreground/85"><Building2 className="h-3.5 w-3.5 text-primary/70" /><MixedDir>{job.company || "Company not listed"}</MixedDir></span>
                        {job.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /><MixedDir>{job.location}</MixedDir></span>}
                        {job.job_type && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{job.job_type}</span>}
                        {(job.salary_min || job.salary_max) && <span className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" />{job.salary_currency ? `${job.salary_currency} ` : ""}{job.salary_min ? Number(job.salary_min).toLocaleString() : ""}{job.salary_min && job.salary_max ? " - " : ""}{job.salary_max ? Number(job.salary_max).toLocaleString() : ""}</span>}
                      </div>
                      {plainJobDescription(job.description) && <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground line-clamp-2"><MixedDir>{plainJobDescription(job.description)}</MixedDir></p>}
                      <MatchExplanation explanation={job.match_explanation as MatchExplanationData | null} />
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {(job.skills || []).slice(0, 4).map((skill: string) => <Badge key={skill} variant="secondary" className="bg-muted/65 px-2 py-0.5 text-xs font-normal"><MixedDir>{skill}</MixedDir></Badge>)}
                        <span className="ms-auto text-xs text-muted-foreground">{relativeDate(job.posted_at || job.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Button variant="ghost" size="icon" aria-label={savedJobIds.has(job.id) ? "Remove from saved jobs" : "Save job"} onClick={() => toggleSaveJob(job.id)} className={savedJobIds.has(job.id) ? "text-primary" : "text-muted-foreground"}>{savedJobIds.has(job.id) ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}</Button>
                      <Button variant="outline" size="sm" onClick={() => void tailorCoverLetter(job)} disabled={Boolean(generatingCoverLetterFor)} className="hidden gap-1.5 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 sm:inline-flex">
                        {generatingCoverLetterFor === job.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {generatingCoverLetterFor === job.id ? "Tailoring..." : "Tailor letter"}
                      </Button>
                      <Button
                        size="sm"
                        variant={wasOpened(job.id) ? "outline" : "default"}
                        onClick={() => applyToCollectedJob(job)}
                        className={`hidden gap-1.5 sm:inline-flex ${wasOpened(job.id) ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15" : ""}`}
                      >
                        {wasOpened(job.id) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                        {wasApplied(job.id) ? "Applied" : wasOpened(job.id) ? "Opened" : "Apply"}
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-border/60 px-5 py-3 sm:hidden">
                    <Button variant="outline" size="sm" onClick={() => void tailorCoverLetter(job)} disabled={Boolean(generatingCoverLetterFor)} className="gap-1.5 border-primary/30 bg-primary/5 text-primary">
                      {generatingCoverLetterFor === job.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Tailor letter
                    </Button>
                    <Button
                      size="sm"
                      variant={wasOpened(job.id) ? "outline" : "default"}
                      className={`gap-1.5 ${wasOpened(job.id) ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : ""}`}
                      onClick={() => applyToCollectedJob(job)}
                    >
                      {wasOpened(job.id) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                      {wasApplied(job.id) ? "Applied" : wasOpened(job.id) ? "Opened" : "Apply"}
                    </Button>
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
              <h3 className="font-display text-xl font-semibold" dir="auto">{t("jobs.noRolesMatchTitle")}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground" dir="auto">
                {t("jobs.noRolesMatchBody", { threshold: minMatchThreshold })}
              </p>
              <Button className="mt-5 gap-1.5" variant="outline" onClick={clearFilters}><X className="h-3.5 w-3.5" /> {t("jobs.clearFilters")}</Button>
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
                  ? t("jobs.emptySearchHint")
                  : t("jobs.noJobsHint")}
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
              const isNew = !hasVisited(job.id, true);
              return (
                <Card
                  key={job.id}
                  tabIndex={0}
                  onPointerEnter={() => setVisibleJobId(job.id)}
                  onFocusCapture={() => setVisibleJobId(job.id)}
                  className="shadow-card hover:shadow-card-hover transition-all group"
                >
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
                                <MixedDir>{job.title}</MixedDir>
                                <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </a>
                            ) : (
                              <h3 className="font-display text-lg font-semibold text-foreground"><MixedDir>{job.title}</MixedDir></h3>
                            )}
                            {isNew && <Badge className="bg-blue-500 text-white animate-pulse text-[10px]">NEW</Badge>}
                            {score >= 80 && <Badge className="bg-green-100 text-green-800 border-green-200">Top Match</Badge>}
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /><MixedDir>{job.company}</MixedDir></span>
                            {job.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /><MixedDir>{job.location}</MixedDir></span>}
                            {job.salary && <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{job.salary}</span>}
                            {job.employment_type && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{job.employment_type}</span>}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {(job.skills_required || []).slice(0, 5).map(skill => (
                              <Badge key={skill} variant="outline" className="text-xs font-normal"><MixedDir>{skill}</MixedDir></Badge>
                            ))}
                          </div>
                          {plainJobDescription(job.description) && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2"><MixedDir>{plainJobDescription(job.description)}</MixedDir></p>
                          )}
                          <MatchExplanation explanation={job.match_explanation as MatchExplanationData | null} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => toggleSaveRec(job.id)} className={isSaved ? "text-primary" : "text-muted-foreground"}>
                          {isSaved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                        </Button>
                        {job.source_url && (
                          <Button
                            size="sm"
                            variant={wasOpened(job.id, true) ? "outline" : "default"}
                            className={wasOpened(job.id, true) ? "gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15" : "gradient-primary border-0 gap-1"}
                            asChild
                          >
                            <a href={job.source_url} target="_blank" rel="noopener noreferrer" onClick={() => void markJobInteraction(job.id, "applied", true)}>
                              {wasOpened(job.id, true) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
                              {wasOpened(job.id, true) ? "Opened" : "Apply"}
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
            <DialogTitle className="font-display text-xl">{t("jobs.tailoredCoverLetter")}</DialogTitle>
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
            <Textarea aria-label={t("jobs.tailoredCoverLetter")} value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} rows={13} className="resize-y border-border bg-background text-foreground leading-7 placeholder:text-muted-foreground focus-visible:ring-primary" />
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

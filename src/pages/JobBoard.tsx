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
import { Search, MapPin, DollarSign, Bookmark, BookmarkCheck, ExternalLink, Building2, Clock, RefreshCw, Filter, Download, CheckCircle2, Chrome, Sparkles, Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type RecommendedJob = Tables<"recommended_jobs">;
type Job = Tables<"jobs">;

const PORTAL_COLORS: Record<string, string> = {
  linkedin: "bg-[#0a66c2] text-white",
  indeed: "bg-[#2557a7] text-white",
  glassdoor: "bg-[#0caa41] text-white",
  monster: "bg-[#6e45a5] text-white",
  bayt: "bg-[#009688] text-white",
  rozee: "bg-[#e53935] text-white",
  wellfound: "bg-black text-white",
  dice: "bg-[#eb1c26] text-white",
  careerbuilder: "bg-[#00719e] text-white",
};

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

function ExtensionOnboarding({ hasExtension }: { hasExtension: boolean }) {
  if (hasExtension) return null;
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
  const [savedRecIds, setSavedRecIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [remoteFilter, setRemoteFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

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

    const { data: saved } = await supabase
      .from("saved_jobs")
      .select("recommended_job_id")
      .eq("user_id", user.id)
      .not("recommended_job_id", "is", null);
    if (saved) setSavedRecIds(new Set(saved.map(s => s.recommended_job_id!).filter(Boolean)));
    setLoading(false);
  };

  const handleRefresh = async () => {
    setScraping(true);
    try {
      const role = profile?.desired_roles?.[0] || "";
      const skills = profile?.skills || [];
      const query = role || (skills.length ? skills.slice(0, 3).join(" ") : "software developer");
      const userCity = locationFilter.trim() || "";
      const { data, error } = await supabase.functions.invoke("scrape-jobs", {
        body: { query, location: userCity ? `${userCity}, Pakistan` : "Pakistan", skills, role, strictLocation: !!userCity, cityFilter: userCity },
      });
      if (error) throw error;
      toast({ title: "Jobs refreshed!", description: `Found ${data.found} jobs, added ${data.inserted} new listings.` });
    } catch (err: any) {
      toast({ title: "Refresh failed", description: err.message || "Could not fetch new jobs", variant: "destructive" });
    } finally {
      setScraping(false);
    }
  };

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
    const portals = new Set(recJobs.map(j => j.source_portal).filter(Boolean));
    return [...portals];
  }, [recJobs]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Browse Jobs</h1>
            <p className="text-muted-foreground mt-1">AI-matched opportunities from your extension scans</p>
          </div>
          <Button onClick={handleRefresh} disabled={scraping} variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${scraping ? "animate-spin" : ""}`} />
            {scraping ? "Scanning..." : "Refresh from API"}
          </Button>
        </div>

        {/* Extension Onboarding */}
        <ExtensionOnboarding hasExtension={recJobs.length > 0} />

        {/* Filters */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search jobs or companies..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              </div>
              <div className="relative flex-1 md:max-w-[200px]">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Location..." value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="pl-10" />
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1">
                <Filter className="h-3.5 w-3.5" /> Filters
              </Button>
            </div>
            {showFilters && (
              <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t">
                <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Job type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Full-time">Full-time</SelectItem>
                    <SelectItem value="Part-time">Part-time</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                    <SelectItem value="Remote">Remote</SelectItem>
                    <SelectItem value="Hybrid">Hybrid</SelectItem>
                    <SelectItem value="Internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Source portal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Portals</SelectItem>
                    {uniquePortals.map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={scoreFilter} onValueChange={setScoreFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Match score" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Score</SelectItem>
                    <SelectItem value="80+">80%+ (Excellent)</SelectItem>
                    <SelectItem value="60-79">60-79% (Good)</SelectItem>
                    <SelectItem value="40-59">40-59% (Fair)</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={remoteFilter} onValueChange={setRemoteFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Work mode" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Mode</SelectItem>
                    <SelectItem value="remote">Remote Only</SelectItem>
                    <SelectItem value="hybrid">Hybrid Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-display text-xl font-semibold">
                {recJobs.length === 0 ? "No jobs discovered yet" : "No jobs match your filters"}
              </h3>
              <p className="text-muted-foreground mt-1">
                {recJobs.length === 0
                  ? "Install the extension and scan a job portal (LinkedIn, Indeed, Glassdoor) to discover matching opportunities."
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

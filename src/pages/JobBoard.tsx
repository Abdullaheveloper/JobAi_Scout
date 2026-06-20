import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, MapPin, DollarSign, Bookmark, BookmarkCheck, ExternalLink, Building2, Clock, RefreshCw } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

export default function JobBoard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");

  useEffect(() => {
    fetchJobs();
    fetchSavedJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    const { data } = await supabase.from("jobs").select("*").eq("is_active", true).order("date_posted", { ascending: false });
    if (data) setJobs(data);
    setLoading(false);
  };

  const fetchSavedJobs = async () => {
    if (!user) return;
    const { data } = await supabase.from("saved_jobs").select("job_id").eq("user_id", user.id);
    if (data) setSavedJobIds(new Set(data.map((s) => s.job_id)));
  };

  const handleRefresh = async () => {
    setScraping(true);
    try {
      const role = profile?.desired_roles?.[0] || "";
      const skills = profile?.skills || [];
      const query = role || (skills.length ? skills.slice(0, 3).join(" ") : "software developer");
      // Default country is Pakistan; city filter is optional
      const userCountry = "Pakistan";
      const userCity = locationFilter.trim() || "";

      const { data, error } = await supabase.functions.invoke("scrape-jobs", {
        body: {
          query,
          location: userCity ? `${userCity}, ${userCountry}` : userCountry,
          skills,
          role,
          strictLocation: !!userCity,
          cityFilter: userCity,
        },
      });

      if (error) throw error;
      toast({ title: "Jobs refreshed!", description: `Found ${data.found} jobs, added ${data.inserted} new listings.` });
      await fetchJobs();
    } catch (err: any) {
      console.error("Scrape error:", err);
      toast({ title: "Refresh failed", description: err.message || "Could not fetch new jobs", variant: "destructive" });
    } finally {
      setScraping(false);
    }
  };

  const toggleSave = async (jobId: string) => {
    if (!user) return;
    if (savedJobIds.has(jobId)) {
      await supabase.from("saved_jobs").delete().eq("user_id", user.id).eq("job_id", jobId);
      setSavedJobIds((prev) => { const next = new Set(prev); next.delete(jobId); return next; });
      toast({ title: "Job unsaved" });
    } else {
      await supabase.from("saved_jobs").insert({ user_id: user.id, job_id: jobId });
      setSavedJobIds((prev) => new Set(prev).add(jobId));
      toast({ title: "Job saved!" });
    }
  };

  const getMatchScore = (job: Job): number => {
    if (!profile?.skills?.length || !job.skills?.length) return 0;
    const userSkills = new Set(profile.skills.map((s: string) => s.toLowerCase()));
    const matched = job.skills.filter((s) => userSkills.has(s.toLowerCase()));
    return Math.round((matched.length / job.skills.length) * 100);
  };

  const filtered = jobs.filter((j) => {
    const matchSearch = !search || j.title.toLowerCase().includes(search.toLowerCase()) || j.company.toLowerCase().includes(search.toLowerCase());
    const matchLocation = !locationFilter || (j.location?.toLowerCase().includes(locationFilter.toLowerCase()));
    const matchType = jobTypeFilter === "all" || j.job_type === jobTypeFilter;
    return matchSearch && matchLocation && matchType;
  });

  const formatSalary = (min?: number | null, max?: number | null) => {
    if (!min && !max) return null;
    const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;
    if (min && max) return `${fmt(min)} - ${fmt(max)}`;
    if (min) return `From ${fmt(min)}`;
    return `Up to ${fmt(max!)}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Browse Jobs</h1>
            <p className="text-muted-foreground mt-1">Find opportunities that match your skills</p>
          </div>
          <Button onClick={handleRefresh} disabled={scraping} className="gradient-primary border-0 gap-2">
            <RefreshCw className={`h-4 w-4 ${scraping ? "animate-spin" : ""}`} />
            {scraping ? "Scraping..." : "Refresh Jobs"}
          </Button>
        </div>

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
              <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                <SelectTrigger className="w-full md:w-[160px]">
                  <SelectValue placeholder="Job type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="full-time">Full-time</SelectItem>
                  <SelectItem value="part-time">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-display text-xl font-semibold">No jobs found</h3>
              <p className="text-muted-foreground mt-1">Click "Refresh Jobs" to scrape real listings or adjust your filters</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((job) => {
              const score = getMatchScore(job);
              const salary = formatSalary(job.salary_min, job.salary_max);
              const isSaved = savedJobIds.has(job.id);
              return (
                <Card key={job.id} className="shadow-card hover:shadow-card-hover transition-all group">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {job.job_url ? (
                            <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="font-display text-lg font-semibold text-foreground group-hover:text-primary transition-colors hover:underline flex items-center gap-1.5">
                              {job.title}
                              <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          ) : (
                            <h3 className="font-display text-lg font-semibold text-foreground group-hover:text-primary transition-colors">{job.title}</h3>
                          )}
                          {score > 0 && (
                            <Badge variant={score >= 70 ? "default" : "secondary"} className={score >= 70 ? "gradient-primary border-0" : ""}>
                              {score}% Match
                            </Badge>
                          )}
                          {job.source === "serpapi" && (
                            <Badge variant="outline" className="text-xs">Live</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{job.company}</span>
                          {job.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
                          {salary && <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{salary}</span>}
                          {job.job_type && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{job.job_type}</span>}
                        </div>
                        {job.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{job.description}</p>
                        )}
                        {job.skills && job.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {job.skills.slice(0, 6).map((skill) => (
                              <Badge key={skill} variant="outline" className="text-xs font-normal">{skill}</Badge>
                            ))}
                            {job.skills.length > 6 && <Badge variant="outline" className="text-xs font-normal">+{job.skills.length - 6}</Badge>}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => toggleSave(job.id)} className={isSaved ? "text-primary" : "text-muted-foreground"}>
                          {isSaved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                        </Button>
                        {job.job_url && (
                          <Button
                            size="sm"
                            className="gradient-primary border-0 gap-1"
                            asChild
                          >
                            <a href={job.job_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                              View Job
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

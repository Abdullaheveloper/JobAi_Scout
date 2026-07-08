import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious, PaginationEllipsis,
} from "@/components/ui/pagination";
import { Briefcase, Building2, Calendar as CalendarIcon, ExternalLink, Globe, Search, X, TrendingUp, Sparkles, CheckCircle2 } from "lucide-react";
import type { DateRange } from "react-day-picker";

interface AppliedJob {
  id: string;
  job_title: string;
  company: string | null;
  job_url: string;
  platform: string | null;
  applied_at: string;
  status: string;
}

const STATUS_OPTIONS = [
  { value: "applied", label: "Applied", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  { value: "shortlisted", label: "Shortlisted", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  { value: "interview", label: "Interview", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" },
  { value: "offer", label: "Offer", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  { value: "hired", label: "Hired", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" },
  { value: "rejected", label: "Rejected", color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20" },
];

function statusBadgeClasses(status?: string | null) {
  const found = STATUS_OPTIONS.find((s) => s.value === (status || "applied"));
  return found ? found.color : STATUS_OPTIONS[0].color;
}

function statusLabel(status?: string | null) {
  const found = STATUS_OPTIONS.find((s) => s.value === (status || "applied"));
  return found ? found.label : "Applied";
}

const PAGE_SIZE = 10;

export default function AppliedJobs() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AppliedJob[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState<string>("all");
  const [company, setCompany] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [range, setRange] = useState<DateRange | undefined>();
  const [page, setPage] = useState(1);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("applied_jobs")
      .select("id,job_title,company,job_url,platform,applied_at,status")
      .eq("user_id", user.id)
      .order("applied_at", { ascending: false });
    setRows((data as AppliedJob[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase.channel("applied_jobs_rt")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "applied_jobs", filter: `user_id=eq.${user.id}` },
        (payload) => setRows((prev) => [payload.new as AppliedJob, ...prev]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const platforms = useMemo(
    () => Array.from(new Set(rows.map((r) => r.platform).filter(Boolean) as string[])).sort(),
    [rows]
  );
  const companies = useMemo(
    () => Array.from(new Set(rows.map((r) => r.company).filter(Boolean) as string[])).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (platform !== "all" && r.platform !== platform) return false;
      if (company !== "all" && r.company !== company) return false;
      if (status !== "all" && r.status !== status) return false;
      if (range?.from) {
        const d = new Date(r.applied_at);
        const from = new Date(range.from); from.setHours(0, 0, 0, 0);
        if (d < from) return false;
        if (range.to) {
          const to = new Date(range.to); to.setHours(23, 59, 59, 999);
          if (d > to) return false;
        }
      }
      if (q) {
        const hay = `${r.job_title} ${r.company ?? ""} ${r.platform ?? ""} ${r.status ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, platform, company, status, range]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, platform, company, status, range]);

  const clearFilters = () => {
    setSearch(""); setPlatform("all"); setCompany("all"); setStatus("all"); setRange(undefined);
  };
  const hasFilters = search || platform !== "all" || company !== "all" || status !== "all" || range?.from;

  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeek = rows.filter((r) => new Date(r.applied_at) >= weekAgo).length;
    const today = rows.filter((r) => {
      const d = new Date(r.applied_at);
      return d.toDateString() === now.toDateString();
    }).length;
    const statusCounts: Record<string, number> = {};
    rows.forEach((r) => { statusCounts[r.status || "applied"] = (statusCounts[r.status || "applied"] || 0) + 1; });
    return {
      total: rows.length,
      thisWeek,
      today,
      platforms: new Set(rows.map((r) => r.platform).filter(Boolean)).size,
      statusCounts,
    };
  }, [rows]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Hero header with gradient + animated blob */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-6 md:p-8 shadow-card">
          <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl animate-pulse" />
          <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
                <Sparkles className="h-3.5 w-3.5" /> Live tracking
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
                Applied Jobs
              </h1>
              <p className="text-muted-foreground mt-2 max-w-xl">
                Every application you submit through the JobAI extension lands here in real time.
              </p>
            </div>
          </div>

          {/* Stat tiles */}
          <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {[
              { label: "Total", value: stats.total, icon: Briefcase, tone: "from-primary/20 to-primary/5" },
              { label: "This week", value: stats.thisWeek, icon: TrendingUp, tone: "from-accent/20 to-accent/5" },
              { label: "Today", value: stats.today, icon: CheckCircle2, tone: "from-emerald-500/20 to-emerald-500/5" },
              { label: "Platforms", value: stats.platforms, icon: Globe, tone: "from-violet-500/20 to-violet-500/5" },
            ].map((s) => (
              <div
                key={s.label}
                className={cn(
                  "group relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br p-4 backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-lg",
                  s.tone
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</span>
                  <s.icon className="h-4 w-4 text-primary/70" />
                </div>
                <div className="mt-2 font-display text-2xl font-bold">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Status distribution */}
          {Object.keys(stats.statusCounts).length > 0 && (
            <div className="relative flex flex-wrap items-center gap-2 mt-4">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Status breakdown:</span>
              {Object.entries(stats.statusCounts).map(([st, count]) => (
                <Badge key={st} variant="outline" className={cn("gap-1 text-xs", statusBadgeClasses(st))}>
                  {statusLabel(st)} <span className="font-semibold">{count}</span>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Card className="shadow-card border-border/60 backdrop-blur-sm bg-card/80">
          <CardContent className="p-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search title, company, status..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All platforms</SelectItem>
                  {platforms.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={company} onValueChange={setCompany}>
                <SelectTrigger><SelectValue placeholder="Company" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All companies</SelectItem>
                  {companies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !range?.from && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {range?.from
                      ? range.to
                        ? `${format(range.from, "LLL d, y")} – ${format(range.to, "LLL d, y")}`
                        : format(range.from, "LLL d, y")
                      : "Date range"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={range}
                    onSelect={setRange}
                    numberOfMonths={2}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {hasFilters && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                  <X className="h-3.5 w-3.5" /> Clear filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-display text-xl font-semibold">
                {rows.length === 0 ? "No applications tracked yet" : "No results match your filters"}
              </h3>
              <p className="text-muted-foreground mt-1">
                {rows.length === 0
                  ? "Install the browser extension and submit applications — they'll appear here automatically."
                  : "Try adjusting or clearing your filters."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </div>
            {pageRows.map((j, idx) => (
              <Card
                key={j.id}
                className="group relative overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 border-border/60 hover:border-primary/40 hover:-translate-y-0.5 animate-fade-in"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                {/* Accent bar */}
                <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary via-accent to-primary/30 opacity-70 group-hover:opacity-100 transition-opacity" />
                {/* Hover sheen */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-5 pl-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display text-lg font-semibold truncate group-hover:text-primary transition-colors">
                          {j.job_title}
                        </h3>
                        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                          {j.company && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3.5 w-3.5" />
                              {j.company}
                            </span>
                          )}
                          {j.platform && (
                            <Badge variant="outline" className="gap-1 bg-primary/5 border-primary/20 text-primary">
                              <Globe className="h-3 w-3" />
                              {j.platform}
                            </Badge>
                          )}
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-3.5 w-3.5" />
                            {new Date(j.applied_at).toLocaleString()}
                          </span>
                          <Badge className={cn("gap-1 hover:opacity-90", statusBadgeClasses(j.status))}>
                            <CheckCircle2 className="h-3 w-3" /> {statusLabel(j.status)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 shrink-0 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors"
                      onClick={() => window.open(j.job_url, "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {totalPages > 1 && (
              <Pagination className="pt-2">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const n = i + 1;
                    if (totalPages > 7 && n !== 1 && n !== totalPages && Math.abs(n - currentPage) > 1) {
                      if (n === 2 || n === totalPages - 1) {
                        return <PaginationItem key={n}><PaginationEllipsis /></PaginationItem>;
                      }
                      return null;
                    }
                    return (
                      <PaginationItem key={n}>
                        <PaginationLink
                          href="#"
                          isActive={n === currentPage}
                          onClick={(e) => { e.preventDefault(); setPage(n); }}
                        >
                          {n}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)); }}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

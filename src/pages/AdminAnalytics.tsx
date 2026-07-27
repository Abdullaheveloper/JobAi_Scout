import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, BarChart3, Briefcase, FileText, Globe2, Loader2, MapPin,
  Mic, MousePointerClick, RefreshCw, Users, Bookmark,
} from "lucide-react";
import { useTranslation } from "react-i18next";

type Range = "7" | "30" | "90" | "all";

type NamedCount = { name: string; value: number };
type DayCount = { day: string; count: number };

type PlatformAnalytics = {
  range_days: number;
  series_days: number;
  totals: {
    users: number;
    jobs: number;
    active_jobs: number;
    posted_jobs: number;
    collected_jobs: number;
    applications: number;
    external_applications: number;
    saved_jobs: number;
    cvs_uploaded: number;
    extension_fills: number;
    extension_fields: number;
    voice_conversations: number;
    voice_messages: number;
  };
  period: {
    new_users: number;
    new_jobs: number;
    new_applications: number;
    new_extension_fills: number;
    new_voice_conversations: number;
  };
  users_by_role: NamedCount[];
  signups_by_day: DayCount[];
  applications_by_day: DayCount[];
  jobs_by_day: DayCount[];
  extension_by_day: DayCount[];
  jobs_by_source: NamedCount[];
  top_locations: NamedCount[];
};

const CHART = ["#818cf8", "#22d3ee", "#f472b6", "#fbbf24", "#34d399", "#a78bfa", "#fb7185", "#38bdf8"];

const tooltipStyle = {
  background: "rgba(15, 23, 42, 0.95)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  fontSize: 12,
  color: "#e2e8f0",
};

function rangeToDays(range: Range): number {
  if (range === "all") return 0;
  return parseInt(range, 10);
}

function fillSeries(raw: DayCount[] | undefined, seriesDays: number): { name: string; value: number }[] {
  const map = new Map<string, number>();
  (raw || []).forEach((r) => {
    const key = typeof r.day === "string" ? r.day.slice(0, 10) : String(r.day);
    map.set(key, Number(r.count) || 0);
  });

  const out: { name: string; value: number }[] = [];
  for (let i = seriesDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({
      name: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
      value: map.get(key) || 0,
    });
  }
  return out;
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="bg-card border-border text-foreground rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums truncate">{value}</p>
            {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  description,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`bg-card border-border text-foreground rounded-2xl ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          {Icon ? <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-300" /> : null}
          {title}
        </CardTitle>
        {description ? <CardDescription className="text-xs text-muted-foreground">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyChart({ msg = "No data in this range" }: { msg?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
      <Activity className="h-8 w-8 mb-2 opacity-50" />
      <p className="text-sm">{msg}</p>
    </div>
  );
}

function hasSeriesData(series: { value: number }[]) {
  return series.some((p) => p.value > 0);
}

export default function AdminAnalytics() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [range, setRange] = useState<Range>("30");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PlatformAnalytics | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: raw, error } = await supabase.rpc("get_platform_analytics", {
        p_days: rangeToDays(range),
      });
      if (error) throw error;
      setData(raw as unknown as PlatformAnalytics);
    } catch (e) {
      setData(null);
      toast({
        variant: "destructive",
        title: "Could not load platform analytics",
        description: (e as Error).message,
      });
    } finally {
      setLoading(false);
    }
  }, [range, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const seriesDays = data?.series_days || (range === "all" ? 90 : rangeToDays(range));

  const signups = useMemo(() => fillSeries(data?.signups_by_day, seriesDays), [data, seriesDays]);
  const applications = useMemo(() => fillSeries(data?.applications_by_day, seriesDays), [data, seriesDays]);
  const jobs = useMemo(() => fillSeries(data?.jobs_by_day, seriesDays), [data, seriesDays]);
  const extension = useMemo(() => fillSeries(data?.extension_by_day, seriesDays), [data, seriesDays]);

  const activityTrend = useMemo(
    () =>
      signups.map((s, i) => ({
        name: s.name,
        signups: s.value,
        applications: applications[i]?.value || 0,
        jobs: jobs[i]?.value || 0,
      })),
    [signups, applications, jobs],
  );

  const totals = data?.totals;
  const period = data?.period;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/10 border border-indigo-500/20">
              <BarChart3 className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">{t("admin.analytics")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Live metrics from users, jobs, applications, CVs, extension, and voice usage.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
              <TabsList className="bg-muted border border-border">
                <TabsTrigger value="7">7d</TabsTrigger>
                <TabsTrigger value="30">30d</TabsTrigger>
                <TabsTrigger value="90">90d</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              className="border-border hover:bg-muted gap-1.5"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
          </div>
        </div>

        {loading && !data ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl bg-muted" />
            ))}
          </div>
        ) : !data || !totals ? (
          <Card className="bg-card border-border rounded-2xl">
            <CardContent className="py-16">
              <EmptyChart msg="Analytics unavailable. Try refreshing, or ensure the analytics RPC is deployed." />
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                icon={Users}
                label="Total Users"
                value={totals.users}
                hint={`${period?.new_users ?? 0} in selected range`}
              />
              <Kpi
                icon={Briefcase}
                label="Jobs"
                value={totals.jobs}
                hint={`${totals.active_jobs} active · ${totals.posted_jobs} posted · ${totals.collected_jobs} collected`}
              />
              <Kpi
                icon={FileText}
                label="Applications"
                value={totals.applications}
                hint={`${period?.new_applications ?? 0} in range · ${totals.external_applications} external`}
              />
              <Kpi
                icon={FileText}
                label="CVs Uploaded"
                value={totals.cvs_uploaded}
                hint="Profiles with a resume on file"
              />
              <Kpi icon={Bookmark} label="Saved Jobs" value={totals.saved_jobs} />
              <Kpi
                icon={MousePointerClick}
                label="Extension Fills"
                value={totals.extension_fills}
                hint={`${totals.extension_fields} fields filled`}
              />
              <Kpi
                icon={Mic}
                label="Voice Sessions"
                value={totals.voice_conversations}
                hint={`${totals.voice_messages} messages`}
              />
              <Kpi
                icon={Globe2}
                label="Period Activity"
                value={period?.new_jobs ?? 0}
                hint={`${period?.new_users ?? 0} signups · ${period?.new_extension_fills ?? 0} fills`}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <ChartCard
                title="Platform Activity"
                description={range === "all" ? "Last 90 days (series cap)" : `Last ${seriesDays} days`}
                icon={Activity}
                className="lg:col-span-2"
              >
                {hasSeriesData(activityTrend.map((p) => ({ value: p.signups + p.applications + p.jobs }))) ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={activityTrend}>
                      <defs>
                        <linearGradient id="platSignups" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#818cf8" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="signups" name="Signups" stroke="#818cf8" fill="url(#platSignups)" strokeWidth={2} />
                      <Line type="monotone" dataKey="applications" name="Applications" stroke="#22d3ee" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="jobs" name="Jobs" stroke="#fbbf24" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </ChartCard>

              <ChartCard title="Users by Role" icon={Users}>
                {(data.users_by_role || []).length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={data.users_by_role}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {data.users_by_role.map((_, i) => (
                          <Cell key={i} fill={CHART[i % CHART.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart msg="No role data yet" />
                )}
              </ChartCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Signups Over Time" icon={Users}>
                {hasSeriesData(signups) ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={signups}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="value" name="Signups" stroke="#818cf8" fill="#818cf833" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </ChartCard>

              <ChartCard title="Jobs by Source" icon={Briefcase}>
                {(data.jobs_by_source || []).length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.jobs_by_source}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" fill="#818cf8" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart msg="No jobs yet" />
                )}
              </ChartCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Top Job Locations" icon={MapPin}>
                {(data.top_locations || []).length ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={data.top_locations}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {data.top_locations.map((_, i) => (
                          <Cell key={i} fill={CHART[i % CHART.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart msg="No location data yet" />
                )}
              </ChartCard>

              <ChartCard title="Extension Usage" description="Auto-fill clicks over time" icon={MousePointerClick}>
                {hasSeriesData(extension) ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={extension}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="value" name="Fills" stroke="#34d399" fill="#34d39933" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart msg="No extension usage yet" />
                )}
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

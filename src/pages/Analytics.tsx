import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
} from "recharts";
import {
  Briefcase, MapPin, TrendingUp, Users, Sparkles, Building2, Globe2,
  GraduationCap, ArrowUpRight, ArrowDownRight, FileText, Target, Activity,
} from "lucide-react";

// Sky blue palette
const SKY = ["#0EA5E9", "#38BDF8", "#7DD3FC", "#0284C7", "#0369A1", "#BAE6FD", "#075985", "#0891B2"];

type Range = "7" | "30" | "90" | "all";

function KPI({ icon: Icon, label, value, delta, hint }: any) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className="relative overflow-hidden border-sky-100 bg-white shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 to-sky-600" />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
            {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {typeof delta === "number" && (
          <div className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
            {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {Math.abs(delta).toFixed(1)}% vs prev period
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, description, icon: Icon, children, className = "" }: any) {
  return (
    <Card className={`border-sky-100 bg-white shadow-sm hover:shadow-md transition-shadow ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
          {Icon && <Icon className="h-4 w-4 text-sky-600" />} {title}
        </CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyState({ msg = "No data yet" }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <Activity className="h-10 w-10 mb-2 opacity-40" />
      <p className="text-sm">{msg}</p>
    </div>
  );
}

const tooltipStyle = { background: "white", border: "1px solid #BAE6FD", borderRadius: 8, fontSize: 12 };

// ---------- Classification helpers ----------
const DOMAIN_RULES: Array<[string, RegExp]> = [
  ["AI / ML", /\b(ai|ml|machine learning|data scien|nlp|llm|deep learning)\b/i],
  ["Software", /\b(software|developer|engineer|backend|frontend|fullstack|full-stack|web)\b/i],
  ["Design", /\b(design|ui|ux|figma|graphic|product designer)\b/i],
  ["Marketing", /\b(marketing|seo|content|social media|growth|brand)\b/i],
  ["Finance", /\b(finance|accountant|bank|audit|invest)\b/i],
  ["DevOps", /\b(devops|sre|cloud|aws|azure|kubernetes)\b/i],
  ["Sales", /\b(sales|business development|bd|account executive)\b/i],
];
const classifyDomain = (j: any) => {
  const txt = `${j.title || ""} ${j.description || ""} ${(j.skills || []).join(" ")}`;
  for (const [d, r] of DOMAIN_RULES) if (r.test(txt)) return d;
  return "Other";
};
const isRemote = (j: any) =>
  /\bremote|work from home|wfh\b/i.test(`${j.location || ""} ${j.title || ""} ${j.description || ""}`);
const expBucket = (j: any) => {
  const lvl = (j.experience_level || "").toLowerCase();
  if (/intern|fresh|entry|0/.test(lvl)) return "Fresher";
  if (/junior|jr|1|2/.test(lvl)) return "Junior";
  if (/mid|3|4|intermediate/.test(lvl)) return "Mid-Level";
  if (/senior|sr|5|6|lead|principal|staff/.test(lvl)) return "Senior";
  const t = `${j.title || ""}`.toLowerCase();
  if (/intern|fresher|entry/.test(t)) return "Fresher";
  if (/junior|jr\.?/.test(t)) return "Junior";
  if (/senior|sr\.?|lead|principal/.test(t)) return "Senior";
  return "Mid-Level";
};

const groupCount = <T,>(arr: T[], keyFn: (x: T) => string | undefined | null) => {
  const map: Record<string, number> = {};
  arr.forEach((x) => {
    const k = keyFn(x);
    if (!k) return;
    map[k] = (map[k] || 0) + 1;
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
};

const sinceDate = (range: Range) => {
  if (range === "all") return null;
  const d = new Date();
  d.setDate(d.getDate() - parseInt(range));
  return d.toISOString();
};

// ============================================================
export default function Analytics() {
  const { role, user } = useAuth();
  const [range, setRange] = useState<Range>("30");
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<any[]>([]);
  const [savedJobs, setSavedJobs] = useState<any[]>([]);

  useEffect(() => {
    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, role, user?.id]);

  const fetchAll = async () => {
    setLoading(true);
    const since = sinceDate(range);

    // Jobs (everyone)
    let jobsQ = supabase.from("jobs").select("*").eq("is_active", true);
    if (since) jobsQ = jobsQ.gte("created_at", since);
    const { data: jobsData } = await jobsQ.limit(1000);
    setJobs(jobsData || []);

    if (role === "recruiter" && user) {
      const { data: myJobs } = await supabase.from("jobs").select("id, title, created_at, is_active, location").eq("recruiter_id", user.id);
      setJobs(myJobs || []);
      const ids = (myJobs || []).map((j) => j.id);
      if (ids.length) {
        let appsQ = supabase.from("job_applications").select("*, jobs!inner(title, location, recruiter_id)").in("job_id", ids);
        if (since) appsQ = appsQ.gte("applied_at", since);
        const { data: apps } = await appsQ;
        setApplications(apps || []);
      } else setApplications([]);
    } else if (user) {
      // seeker
      let appliedQ = supabase.from("applied_jobs").select("*").eq("user_id", user.id);
      if (since) appliedQ = appliedQ.gte("applied_at", since);
      const { data: ap } = await appliedQ;
      setAppliedJobs(ap || []);
      const { data: sv } = await supabase.from("saved_jobs").select("*").eq("user_id", user.id);
      setSavedJobs(sv || []);
    }
    setLoading(false);
  };

  const isRecruiter = role === "recruiter";

  // ------- Seeker / market analytics -------
  const market = useMemo(() => {
    const locations = groupCount(jobs, (j) => j.location?.split(",")[0]?.trim()).slice(0, 8);
    const skillsMap: Record<string, number> = {};
    jobs.forEach((j) => (j.skills || []).forEach((s: string) => { skillsMap[s] = (skillsMap[s] || 0) + 1; }));
    const skills = Object.entries(skillsMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }));
    const domains = groupCount(jobs, classifyDomain);
    const remote = jobs.filter(isRemote).length;
    const onsite = jobs.length - remote;
    const exp = groupCount(jobs, expBucket);

    // trend (last N days)
    const days = range === "all" ? 30 : Math.min(parseInt(range), 90);
    const trend: { name: string; jobs: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const c = jobs.filter((j) => { const t = new Date(j.created_at); return t >= d && t < next; }).length;
      trend.push({ name: d.toLocaleDateString("en", { month: "short", day: "numeric" }), jobs: c });
    }

    const companies = groupCount(jobs, (j) => j.company).slice(0, 6);

    return { locations, skills, domains, remote, onsite, exp, trend, companies };
  }, [jobs, range]);

  // ------- Recruiter analytics -------
  const recruiterStats = useMemo(() => {
    const totalApps = applications.length;
    const activeJobs = jobs.filter((j) => j.is_active).length;
    const statusCount = groupCount(applications, (a) => a.status || "applied");
    const topJobs = groupCount(applications, (a: any) => a.jobs?.title).slice(0, 6);
    const days = range === "all" ? 30 : Math.min(parseInt(range), 90);
    const trend: { name: string; apps: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const c = applications.filter((a) => { const t = new Date(a.applied_at); return t >= d && t < next; }).length;
      trend.push({ name: d.toLocaleDateString("en", { month: "short", day: "numeric" }), apps: c });
    }
    const funnel = ["applied", "reviewed", "shortlisted", "interview", "offer", "hired"].map((s) => ({
      name: s.charAt(0).toUpperCase() + s.slice(1),
      value: applications.filter((a) => (a.status || "applied").toLowerCase() === s).length,
    }));
    const hired = funnel.find((f) => f.name === "Hired")?.value || 0;
    const conversion = totalApps ? (hired / totalApps) * 100 : 0;
    const candidateLocs = groupCount(applications, (a: any) => a.jobs?.location?.split(",")[0]?.trim()).slice(0, 6);
    return { totalApps, activeJobs, statusCount, topJobs, trend, funnel, conversion, candidateLocs };
  }, [applications, jobs, range]);

  // ------- Seeker personal stats -------
  const seekerStats = useMemo(() => {
    const totalApplied = appliedJobs.length;
    const totalSaved = savedJobs.length;
    const platforms = groupCount(appliedJobs, (a) => a.platform || "Other").slice(0, 6);
    const days = range === "all" ? 30 : Math.min(parseInt(range), 90);
    const trend: { name: string; apps: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const c = appliedJobs.filter((a) => { const t = new Date(a.applied_at); return t >= d && t < next; }).length;
      trend.push({ name: d.toLocaleDateString("en", { month: "short", day: "numeric" }), apps: c });
    }
    return { totalApplied, totalSaved, platforms, trend };
  }, [appliedJobs, savedJobs, range]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-900">
              {isRecruiter ? "Recruiter Analytics" : "Job Market Analytics"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {isRecruiter
                ? "Track applications, funnel performance, and hiring conversion."
                : "Live insights from active job listings & your applications."}
            </p>
          </div>
          <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
            <TabsList className="bg-sky-50 border border-sky-100">
              <TabsTrigger value="7">7d</TabsTrigger>
              <TabsTrigger value="30">30d</TabsTrigger>
              <TabsTrigger value="90">90d</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : isRecruiter ? (
          <RecruiterView stats={recruiterStats} />
        ) : (
          <SeekerView market={market} personal={seekerStats} />
        )}
      </div>
    </DashboardLayout>
  );
}

// ============================================================
function SeekerView({ market, personal }: any) {
  return (
    <>
      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPI icon={Briefcase} label="Active Jobs" value={market.skills.reduce((a: number, _: any) => a, 0) || (market.domains.reduce((s: number, d: any) => s + d.value, 0))} hint="Across the platform" />
        <KPI icon={Globe2} label="Remote Roles" value={market.remote} hint={`${market.onsite} onsite`} />
        <KPI icon={FileText} label="My Applications" value={personal.totalApplied} hint={`${personal.totalSaved} saved`} />
        <KPI icon={Sparkles} label="Top Skill" value={market.skills[0]?.name || "—"} hint={market.skills[0] ? `${market.skills[0].value} listings` : ""} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Job Demand Trend" description="New job postings over time" icon={TrendingUp} className="lg:col-span-2">
          {market.trend.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={market.trend}>
                <defs>
                  <linearGradient id="skyArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0F2FE" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="jobs" stroke="#0EA5E9" strokeWidth={2} fill="url(#skyArea)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>

        <ChartCard title="Remote vs Onsite" icon={Globe2}>
          {market.remote + market.onsite > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={[{ name: "Remote", value: market.remote }, { name: "Onsite", value: market.onsite }]}
                  cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  <Cell fill="#0EA5E9" />
                  <Cell fill="#7DD3FC" />
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Top Skills in Demand" icon={Sparkles}>
          {market.skills.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={market.skills} layout="vertical" margin={{ left: 70 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0F2FE" />
                <XAxis type="number" stroke="#94A3B8" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#475569" fontSize={11} width={70} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="#0EA5E9" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>

        <ChartCard title="Jobs by Location" icon={MapPin}>
          {market.locations.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie data={market.locations} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {market.locations.map((_: any, i: number) => <Cell key={i} fill={SKY[i % SKY.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Jobs by Domain" icon={Building2}>
          {market.domains.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={market.domains}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0F2FE" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="#38BDF8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>

        <ChartCard title="Experience Level Demand" icon={GraduationCap}>
          {market.exp.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={market.exp}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0F2FE" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="#0284C7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Top Hiring Companies" icon={Building2}>
          {market.companies.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={market.companies} layout="vertical" margin={{ left: 90 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0F2FE" />
                <XAxis type="number" stroke="#94A3B8" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#475569" fontSize={11} width={90} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="#0369A1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>

        <ChartCard title="My Application Activity" description="Your applications over time" icon={Activity}>
          {personal.trend.some((p: any) => p.apps > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={personal.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0F2FE" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="apps" stroke="#0EA5E9" strokeWidth={3} dot={{ fill: "#0EA5E9", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState msg="Apply to jobs to see your activity" />}
        </ChartCard>
      </div>
    </>
  );
}

// ============================================================
function RecruiterView({ stats }: any) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPI icon={FileText} label="Total Applications" value={stats.totalApps} hint="In selected range" />
        <KPI icon={Briefcase} label="Active Jobs" value={stats.activeJobs} />
        <KPI icon={Target} label="Conversion Rate" value={`${stats.conversion.toFixed(1)}%`} hint="Applied → Hired" />
        <KPI icon={Users} label="Hired" value={stats.funnel.find((f: any) => f.name === "Hired")?.value || 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Application Trend" icon={TrendingUp} className="lg:col-span-2">
          {stats.trend.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={stats.trend}>
                <defs>
                  <linearGradient id="recArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0F2FE" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="apps" stroke="#0EA5E9" strokeWidth={2} fill="url(#recArea)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>

        <ChartCard title="Application Status" icon={Activity}>
          {stats.statusCount.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={stats.statusCount} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={95} paddingAngle={2}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {stats.statusCount.map((_: any, i: number) => <Cell key={i} fill={SKY[i % SKY.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Hiring Funnel" description="Candidates by stage" icon={Target}>
          {stats.funnel.some((f: any) => f.value > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.funnel} layout="vertical" margin={{ left: 70 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0F2FE" />
                <XAxis type="number" stroke="#94A3B8" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#475569" fontSize={11} width={70} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {stats.funnel.map((_: any, i: number) => <Cell key={i} fill={SKY[i % SKY.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>

        <ChartCard title="Top Performing Job Posts" icon={Briefcase}>
          {stats.topJobs.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.topJobs} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0F2FE" />
                <XAxis type="number" stroke="#94A3B8" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#475569" fontSize={11} width={100} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" fill="#0284C7" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Candidate Locations" icon={MapPin}>
          {stats.candidateLocs.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={stats.candidateLocs} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={11}>
                  {stats.candidateLocs.map((_: any, i: number) => <Cell key={i} fill={SKY[i % SKY.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>

        <ChartCard title="Performance Snapshot" icon={Activity}>
          <div className="space-y-4 py-2">
            {[
              { label: "Avg Applications / Job", value: stats.activeJobs ? (stats.totalApps / stats.activeJobs).toFixed(1) : "0" },
              { label: "Shortlisted", value: stats.funnel.find((f: any) => f.name === "Shortlisted")?.value || 0 },
              { label: "In Interview", value: stats.funnel.find((f: any) => f.name === "Interview")?.value || 0 },
              { label: "Offers Extended", value: stats.funnel.find((f: any) => f.name === "Offer")?.value || 0 },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between p-3 rounded-lg bg-sky-50/60 border border-sky-100">
                <span className="text-sm text-slate-600">{s.label}</span>
                <span className="font-bold text-sky-700">{s.value}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </>
  );
}

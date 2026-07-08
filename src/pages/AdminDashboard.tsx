import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Briefcase, TrendingUp, Shield, MousePointerClick } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, jobs: 0, applications: 0, fillClicks: 0, fieldsFilled: 0 });
  const [fieldBreakdown, setFieldBreakdown] = useState<{ field: string; count: number }[]>([]);
  const [topUsers, setTopUsers] = useState<{ email: string; clicks: number; fields: number }[]>([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const [usersRes, jobsRes, appsRes, usageRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("jobs").select("id", { count: "exact", head: true }),
      supabase.from("job_applications").select("id", { count: "exact", head: true }),
      supabase.from("extension_usage").select("email,fields,field_count").limit(1000),
    ]);
    const usage = usageRes.data || [];
    const totalFields = usage.reduce((s, r: any) => s + (r.field_count || 0), 0);
    const fieldMap: Record<string, number> = {};
    const userMap: Record<string, { clicks: number; fields: number }> = {};
    usage.forEach((r: any) => {
      (r.fields || []).forEach((f: string) => { fieldMap[f] = (fieldMap[f] || 0) + 1; });
      const e = r.email || "unknown";
      if (!userMap[e]) userMap[e] = { clicks: 0, fields: 0 };
      userMap[e].clicks += 1;
      userMap[e].fields += r.field_count || 0;
    });
    setStats({
      users: usersRes.count || 0,
      jobs: jobsRes.count || 0,
      applications: appsRes.count || 0,
      fillClicks: usage.length,
      fieldsFilled: totalFields,
    });
    setFieldBreakdown(
      Object.entries(fieldMap).map(([field, count]) => ({ field, count })).sort((a, b) => b.count - a.count)
    );
    setTopUsers(
      Object.entries(userMap)
        .map(([email, v]) => ({ email, ...v }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 10)
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" /> Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Platform overview and management</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-card hover:shadow-card-hover transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
              <Users className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display">{stats.users}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card hover:shadow-card-hover transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Jobs</CardTitle>
              <Briefcase className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display">{stats.jobs}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card hover:shadow-card-hover transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Applications</CardTitle>
              <TrendingUp className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display">{stats.applications}</div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2 mt-4">
            <MousePointerClick className="h-6 w-6 text-primary" /> Extension Usage
          </h2>
          <p className="text-muted-foreground text-sm">Auto-fill activity from the JobAI browser extension</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Fill Clicks</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-bold font-display">{stats.fillClicks}</div></CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Fields Filled</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-bold font-display">{stats.fieldsFilled}</div></CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader><CardTitle className="text-base">Fields Filled (Breakdown)</CardTitle></CardHeader>
            <CardContent>
              {fieldBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Field</TableHead><TableHead className="text-right">Times Filled</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {fieldBreakdown.map((r) => (
                      <TableRow key={r.field}><TableCell className="capitalize">{r.field.replace(/_/g, " ")}</TableCell><TableCell className="text-right font-medium">{r.count}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader><CardTitle className="text-base">Top Users by Fill Clicks</CardTitle></CardHeader>
            <CardContent>
              {topUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>User</TableHead><TableHead className="text-right">Clicks</TableHead><TableHead className="text-right">Fields</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {topUsers.map((u) => (
                      <TableRow key={u.email}><TableCell className="truncate max-w-[200px]">{u.email}</TableCell><TableCell className="text-right font-medium">{u.clicks}</TableCell><TableCell className="text-right">{u.fields}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

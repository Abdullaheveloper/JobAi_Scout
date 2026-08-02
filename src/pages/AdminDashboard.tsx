import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { MixedDir } from "@/components/MixedDir";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Briefcase, Shield, MousePointerClick, UserCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

type UsageRecord = {
  field_count: number;
};

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState({ users: 0, jobs: 0, fillClicks: 0, fieldsFilled: 0, pending: 0 });
  const fetchInProgress = useRef(false);

  const fetchStats = useCallback(async () => {
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;

    try {
      const [usersRes, jobsRes, pendingRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("jobs").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
      ]);

      // Supabase limits a select to 1,000 rows by default. Read every page so the
      // admin totals always represent the complete persisted form-fill history.
      const usage: UsageRecord[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("extension_usage")
          .select("field_count")
          .order("created_at", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        usage.push(...(data || []));
        if (!data || data.length < pageSize) break;
      }

      const totalFields = usage.reduce((sum, record) => sum + (record.field_count || 0), 0);
      setStats({
        users: usersRes.count || 0,
        jobs: jobsRes.count || 0,
        fillClicks: usage.length,
        fieldsFilled: totalFields,
        pending: pendingRes.count || 0,
      });
    } finally {
      fetchInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    void fetchStats();

    // Re-fetch immediately after database changes. The interval is a fallback
    // for projects where Realtime replication has not been enabled for this table.
    const channel = supabase
      .channel("admin-dashboard-live-records")
      .on("postgres_changes", { event: "*", schema: "public", table: "extension_usage" }, () => void fetchStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => void fetchStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => void fetchStats())
      .subscribe();
    const pollingId = window.setInterval(() => void fetchStats(), 15_000);

    return () => {
      window.clearInterval(pollingId);
      void supabase.removeChannel(channel);
    };
  }, [fetchStats]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" /> {t("admin.dashboardTitle")}
          </h1>
          <p className="text-muted-foreground mt-1">
            <MixedDir>{t("admin.dashboardSubtitle")}</MixedDir>
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-card hover:shadow-card-hover transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.totalUsers")}</CardTitle>
              <Users className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display">{stats.users}</div>
            </CardContent>
          </Card>
          <Link to="/admin/users?filter=pending" className="block">
            <Card className="shadow-card hover:shadow-card-hover transition-shadow border-amber-500/20 h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.pendingApprovals")}</CardTitle>
                <UserCheck className="h-5 w-5 text-amber-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-display text-amber-300">{stats.pending}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <MixedDir>{t("admin.openManageUsersPending")}</MixedDir>
                </p>
              </CardContent>
            </Card>
          </Link>
          <Card className="shadow-card hover:shadow-card-hover transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin.totalJobs")}</CardTitle>
              <Briefcase className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-display">{stats.jobs}</div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2 mt-4">
            <MousePointerClick className="h-6 w-6 text-primary" /> {t("admin.extensionUsage")}
          </h2>
          <p className="text-muted-foreground text-sm">
            <MixedDir>{t("admin.extensionUsageSubtitle")}</MixedDir>
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{t("admin.totalFillClicks")}</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-bold font-display">{stats.fillClicks}</div></CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{t("admin.totalFieldsFilled")}</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-bold font-display">{stats.fieldsFilled}</div></CardContent>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}

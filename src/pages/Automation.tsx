import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Pencil, Plus } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ScheduleCard } from "@/components/automation/ScheduleCard";
import { ScheduleFormDialog } from "@/components/automation/ScheduleFormDialog";
import { useTranslation } from "react-i18next";
import {
  deleteSchedule, listSchedules, toFormState, toggleScheduleActive,
  type JobScrapeSchedule, type ScheduleFormState,
} from "@/lib/job-scrape-schedule";

export default function Automation() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<JobScrapeSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<JobScrapeSchedule | null>(null);
  const [editingForm, setEditingForm] = useState<ScheduleFormState | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setSchedules(await listSchedules(user.id));
    } catch (error) {
      toast({ title: t("automation.toastLoadFailed"), description: error instanceof Error ? error.message : t("common.tryAgain"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast, t]);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => { setEditing(null); setEditingForm(null); setDialogOpen(true); };
  const openEdit = (schedule: JobScrapeSchedule) => { setEditing(schedule); setEditingForm(toFormState(schedule)); setDialogOpen(true); };

  const handleToggle = async (schedule: JobScrapeSchedule, isActive: boolean) => {
    setTogglingId(schedule.id);
    setSchedules((current) => current.map((item) => item.id === schedule.id ? { ...item, is_active: isActive } : item));
    try {
      await toggleScheduleActive(schedule.id, isActive);
      await load();
    } catch (error) {
      toast({ title: t("automation.toastUpdateFailed"), description: error instanceof Error ? error.message : t("common.tryAgain"), variant: "destructive" });
      await load();
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (schedule: JobScrapeSchedule) => {
    setSchedules((current) => current.filter((item) => item.id !== schedule.id));
    try {
      await deleteSchedule(schedule.id);
      toast({ title: t("automation.toastDeleted") });
    } catch (error) {
      toast({ title: t("automation.toastDeleteFailed"), description: error instanceof Error ? error.message : t("common.tryAgain"), variant: "destructive" });
      await load();
    }
  };

  const missingProfile = !profile?.desired_roles?.length || !profile?.location;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in pb-8">
        <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card px-6 py-7 shadow-card md:px-8 md:py-9">
          <div className="absolute -end-16 -top-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <Clock className="h-3.5 w-3.5" /> {t("automation.eyebrow")}
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{t("automation.title")}</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground md:text-base">
                {t("automation.subtitle")}
              </p>
            </div>
            <Button onClick={openCreate} className="gap-2 border-0 shadow-lg shadow-primary/20 gradient-primary">
              <Plus className="h-4 w-4" /> {t("automation.newSchedule")}
            </Button>
          </div>
        </section>

        <Card className="border-border/80 bg-card/90 shadow-card">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 md:p-5">
            <p className="text-sm text-muted-foreground">
              {t("automation.profileUses", {
                role: profile?.desired_roles?.[0] || t("automation.noRoleSet"),
                location: profile?.location || t("automation.noLocationSet"),
              })}
            </p>
            {missingProfile && (
              <Button asChild variant="outline" size="sm" className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
                <Link to="/dashboard/settings"><Pencil className="h-3.5 w-3.5" /> {t("automation.completeProfile")}</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" /></div>
        ) : schedules.length === 0 ? (
          <Card className="border-border/80 bg-card shadow-card">
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <Clock className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium text-foreground">{t("automation.emptyTitle")}</p>
              <p className="max-w-sm text-sm text-muted-foreground">{t("automation.emptyBody")}</p>
              <Button onClick={openCreate} className="mt-2 gap-2 border-0 gradient-primary">
                <Plus className="h-4 w-4" /> {t("automation.newSchedule")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                toggling={togglingId === schedule.id}
                onToggle={(isActive) => handleToggle(schedule, isActive)}
                onEdit={() => openEdit(schedule)}
                onDelete={() => handleDelete(schedule)}
              />
            ))}
          </div>
        )}
      </div>

      {user && (
        <ScheduleFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          userId={user.id}
          editing={editing}
          initialFormState={editingForm}
          onSaved={load}
        />
      )}
    </DashboardLayout>
  );
}

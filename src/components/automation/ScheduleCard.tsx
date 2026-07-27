import { CalendarClock, Loader2, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatNextRun, recurrenceSummary, type JobScrapeSchedule } from "@/lib/job-scrape-schedule";

interface ScheduleCardProps {
  schedule: JobScrapeSchedule;
  toggling: boolean;
  onToggle: (isActive: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ScheduleCard({ schedule, toggling, onToggle, onEdit, onDelete }: ScheduleCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="group overflow-hidden border-border/80 bg-card shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-card-hover">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4 md:p-5">
        <div className="flex min-w-0 items-center gap-3">
          {toggling ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              checked={schedule.is_active}
              onCheckedChange={onToggle}
              aria-label={t("automation.toggleSchedule", { name: schedule.name })}
            />
          )}
          <div className="min-w-0">
            {/* User-entered schedule name — intentionally not translated */}
            <p className="truncate font-medium text-foreground">{schedule.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 truncate">{recurrenceSummary(schedule, t)}</span>
            </p>
            <p className="mt-1 text-xs font-medium text-primary">
              {schedule.is_active
                ? t("automation.nextSearch", { when: formatNextRun(schedule.next_run_at, t) })
                : t("automation.paused")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label={t("automation.editSchedule")}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive hover:text-destructive" aria-label={t("automation.deleteSchedule")}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

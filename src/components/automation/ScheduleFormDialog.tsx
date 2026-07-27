import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { RecurrenceFields } from "./RecurrenceFields";
import {
  createSchedule, emptyScheduleForm, previewNextRun, toScheduleInput, updateSchedule,
  type JobScrapeSchedule, type ScheduleFormState,
} from "@/lib/job-scrape-schedule";

interface ScheduleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  editing: JobScrapeSchedule | null;
  initialFormState: ScheduleFormState | null;
  onSaved: () => void;
}

export function ScheduleFormDialog({ open, onOpenChange, userId, editing, initialFormState, onSaved }: ScheduleFormDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [form, setForm] = useState<ScheduleFormState>(emptyScheduleForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initialFormState || emptyScheduleForm());
  }, [open, initialFormState]);

  const patch = (update: Partial<ScheduleFormState>) => setForm((current) => ({ ...current, ...update }));

  const validate = (): string | null => {
    if (!form.name.trim()) return t("automation.validationName");
    if ((form.uiType === "specific_days" || form.uiType === "weekly") && form.daysOfWeek.length === 0) return t("automation.validationDays");
    if (form.uiType === "once" && !form.runDate) return t("automation.validationOnceDate");
    if (form.uiType === "monthly" && form.monthlyMode === "once" && !form.runDate) return t("automation.validationMonthlyDate");
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      toast({ title: t("automation.toastCheckTitle"), description: validationError, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const input = toScheduleInput(form);
      if (editing) await updateSchedule(editing.id, input);
      else await createSchedule(userId, input);
      toast({
        title: editing ? t("automation.toastSavedUpdate") : t("automation.toastSavedCreate"),
        description: t("automation.toastSavedBody", { preview: previewNextRun(form, t) }),
      });
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast({
        title: t("automation.toastSaveFailed"),
        description: error instanceof Error ? error.message : t("common.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-border bg-card">
        <DialogHeader>
          <DialogTitle>{editing ? t("automation.dialogEditTitle") : t("automation.dialogNewTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="schedule-name">{t("automation.nameLabel")}</Label>
            <Input
              id="schedule-name"
              value={form.name}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder={t("automation.namePlaceholder")}
              className="border-border bg-background"
            />
          </div>

          <RecurrenceFields form={form} onChange={patch} />

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/80 bg-background/60 px-3 py-2.5 text-sm">
            <Switch checked={form.isActive} onCheckedChange={(isActive) => patch({ isActive })} />
            <span>{form.isActive ? t("automation.active") : t("automation.paused")}</span>
          </label>

          <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            {t("automation.preview", { when: previewNextRun(form, t) })}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{t("automation.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2 border-0 gradient-primary">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? t("automation.saveChanges") : t("automation.createSchedule")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
  const { toast } = useToast();
  const [form, setForm] = useState<ScheduleFormState>(emptyScheduleForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initialFormState || emptyScheduleForm());
  }, [open, initialFormState]);

  const patch = (update: Partial<ScheduleFormState>) => setForm((current) => ({ ...current, ...update }));

  const validate = (): string | null => {
    if (!form.name.trim()) return "Give this schedule a name.";
    if ((form.uiType === "specific_days" || form.uiType === "weekly") && form.daysOfWeek.length === 0) return "Select at least one day.";
    if (form.uiType === "once" && !form.runDate) return "Pick a date for this one-time search.";
    if (form.uiType === "monthly" && form.monthlyMode === "once" && !form.runDate) return "Pick a date for this month's search.";
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      toast({ title: "Check your schedule", description: validationError, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const input = toScheduleInput(form);
      if (editing) await updateSchedule(editing.id, input);
      else await createSchedule(userId, input);
      toast({ title: editing ? "Schedule updated" : "Schedule created", description: `Automated searches will run: ${previewNextRun(form)}.` });
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast({ title: "Could not save schedule", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-border bg-card">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit schedule" : "New automation schedule"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="schedule-name">Name</Label>
            <Input
              id="schedule-name"
              value={form.name}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder="e.g. Weekday mornings"
              className="border-border bg-background"
            />
          </div>

          <RecurrenceFields form={form} onChange={patch} />

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/80 bg-background/60 px-3 py-2.5 text-sm">
            <Switch checked={form.isActive} onCheckedChange={(isActive) => patch({ isActive })} />
            <span>{form.isActive ? "Active" : "Paused"}</span>
          </label>

          <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            Preview: <span className="font-medium text-foreground">{previewNextRun(form)}</span>
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2 border-0 gradient-primary">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Create schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

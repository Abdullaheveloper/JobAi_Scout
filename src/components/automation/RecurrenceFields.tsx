import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { DayChipSelect } from "./DayChipSelect";
import type { RecurrenceUiType, ScheduleFormState } from "@/lib/job-scrape-schedule";

const pillClass = "h-8 rounded-full border border-border/80 bg-card px-3 text-xs data-[state=on]:border-primary/60 data-[state=on]:bg-primary/20 data-[state=on]:text-primary";

interface RecurrenceFieldsProps {
  form: ScheduleFormState;
  onChange: (patch: Partial<ScheduleFormState>) => void;
}

export function RecurrenceFields({ form, onChange }: RecurrenceFieldsProps) {
  const { t } = useTranslation();

  const recurrenceOptions: Array<{ value: RecurrenceUiType; label: string }> = [
    { value: "once", label: t("automation.once") },
    { value: "daily", label: t("automation.daily") },
    { value: "specific_days", label: t("automation.specificDays") },
    { value: "weekly", label: t("automation.weekly") },
    { value: "monthly", label: t("automation.monthly") },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t("automation.repeats")}</Label>
        <ToggleGroup
          type="single"
          value={form.uiType}
          onValueChange={(value) => value && onChange({ uiType: value as RecurrenceUiType, daysOfWeek: [] })}
          className="flex-wrap justify-start gap-2"
        >
          {recurrenceOptions.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value} className={pillClass}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {form.uiType === "specific_days" && (
        <div className="space-y-2">
          <Label>{t("automation.onTheseDays")}</Label>
          <DayChipSelect value={form.daysOfWeek} onChange={(daysOfWeek) => onChange({ daysOfWeek })} multiple />
        </div>
      )}

      {form.uiType === "weekly" && (
        <div className="space-y-2">
          <Label>{t("automation.onThisDay")}</Label>
          <DayChipSelect value={form.daysOfWeek} onChange={(daysOfWeek) => onChange({ daysOfWeek })} multiple={false} />
        </div>
      )}

      {form.uiType === "monthly" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("automation.monthlyOption")}</Label>
            <RadioGroup
              value={form.monthlyMode}
              onValueChange={(value) => onChange({ monthlyMode: value as "repeat" | "once" })}
              className="grid grid-flow-col auto-cols-max gap-2"
            >
              {([
                { value: "repeat" as const, label: t("automation.repeatEveryMonth") },
                { value: "once" as const, label: t("automation.onlyThisMonth") },
              ]).map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
                    form.monthlyMode === option.value
                      ? "border-primary/60 bg-primary/20 text-primary"
                      : "border-border/80 bg-card text-muted-foreground",
                  )}
                >
                  <RadioGroupItem value={option.value} className="sr-only" />
                  {option.label}
                </label>
              ))}
            </RadioGroup>
          </div>

          {form.monthlyMode === "repeat" ? (
            <div className="space-y-2">
              <Label htmlFor="schedule-day-of-month">{t("automation.dayOfMonth")}</Label>
              <Input
                id="schedule-day-of-month"
                type="number"
                min={1}
                max={31}
                value={form.dayOfMonth}
                onChange={(event) => onChange({ dayOfMonth: Math.min(31, Math.max(1, Number(event.target.value) || 1)) })}
                className="w-24 border-border bg-background"
              />
              <p className="text-xs text-muted-foreground">{t("automation.shorterMonthsHint")}</p>
            </div>
          ) : (
            <DatePickerField label={t("automation.date")} value={form.runDate} onChange={(runDate) => onChange({ runDate })} />
          )}
        </div>
      )}

      {form.uiType === "once" && (
        <DatePickerField label={t("automation.date")} value={form.runDate} onChange={(runDate) => onChange({ runDate })} />
      )}

      <div className="space-y-2">
        <Label htmlFor="schedule-time">{t("automation.timeOfDay")}</Label>
        <Input
          id="schedule-time"
          type="time"
          value={form.timeOfDay}
          onChange={(event) => onChange({ timeOfDay: event.target.value })}
          className="w-40 border-border bg-background"
        />
        <p className="text-xs text-muted-foreground">
          {t("automation.timezoneHint", { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
        </p>
      </div>
    </div>
  );
}

function DatePickerField({ label, value, onChange }: { label: string; value: Date | undefined; onChange: (date: Date | undefined) => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn("w-56 justify-start gap-2 border-border bg-background text-start font-normal", !value && "text-muted-foreground")}
          >
            <CalendarIcon className="h-4 w-4" />
            {value ? format(value, "PPP") : t("automation.pickDate")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto border-border bg-card p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }} initialFocus />
        </PopoverContent>
      </Popover>
    </div>
  );
}

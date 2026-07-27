import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { DAY_OPTION_KEYS } from "@/lib/job-scrape-schedule";

interface DayChipSelectProps {
  value: number[];
  onChange: (days: number[]) => void;
  multiple?: boolean;
}

/**
 * Day-of-week chip picker shared by "Specific days" (multi-select) and
 * "Weekly" (single-select) recurrence modes. Plain buttons rather than
 * ToggleGroup so one component can serve both selection modes via `multiple`.
 */
export function DayChipSelect({ value, onChange, multiple = true }: DayChipSelectProps) {
  const { t } = useTranslation();

  const toggle = (day: number) => {
    if (multiple) {
      onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort());
    } else {
      onChange([day]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {DAY_OPTION_KEYS.map((day) => {
        const selected = value.includes(day.value);
        return (
          <button
            key={day.value}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(day.value)}
            className={cn(
              "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
              selected
                ? "border-primary/60 bg-primary/20 text-primary"
                : "border-border/80 bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
            )}
          >
            {t(day.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

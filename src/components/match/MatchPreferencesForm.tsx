import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_MIN_MATCH_THRESHOLD,
  MATCH_CATEGORIES,
  SKILLS_MIN_WEIGHT,
  normalizeMatchWeights,
  sumMatchWeights,
  validateMatchPreferences,
  type MatchWeights,
} from "@/lib/match-preferences";
import { cn } from "@/lib/utils";

export type MatchPreferencesFormValue = {
  matchWeights: MatchWeights;
  minMatchThreshold: number;
};

type MatchPreferencesFormProps = {
  initialWeights?: MatchWeights;
  initialThreshold?: number;
  /** Blocking first-run mode: Save only, no Cancel */
  mode: "blocking" | "edit";
  saving?: boolean;
  onSave: (value: MatchPreferencesFormValue) => void | Promise<void>;
  onCancel?: () => void;
  className?: string;
};

export function MatchPreferencesForm({
  initialWeights = {},
  initialThreshold = DEFAULT_MIN_MATCH_THRESHOLD,
  mode,
  saving = false,
  onSave,
  onCancel,
  className,
}: MatchPreferencesFormProps) {
  const { t } = useTranslation();
  const [weights, setWeights] = useState<MatchWeights>(() => normalizeMatchWeights(initialWeights));
  const [threshold, setThreshold] = useState(() =>
    Math.min(100, Math.max(0, Math.round(Number(initialThreshold) || DEFAULT_MIN_MATCH_THRESHOLD))),
  );
  const [notice, setNotice] = useState<string | null>(null);

  const total = useMemo(() => sumMatchWeights(weights), [weights]);
  const validation = validateMatchPreferences(weights);
  const isValid = validation.ok;

  const setCategoryWeight = (key: string, value: number) => {
    setNotice(null);
    setWeights((current) => {
      const next = { ...current };
      const rounded = Math.round(value);
      if (rounded <= 0) delete next[key];
      else next[key] = rounded;
      return next;
    });
  };

  const describeInvalid = (): string => {
    if (validation.ok) return "";
    if (validation.code === "skills_required") {
      return t("matchPreferences.validation.skillsRequired");
    }
    if (validation.code === "skills_too_low") {
      return t("matchPreferences.validation.skillsTooLow", { min: SKILLS_MIN_WEIGHT });
    }
    if (validation.total < 100) {
      return t("matchPreferences.validation.sumShort", {
        total: validation.total,
        remaining: 100 - validation.total,
      });
    }
    return t("matchPreferences.validation.sumOver", {
      total: validation.total,
      excess: validation.total - 100,
    });
  };

  const handleSave = async () => {
    if (!isValid) {
      setNotice(describeInvalid());
      return;
    }
    setNotice(null);
    await onSave({ matchWeights: normalizeMatchWeights(weights), minMatchThreshold: threshold });
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground" dir="auto">
            {t("matchPreferences.runningTotal", { total })}
          </p>
          <p className={cn(
            "text-sm font-semibold tabular-nums",
            total === 100 ? "text-success" : total > 100 ? "text-destructive" : "text-warning",
          )}>
            {total}%
          </p>
        </div>
        <Progress value={Math.min(100, total)} className={cn(total === 100 && "[&>div]:bg-success")} />
        <p className="text-xs text-muted-foreground" dir="auto">{t("matchPreferences.runningTotalHint")}</p>
      </div>

      <div className="space-y-5">
        {MATCH_CATEGORIES.map((category) => {
          const value = Number(weights[category.key]) || 0;
          return (
            <div key={category.key} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`match-weight-${category.key}`} className="text-sm text-foreground">
                  {t(`matchPreferences.categories.${category.labelKey}`)}
                  {category.mandatory ? (
                    <span className="ms-1 text-xs text-primary">({t("matchPreferences.mandatory")})</span>
                  ) : null}
                </Label>
                <span className="text-sm font-medium tabular-nums text-muted-foreground">{value}%</span>
              </div>
              <Slider
                id={`match-weight-${category.key}`}
                min={0}
                max={100}
                step={1}
                value={[value]}
                onValueChange={(next) => setCategoryWeight(category.key, next[0] ?? 0)}
                aria-label={t(`matchPreferences.categories.${category.labelKey}`)}
              />
              {category.key === "skills" ? (
                <p className="text-xs text-muted-foreground" dir="auto">
                  {t("matchPreferences.skillsHint", { min: SKILLS_MIN_WEIGHT })}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="space-y-2 border-t border-border pt-5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="match-threshold" className="text-sm text-foreground">
            {t("matchPreferences.thresholdLabel")}
          </Label>
          <span className="text-sm font-medium tabular-nums text-muted-foreground">{threshold}%</span>
        </div>
        <Slider
          id="match-threshold"
          min={0}
          max={100}
          step={1}
          value={[threshold]}
          onValueChange={(next) => setThreshold(next[0] ?? DEFAULT_MIN_MATCH_THRESHOLD)}
          aria-label={t("matchPreferences.thresholdLabel")}
        />
        <p className="text-xs text-muted-foreground" dir="auto">{t("matchPreferences.thresholdHint")}</p>
      </div>

      {notice ? (
        <p role="alert" dir="auto" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {notice}
        </p>
      ) : !isValid ? (
        <p className="text-xs text-muted-foreground" dir="auto">{describeInvalid()}</p>
      ) : (
        <p className="text-xs text-success" dir="auto">{t("matchPreferences.readyToSave")}</p>
      )}

      <div className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        mode === "blocking" && "sticky bottom-0 -mx-1 border-t border-border bg-card/95 px-1 pt-3 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:backdrop-blur-none sm:justify-stretch",
      )}>
        {mode === "edit" && onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving} className="min-h-11 sm:min-h-10">
            {t("common.cancel")}
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || (!isValid && mode === "blocking")}
          className={cn("min-h-11 sm:min-h-10", mode === "blocking" && "w-full sm:flex-1")}
        >
          {saving ? t("matchPreferences.saving") : t("matchPreferences.save")}
        </Button>
      </div>
    </div>
  );
}

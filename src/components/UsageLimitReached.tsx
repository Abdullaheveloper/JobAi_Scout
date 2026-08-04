import { Link } from "react-router-dom";
import { Clock, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  formatUsageCount,
  formatUsageLimitReset,
  usageLimitTitle,
  type UsageLimitViewModel,
} from "@/lib/usage-limits-client";

export type UsageLimitReachedProps = UsageLimitViewModel & {
  variant?: "banner" | "dialog";
  open?: boolean;
  onDismiss?: () => void;
  className?: string;
};

function UsageLimitBody({
  featureName,
  used,
  max,
  period,
  resetsAt,
  disabled,
  t,
  locale,
}: UsageLimitViewModel & { t: ReturnType<typeof useTranslation>["t"]; locale: string }) {
  const title = usageLimitTitle(featureName, t);
  const usageCopy = formatUsageCount(used, max, period, featureName, t);
  const resetCopy = formatUsageLimitReset(resetsAt, period, { locale, t });

  return (
    <>
      <p className="text-sm leading-6 text-muted-foreground" dir="auto">
        {usageCopy}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-indigo-300/90" dir="auto">
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {resetCopy}
      </p>
      <span className="sr-only">{title}</span>
    </>
  );
}

export function UsageLimitReached({
  featureName,
  used,
  max,
  period = "day",
  resetsAt = null,
  disabled = false,
  variant = "banner",
  open = true,
  onDismiss,
  className,
}: UsageLimitReachedProps) {
  const { t, i18n } = useTranslation();
  const title = usageLimitTitle(featureName, t);
  const Icon = disabled ? Lock : Clock;
  const viewModel: UsageLimitViewModel = { featureName, used, max, period, resetsAt, disabled };

  const actions = (
    <div className="flex w-full flex-wrap items-center justify-end gap-2">
      <Button
        asChild
        size="sm"
        className="whitespace-nowrap border-0 bg-gradient-to-r from-indigo-500 to-violet-500 px-4 text-white shadow-md shadow-indigo-500/20 hover:brightness-110"
      >
        <Link to="/contact" onClick={onDismiss}>
          {t("usageLimits.upgradePlan", { defaultValue: "Upgrade plan" })}
        </Link>
      </Button>
      {onDismiss && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDismiss}
          className="whitespace-nowrap border-indigo-400/25 bg-transparent px-4 text-foreground hover:bg-indigo-500/10"
        >
          {t("usageLimits.gotIt", { defaultValue: "Got it" })}
        </Button>
      )}
    </div>
  );

  if (variant === "dialog") {
    return (
      <Dialog open={open} onOpenChange={(next) => { if (!next) onDismiss?.(); }}>
        <DialogContent
          className="border-indigo-500/25 bg-card sm:max-w-md"
          aria-live="polite"
          data-testid="usage-limit-dialog"
        >
          <DialogHeader className="text-start">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <DialogTitle className="font-display text-lg text-foreground" dir="auto">
              {title}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-1 pt-1">
                <UsageLimitBody {...viewModel} t={t} locale={i18n.language} />
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">{actions}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="usage-limit-banner"
      className={cn(
        "rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/50 via-card/90 to-card/80 p-4 shadow-[inset_0_1px_0_rgba(129,140,248,.12)]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-sm font-semibold leading-5 text-foreground" dir="auto">
            {title}
          </h3>
          <UsageLimitBody {...viewModel} t={t} locale={i18n.language} />
        </div>
      </div>
      <div className="mt-4 border-t border-indigo-500/15 pt-3">
        {actions}
      </div>
    </div>
  );
}

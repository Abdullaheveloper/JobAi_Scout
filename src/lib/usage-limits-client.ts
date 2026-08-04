import { toast } from "@/hooks/use-toast";

export const USAGE_FEATURES = [
  "job_scraping",
  "form_fill",
  "chat_bot",
  "voice_bot",
  "automation",
] as const;

export type UsageFeature = (typeof USAGE_FEATURES)[number];
export type UsagePeriod = "day" | "week" | "month" | "year";

export const FEATURE_LABELS: Record<UsageFeature, string> = {
  job_scraping: "Job Scraping",
  form_fill: "Form Fill",
  chat_bot: "Chat Bot",
  voice_bot: "Voice Bot",
  automation: "Automation",
};

export function isUsageFeature(value: unknown): value is UsageFeature {
  return typeof value === "string" && (USAGE_FEATURES as readonly string[]).includes(value);
}

export type UsageLimitErrorPayload = {
  code?: string;
  error?: string;
  feature?: string;
  featureLabel?: string;
  limit?: number;
  period?: UsagePeriod;
  used?: number;
  resetsAt?: string | null;
};

export function isUsageLimitError(payload: unknown): payload is UsageLimitErrorPayload {
  if (!payload || typeof payload !== "object") return false;
  const body = payload as UsageLimitErrorPayload;
  return (
    body.code === "USAGE_LIMIT_REACHED" ||
    (typeof body.feature === "string" && isUsageFeature(body.feature) && typeof body.limit === "number")
  );
}

function defaultResetHint(period: UsagePeriod): string {
  switch (period) {
    case "day":
      return "Try again tomorrow.";
    case "month":
      return "Try again next month.";
    case "year":
      return "Try again next year.";
  }
}

export type UsageLimitViewModel = {
  featureName: string;
  used: number;
  max: number;
  period: UsagePeriod;
  resetsAt: string | null;
  disabled: boolean;
};

type TranslateFn = (key: string, opts?: Record<string, unknown>) => string;

export function buildUsageLimitViewModel(
  payload: UsageLimitErrorPayload,
  t?: TranslateFn,
): UsageLimitViewModel {
  const feature = (payload.feature && isUsageFeature(payload.feature)
    ? payload.feature
    : "job_scraping") as UsageFeature;
  const featureName =
    payload.featureLabel ||
    (t
      ? t(`admin.usageFeature_${feature}`, { defaultValue: FEATURE_LABELS[feature] })
      : FEATURE_LABELS[feature]);
  const max = typeof payload.limit === "number" ? payload.limit : 0;
  const used = typeof payload.used === "number" ? payload.used : max;
  return {
    featureName,
    used,
    max,
    period: payload.period || "day",
    resetsAt: payload.resetsAt ?? null,
    disabled: max <= 0,
  };
}

function periodScopeLabel(period: UsagePeriod, t?: TranslateFn): string {
  if (t) {
    return t(`usageLimits.periodLabel_${period}`, {
      defaultValue: period === "day" ? "today" : period === "week" ? "this week" : period === "month" ? "this month" : "this year",
    });
  }
  return period === "day" ? "today" : period === "month" ? "this month" : "this year";
}

/** Human-readable "You've used X of Y today" copy. */
export function formatUsageCount(
  used: number,
  max: number,
  period: UsagePeriod,
  featureName: string,
  t?: TranslateFn,
): string {
  if (max <= 0) {
    return t
      ? t("usageLimits.usageCountDisabled", {
          feature: featureName,
          defaultValue: `${featureName} is disabled for your account.`,
        })
      : `${featureName} is disabled for your account.`;
  }
  const scope = periodScopeLabel(period, t);
  return t
    ? t("usageLimits.usageCount", {
        used,
        max,
        period: scope,
        defaultValue: `You've used ${used} of ${max} ${scope}`,
      })
    : `You've used ${used} of ${max} ${scope}`;
}

/** Compute reset copy from resetsAt (preferred) or period fallback. */
export function formatUsageLimitReset(
  resetsAt: string | null | undefined,
  period: UsagePeriod,
  options?: { now?: Date; locale?: string; t?: TranslateFn },
): string {
  const { now = new Date(), locale, t } = options ?? {};

  if (!resetsAt) {
    if (t) {
      return t(`usageLimits.reset_${period}`, { defaultValue: defaultResetHint(period) });
    }
    return defaultResetHint(period);
  }

  const resetDate = new Date(resetsAt);
  if (Number.isNaN(resetDate.getTime())) {
    return t ? t(`usageLimits.reset_${period}`, { defaultValue: defaultResetHint(period) }) : defaultResetHint(period);
  }

  const diffMs = resetDate.getTime() - now.getTime();
  if (diffMs <= 0) {
    return t ? t("usageLimits.resetSoon", { defaultValue: "Resets soon." }) : "Resets soon.";
  }

  const totalMinutes = Math.ceil(diffMs / 60_000);
  if (totalMinutes < 24 * 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) {
      return t
        ? t("usageLimits.resetIn", {
            hours,
            minutes,
            defaultValue: `Resets in ${hours}h ${minutes}m`,
          })
        : `Resets in ${hours}h ${minutes}m`;
    }
    if (hours > 0) {
      return t
        ? t("usageLimits.resetInHours", { hours, defaultValue: `Resets in ${hours}h` })
        : `Resets in ${hours}h`;
    }
    return t
      ? t("usageLimits.resetInMinutes", { minutes, defaultValue: `Resets in ${minutes}m` })
      : `Resets in ${minutes}m`;
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    resetDate.getDate() === tomorrow.getDate() &&
    resetDate.getMonth() === tomorrow.getMonth() &&
    resetDate.getFullYear() === tomorrow.getFullYear();
  const time = resetDate.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });

  if (isTomorrow) {
    return t
      ? t("usageLimits.resetTomorrow", { time, defaultValue: `Resets tomorrow at ${time}` })
      : `Resets tomorrow at ${time}`;
  }

  const date = resetDate.toLocaleDateString(locale, { month: "short", day: "numeric" });
  return t
    ? t("usageLimits.resetOnDate", { date, time, defaultValue: `Resets ${date} at ${time}` })
    : `Resets ${date} at ${time}`;
}

export function usageLimitTitle(featureName: string, t?: TranslateFn): string {
  return t
    ? t("usageLimits.limitReachedTitle", {
        feature: featureName,
        defaultValue: `${featureName} limit reached`,
      })
    : `${featureName} limit reached`;
}

export function usageLimitToastMessage(
  payload: UsageLimitErrorPayload,
  t?: (key: string, opts?: Record<string, unknown>) => string,
): { title: string; description: string } {
  const feature = (payload.feature && isUsageFeature(payload.feature)
    ? payload.feature
    : "job_scraping") as UsageFeature;
  const featureLabel =
    payload.featureLabel ||
    (t ? t(`admin.usageFeature_${feature}`, { defaultValue: FEATURE_LABELS[feature] }) : FEATURE_LABELS[feature]);
  const period = payload.period || "day";

  const title = t
    ? t("usageLimits.toastTitle", { defaultValue: "Usage limit reached" })
    : "Usage limit reached";

  // Prefer localized copy from structured fields so users never see English
  // server messages when a translator function is available.
  let description: string;
  if (t) {
    if (payload.limit === 0) {
      description = t("usageLimits.blocked", {
        feature: featureLabel,
        defaultValue: `${featureLabel} is disabled for your account.`,
      });
    } else {
      const periodLabel = t(`usageLimits.period_${period}`, {
        defaultValue: period === "day" ? "daily" : period === "week" ? "weekly" : period === "month" ? "monthly" : "yearly",
      });
      const reset = t(`usageLimits.reset_${period}`, {
        defaultValue: defaultResetHint(period),
      });
      description = t("usageLimits.reached", {
        feature: featureLabel,
        period: periodLabel,
        reset,
        defaultValue: `You've reached your ${periodLabel} limit for ${featureLabel}. ${reset}`,
      });
    }
  } else if (payload.error) {
    description = payload.error;
  } else if (payload.limit === 0) {
    description = `${featureLabel} is disabled for your account.`;
  } else {
    const periodWord = period === "day" ? "daily" : period === "week" ? "weekly" : period === "month" ? "monthly" : "yearly";
    description = `You've reached your ${periodWord} limit for ${featureLabel}. ${defaultResetHint(period)}`;
  }

  return { title, description };
}

/** Medium, non-blocking toast (~7s), manually dismissible. */
export function showUsageLimitToast(
  payload: UsageLimitErrorPayload,
  t?: (key: string, opts?: Record<string, unknown>) => string,
) {
  const { title, description } = usageLimitToastMessage(payload, t);
  toast({
    title,
    description,
    duration: 7000,
  });
}

/** Parse invoke/fetch error bodies that may carry USAGE_LIMIT_REACHED. */
export async function extractUsageLimitError(
  error: unknown,
  data?: unknown,
): Promise<UsageLimitErrorPayload | null> {
  if (isUsageLimitError(data)) return data;

  const context = (error as { context?: Response })?.context;
  if (context && typeof context.clone === "function") {
    const details = await context.clone().json().catch(() => null);
    if (isUsageLimitError(details)) return details;
  }

  if (isUsageLimitError(error)) return error;
  return null;
}

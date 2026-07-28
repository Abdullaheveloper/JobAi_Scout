/**
 * Feature usage limits — pure helpers + service-role enforcement.
 * Used by edge functions; unit-tested via Vitest (no Deno APIs in pure path).
 */

export const USAGE_FEATURES = [
  "job_scraping",
  "form_fill",
  "voice_assistant",
  "automation",
] as const;

export type UsageFeature = (typeof USAGE_FEATURES)[number];
export type UsagePeriod = "day" | "month" | "year";

export const FEATURE_LABELS: Record<UsageFeature, string> = {
  job_scraping: "Job Scraping",
  form_fill: "Form Fill",
  voice_assistant: "Voice Assistant",
  automation: "Automation",
};

export type UsageLimitRow = {
  user_id: string | null;
  feature: UsageFeature;
  max_count: number;
  period: UsagePeriod;
};

export type ResolvedLimit = {
  maxCount: number;
  period: UsagePeriod;
  source: "user" | "global" | "unlimited";
};

export type UsageLimitErrorBody = {
  code: "USAGE_LIMIT_REACHED";
  error: string;
  feature: UsageFeature;
  featureLabel: string;
  limit: number;
  period: UsagePeriod;
  used: number;
  resetsAt: string | null;
};

export function isUsageFeature(value: unknown): value is UsageFeature {
  return typeof value === "string" && (USAGE_FEATURES as readonly string[]).includes(value);
}

export function isUsagePeriod(value: unknown): value is UsagePeriod {
  return value === "day" || value === "month" || value === "year";
}

/** Rolling window lengths (not calendar boundaries). */
export function periodDurationMs(period: UsagePeriod): number {
  switch (period) {
    case "day":
      return 24 * 60 * 60 * 1000;
    case "month":
      return 30 * 24 * 60 * 60 * 1000;
    case "year":
      return 365 * 24 * 60 * 60 * 1000;
  }
}

export function windowStart(now: Date, period: UsagePeriod): Date {
  return new Date(now.getTime() - periodDurationMs(period));
}

/**
 * Resolve limit: user-specific → global default → unlimited.
 * Logs a warning when falling through to unlimited so it is never silent.
 */
export function resolveUsageLimit(
  feature: UsageFeature,
  userId: string,
  rows: UsageLimitRow[],
  warn: (message: string) => void = console.warn,
): ResolvedLimit {
  const userRow = rows.find((row) => row.user_id === userId && row.feature === feature);
  if (userRow) {
    return { maxCount: userRow.max_count, period: userRow.period, source: "user" };
  }

  const globalRow = rows.find((row) => row.user_id == null && row.feature === feature);
  if (globalRow) {
    return { maxCount: globalRow.max_count, period: globalRow.period, source: "global" };
  }

  warn(
    `[usage-limits] No limit configured for feature=${feature} user=${userId}; allowing unlimited`,
  );
  return { maxCount: Number.POSITIVE_INFINITY, period: "day", source: "unlimited" };
}

export function countUsageInWindow(
  timestamps: Array<string | Date>,
  now: Date,
  period: UsagePeriod,
): number {
  const startMs = windowStart(now, period).getTime();
  return timestamps.filter((ts) => new Date(ts).getTime() >= startMs).length;
}

/**
 * When at/over the limit, next availability is when the oldest event still
 * inside the rolling window ages out. maxCount 0 → blocked indefinitely.
 */
export function nextAvailableAt(
  timestamps: Array<string | Date>,
  now: Date,
  period: UsagePeriod,
  maxCount: number,
): Date | null {
  if (!Number.isFinite(maxCount) || maxCount < 0) return now;
  if (maxCount === 0) return null;

  const startMs = windowStart(now, period).getTime();
  const inWindow = timestamps
    .map((ts) => new Date(ts).getTime())
    .filter((t) => t >= startMs)
    .sort((a, b) => a - b);

  if (inWindow.length < maxCount) return now;

  const oldestBlocking = inWindow[inWindow.length - maxCount];
  return new Date(oldestBlocking + periodDurationMs(period));
}

export function periodResetPhrase(period: UsagePeriod, resetsAt: Date | null): string {
  if (!resetsAt) {
    return period === "day"
      ? "This feature is blocked."
      : "This feature is blocked for your account.";
  }
  switch (period) {
    case "day":
      return "Try again tomorrow.";
    case "month":
      return `Try again after ${resetsAt.toISOString()}.`;
    case "year":
      return `Try again after ${resetsAt.toISOString()}.`;
  }
}

export function buildUsageLimitError(args: {
  feature: UsageFeature;
  limit: number;
  period: UsagePeriod;
  used: number;
  resetsAt: Date | null;
}): UsageLimitErrorBody {
  const featureLabel = FEATURE_LABELS[args.feature];
  const periodWord =
    args.period === "day" ? "daily" : args.period === "month" ? "monthly" : "yearly";
  const resetPhrase = periodResetPhrase(args.period, args.resetsAt);
  const message =
    args.limit === 0
      ? `${featureLabel} is disabled for your account.`
      : `You've reached your ${periodWord} limit for ${featureLabel}. ${resetPhrase}`;

  return {
    code: "USAGE_LIMIT_REACHED",
    error: message,
    feature: args.feature,
    featureLabel,
    limit: args.limit,
    period: args.period,
    used: args.used,
    resetsAt: args.resetsAt ? args.resetsAt.toISOString() : null,
  };
}

export function isAllowedByLimit(used: number, maxCount: number): boolean {
  if (!Number.isFinite(maxCount)) return true;
  if (maxCount <= 0) return false;
  return used < maxCount;
}

// deno-lint-ignore no-explicit-any
export type UsageLimitsDb = {
  from: (table: string) => any;
  /** Prefer atomic RPC when present (service-role clients). */
  rpc?: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export type EnforceResult =
  | { allowed: true; used: number; resolved: ResolvedLimit }
  | { allowed: false; status: 429; body: UsageLimitErrorBody };

type RpcEnforcePayload = {
  allowed: boolean;
  used: number;
  source: "user" | "global" | "unlimited";
  maxCount?: number | null;
  period?: UsagePeriod;
  resetsAt?: string | null;
};

/**
 * Load limits for user+globals, count rolling usage, optionally append a log row.
 *
 * Prefer the Postgres RPC `enforce_and_record_feature_usage` when available so
 * check + insert are serialized with an advisory lock (closes the TOCTOU race
 * for record:true callers). Falls back to the multi-query path for unit tests
 * / older DBs. Deferred-record flows (check with record:false, then
 * recordUsageLog after success) remain non-atomic by design.
 */
export async function enforceUsageLimit(
  admin: UsageLimitsDb,
  userId: string,
  feature: UsageFeature,
  options: { record?: boolean; now?: Date; warn?: (message: string) => void } = {},
): Promise<EnforceResult> {
  const now = options.now ?? new Date();
  const warn = options.warn ?? console.warn;
  const record = options.record !== false;

  if (typeof admin.rpc === "function") {
    const { data, error } = await admin.rpc("enforce_and_record_feature_usage", {
      p_user_id: userId,
      p_feature: feature,
      p_record: record,
      p_now: now.toISOString(),
    });
    if (!error) {
      const payload = data as RpcEnforcePayload;
      if (payload?.source === "unlimited") {
        warn(
          `[usage-limits] No limit configured for feature=${feature} user=${userId}; allowing unlimited`,
        );
        return {
          allowed: true,
          used: 0,
          resolved: { maxCount: Number.POSITIVE_INFINITY, period: "day", source: "unlimited" },
        };
      }
      const period = (payload.period || "day") as UsagePeriod;
      const maxCount = typeof payload.maxCount === "number" ? payload.maxCount : 0;
      const resolved: ResolvedLimit = {
        maxCount,
        period,
        source: payload.source === "user" ? "user" : "global",
      };
      if (!payload.allowed) {
        const resetsAt = payload.resetsAt ? new Date(payload.resetsAt) : null;
        return {
          allowed: false,
          status: 429,
          body: buildUsageLimitError({
            feature,
            limit: maxCount,
            period,
            used: payload.used ?? 0,
            resetsAt,
          }),
        };
      }
      return { allowed: true, used: payload.used ?? 0, resolved };
    }
    // Migration not applied yet — fall through to non-atomic multi-query path.
    if (!/enforce_and_record_feature_usage|Could not find the function|PGRST202|404/i.test(error.message)) {
      throw new Error(`Failed to enforce usage limit: ${error.message}`);
    }
    warn(`[usage-limits] RPC unavailable (${error.message}); using non-atomic fallback`);
  }

  const { data: limitRows, error: limitsError } = await admin
    .from("feature_usage_limits")
    .select("user_id, feature, max_count, period")
    .or(`user_id.eq.${userId},user_id.is.null`);

  if (limitsError) {
    throw new Error(`Failed to load usage limits: ${limitsError.message}`);
  }

  const rows = ((limitRows || []) as UsageLimitRow[]).filter((row) => row.feature === feature);
  const resolved = resolveUsageLimit(feature, userId, rows, warn);

  // Unlimited: optionally still record for analytics, never block.
  if (resolved.source === "unlimited") {
    if (record) {
      await insertUsageLogRow(admin, userId, feature);
    }
    return { allowed: true, used: 0, resolved };
  }

  const since = windowStart(now, resolved.period).toISOString();
  const { data: logRows, error: logError } = await admin
    .from("feature_usage_log")
    .select("created_at")
    .eq("user_id", userId)
    .eq("feature", feature)
    .gte("created_at", since);

  if (logError) {
    throw new Error(`Failed to load usage log: ${logError.message}`);
  }

  const timestamps = ((logRows || []) as Array<{ created_at: string }>).map((row) => row.created_at);
  const used = countUsageInWindow(timestamps, now, resolved.period);

  if (!isAllowedByLimit(used, resolved.maxCount)) {
    const resetsAt = nextAvailableAt(timestamps, now, resolved.period, resolved.maxCount);
    return {
      allowed: false,
      status: 429,
      body: buildUsageLimitError({
        feature,
        limit: resolved.maxCount,
        period: resolved.period,
        used,
        resetsAt,
      }),
    };
  }

  if (record) {
    await insertUsageLogRow(admin, userId, feature);
  }

  return { allowed: true, used, resolved };
}

/**
 * Insert one usage log row and verify a row was returned.
 * Without `.select()`, PostgREST can report success with zero rows when RLS
 * blocks the write — treat missing data as a hard failure.
 */
export async function insertUsageLogRow(
  admin: UsageLimitsDb,
  userId: string,
  feature: UsageFeature,
): Promise<void> {
  const { data, error } = await admin
    .from("feature_usage_log")
    .insert({ user_id: userId, feature })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to record usage: ${error.message}`);
  if (!data?.id) {
    throw new Error("Failed to record usage: insert returned no row (possible RLS block)");
  }
}

/** Append a usage log row after an allowed invocation succeeded. */
export async function recordUsageLog(
  admin: UsageLimitsDb,
  userId: string,
  feature: UsageFeature,
): Promise<void> {
  await insertUsageLogRow(admin, userId, feature);
}

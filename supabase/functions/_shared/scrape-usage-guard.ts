/**
 * Shared scrape entry gate: usage limit FIRST, then scrape (+ match scoring).
 * Manual Browse Jobs and Automation-triggered scrapes both use this so the
 * order cannot drift and a limit miss never wastes adapter / scoring work.
 */
import {
  enforceUsageLimit,
  recordUsageLog,
  type EnforceResult,
  type UsageFeature,
  type UsageLimitErrorBody,
  type UsageLimitsDb,
} from "./usage-limits.ts";
import type { ScrapeOrchestrationResult } from "./scrape-orchestrator.ts";

/** Features that meter scrape invocations. */
export type ScrapeUsageFeature = Extract<UsageFeature, "job_scraping" | "automation">;

export type GuardedScrapeDenied = {
  allowed: false;
  status: 429;
  body: UsageLimitErrorBody;
};

export type GuardedScrapeAllowed = {
  allowed: true;
  result: ScrapeOrchestrationResult;
};

export type GuardedScrapeOutcome = GuardedScrapeDenied | GuardedScrapeAllowed;

/**
 * 1. Resolve + enforce usage limit for the scrape feature.
 * 2. Only if allowed, invoke `run` (orchestration: adapters → score → threshold).
 * 3. Record usage after a session actually started (not conflict / no_query).
 *
 * When denied, `run` is never called — no scraping and no match filtering.
 */
export async function runUsageGuardedScrape(args: {
  admin: UsageLimitsDb;
  userId: string;
  feature: ScrapeUsageFeature;
  run: () => Promise<ScrapeOrchestrationResult>;
  now?: Date;
  warn?: (message: string) => void;
}): Promise<GuardedScrapeOutcome> {
  const usage: EnforceResult = await enforceUsageLimit(args.admin, args.userId, args.feature, {
    record: false,
    now: args.now,
    warn: args.warn,
  });

  if (!usage.allowed) {
    return { allowed: false, status: usage.status, body: usage.body };
  }

  const result = await args.run();

  if (result.status !== "conflict" && result.status !== "no_query") {
    await recordUsageLog(args.admin, args.userId, args.feature);
  }

  return { allowed: true, result };
}

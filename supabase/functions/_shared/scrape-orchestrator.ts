import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { collectLinkedInJobs } from "./adapters/linkedin-apify.adapter.ts";
import { collectIndeedJobs } from "./adapters/indeed-apify.adapter.ts";
import { collectRssJobs } from "./adapters/rss.adapter.ts";
import { collectCompanyCareerJobs, collectCompanyCareerSources } from "./adapters/company-career.adapter.ts";
import { deduplicateJobs, duplicateKey, upsertCollectedJobs, type NormalizedJob } from "./job-collection.ts";
import { calculateJobMatch, type MatchProfile } from "./job-match-scoring.ts";
import {
  DEFAULT_MIN_MATCH_THRESHOLD,
  clampThreshold,
  normalizeMatchPreferences,
  type MatchWeights,
} from "./match-preferences.ts";
import { JOB_ADAPTER_ORDER, runSequentialAdapters, type JobAdapterKey } from "./job-scrape-plan.ts";

type AdapterPayload = { jobs: NormalizedJob[]; errors: string[] };
type SourceRow = { id: string; source_type: string; name: string; url: string | null };
export type SupabaseAdmin = ReturnType<typeof createClient>;
type ExclusionSummary = { optional_filters: number; invalid_or_duplicate: number; career_level: number; below_match_score: number; display_eligible: number };

export type ScrapeOrchestrationParams = {
  admin: SupabaseAdmin;         // service-role client; used for every write regardless of caller
  userId: string;
  query: string | null;         // sanitized query, or null to derive from profile.desired_roles[0]
  location: string | null;      // sanitized location, or null to fall back to profile.location
  jobType: string;              // "all" | "full-time" | "part-time" | "contract" | "internship"
  workMode: string;             // "all" | "remote" | "hybrid"
  maxItems: number;
  adapters?: JobAdapterKey[];
  scheduleId?: string | null;   // stamped onto job_scrape_sessions.schedule_id when present
};

export type ScrapeOrchestrationResult = {
  status: "completed" | "partially_completed" | "failed" | "stopped" | "conflict" | "no_query";
  session: Record<string, unknown> | null;
};

function sanitizeInput(value: unknown, maxLength: number): string {
  return Array.from(String(value || ""), (character) => character.charCodeAt(0) < 32 ? " " : character).join("")
    .replace(/[<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function friendlyAdapterError(key: JobAdapterKey, error: Error): string {
  const message = error.message.toLowerCase();
  if (message.includes("429") || message.includes("rate") || message.includes("credit")) return `${key} reached its provider limit.`;
  if (message.includes("apify")) return `${key} needs its Apify token and actor configuration checked.`;
  if (message.includes("firecrawl")) return "Company Careers needs its Firecrawl API token checked.";
  if (message.includes("missing")) return `${key} is not configured on the server.`;
  if (message.includes("timeout") || message.includes("exceeded")) return `${key} took too long to respond.`;
  if (message.includes("no enabled")) return `No enabled ${key.replace(/_/g, " ")} sources are configured.`;
  return `${key.replace(/_/g, " ")} could not be collected.`;
}

function matchesOptionalFilters(job: NormalizedJob, jobType: string, workMode: string): boolean {
  if (jobType !== "all" && !String(job.job_type || "").toLowerCase().includes(jobType)) return false;
  if (workMode !== "all" && !`${job.work_mode || ""} ${job.location || ""}`.toLowerCase().includes(workMode)) return false;
  return true;
}

async function collectConfiguredSources(
  admin: SupabaseAdmin,
  sources: SourceRow[],
  sourceType: "rss" | "company_career",
  signal: AbortSignal,
  context: { query: string; location: string; maxItems: number },
  onProgress?: (payload: AdapterPayload) => void,
): Promise<AdapterPayload> {
  const configured = sources.filter((source) => source.source_type === sourceType && source.url);
  if (!configured.length) throw new Error(`No enabled ${sourceType.replace(/_/g, " ")} sources are configured`);

  const settled: Array<{ jobs: NormalizedJob[]; error: string | null } | undefined> = new Array(configured.length);
  const publishProgress = () => onProgress?.({
    jobs: settled.flatMap((result) => result?.jobs || []),
    errors: settled.flatMap((result) => result?.error ? [result.error] : []),
  });
  if (sourceType === "company_career") {
    const batchResults = await collectCompanyCareerSources(configured.map((source) => ({ id: source.id, name: source.name, url: source.url! })), signal, context);
    for (let index = 0; index < batchResults.length; index += 1) {
      const result = batchResults[index];
      const detail = result.error;
      await admin.from("job_sources").update({
        last_collected_at: new Date().toISOString(),
        last_result_count: result.jobs.length,
        last_error: detail ? detail.slice(0, 500) : null,
      }).eq("id", result.source.id);
      settled[index] = { jobs: result.jobs, error: detail ? `${result.source.name}: ${detail.slice(0, 240)}` : null };
      publishProgress();
    }
    const jobs = batchResults.flatMap((result) => result.jobs);
    const errors = batchResults.flatMap((result) => result.error ? [`${result.source.name}: ${result.error.slice(0, 240)}`] : []);
    if (!batchResults.some((result) => !result.error)) throw new Error(errors[0] || "All company career sources failed");
    return { jobs, errors };
  }
  const collectOne = async (source: SourceRow, index: number) => {
    try {
      const collected = sourceType === "rss"
        ? await collectRssJobs(source.url!, source.name, signal, context)
        : await collectCompanyCareerJobs(source.url!, source.name, signal);
      await admin.from("job_sources").update({
        last_collected_at: new Date().toISOString(),
        last_result_count: collected.length,
        last_error: null,
      }).eq("id", source.id);
      const result = { jobs: collected, error: null };
      settled[index] = result;
      publishProgress();
      return result;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Collection failed";
      console.error(`[scrape-orchestrator] ${sourceType}:${source.name}`, detail);
      await admin.from("job_sources").update({
        last_collected_at: new Date().toISOString(),
        last_result_count: 0,
        last_error: detail.slice(0, 500),
      }).eq("id", source.id);
      const result = { jobs: [] as NormalizedJob[], error: `${source.name}: ${detail.slice(0, 240)}` };
      settled[index] = result;
      publishProgress();
      return result;
    }
  };
  // RSS downloads are cheap and independent. Company sources are intentionally
  // sequential because their Firecrawl fallback has a strict requests/minute
  // quota; starting every company at once caused the observed 429 storm.
  const results = await Promise.all(configured.map(collectOne));
  const jobs = results.flatMap((result) => result.jobs);
  const errors = results.flatMap((result) => result.error ? [result.error] : []);
  const successfulSources = results.filter((result) => !result.error).length;
  if (!successfulSources) throw new Error(errors[0] || `All ${sourceType} sources failed`);
  return { jobs, errors };
}

/**
 * The exact sequence used by manual "Scrape Jobs" (LinkedIn -> Indeed -> RSS
 * -> Company Careers) and by scheduled automation runs. Both callers go
 * through this one function so the two paths can never drift apart.
 */
export async function runScrapeOrchestration(params: ScrapeOrchestrationParams): Promise<ScrapeOrchestrationResult> {
  const { admin, userId, jobType, workMode, maxItems, scheduleId = null } = params;
  const selectedAdapters = params.adapters?.length ? JOB_ADAPTER_ORDER.filter((key) => params.adapters!.includes(key)) : [...JOB_ADAPTER_ORDER];
  let sessionId: string | null = null;

  try {
    // An interrupted invocation must not block this user forever. A new
    // request can recover a session that has made no progress for 15 minutes.
    await admin.from("job_scrape_sessions").update({
      current_adapter: null,
      session_status: "failed",
      completed_at: new Date().toISOString(),
      adapter_errors: { system: ["The previous scrape stopped before it could finish."] },
    }).eq("user_id", userId)
      .in("session_status", ["pending", "running"])
      .lt("updated_at", new Date(Date.now() - 15 * 60_000).toISOString());

    const { data: activeSession } = await admin
      .from("job_scrape_sessions")
      .select("*")
      .eq("user_id", userId)
      .in("session_status", ["pending", "running"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeSession) return { status: "conflict", session: activeSession };

    const { data: profileData } = await admin
      .from("profiles")
      .select("skills, desired_roles, location, experience_years, education, expected_salary, match_weights, min_match_threshold, has_set_match_preferences")
      .eq("user_id", userId)
      .maybeSingle();
    const profile: MatchProfile = {
      skills: profileData?.skills,
      desired_roles: profileData?.desired_roles,
      location: profileData?.location,
      experience_years: profileData?.experience_years,
      education: profileData?.education,
      expected_salary: profileData?.expected_salary,
    };
    const matchPrefs = normalizeMatchPreferences(profileData || {});
    const matchWeights: MatchWeights = matchPrefs.matchWeights;
    const minMatchThreshold = clampThreshold(matchPrefs.minMatchThreshold ?? DEFAULT_MIN_MATCH_THRESHOLD);
    const hasSetMatchPreferences = matchPrefs.hasSetMatchPreferences;

    const query = sanitizeInput(params.query, 120) || sanitizeInput(profile.desired_roles?.[0], 120);
    if (!query) return { status: "no_query", session: null };
    const requestedLocation = sanitizeInput(params.location, 120);
    const effectiveLocation = requestedLocation || sanitizeInput(profile.location, 120) || "Pakistan";

    const initialStatuses = Object.fromEntries(JOB_ADAPTER_ORDER.map((key) => [key, selectedAdapters.includes(key) ? "waiting" : "stopped"]));
    const { data: createdSession, error: createError } = await admin.from("job_scrape_sessions").insert({
      user_id: userId,
      search_query: query,
      location: requestedLocation || null,
      session_status: "pending",
      adapter_statuses: initialStatuses,
      schedule_id: scheduleId,
    }).select("*").single();
    if (createError) {
      const { data: racedSession } = await admin.from("job_scrape_sessions").select("*")
        .eq("user_id", userId).in("session_status", ["pending", "running"]).limit(1).maybeSingle();
      if (racedSession) return { status: "conflict", session: racedSession };
      throw new Error(`Could not create scrape session: ${createError.message}`);
    }
    sessionId = createdSession.id;

    const { data: sourceRows, error: sourceError } = await admin
      .from("job_sources")
      .select("id, source_type, name, url")
      .eq("enabled", true)
      .in("source_type", ["rss", "company_career"])
      .order("last_result_count", { ascending: false, nullsFirst: false });
    if (sourceError) throw new Error(`Could not load configured sources: ${sourceError.message}`);
    const sources = (sourceRows || []) as SourceRow[];
    const keywords = [query, ...(profile.desired_roles || []).slice(0, 2)].filter(Boolean);

    const adapterStatuses: Record<JobAdapterKey, string> = { ...initialStatuses } as Record<JobAdapterKey, string>;
    const adapterErrors: Record<string, string[]> = {};
    let totalScraped = 0;
    let totalSaved = 0;
    let totalDisplayed = 0;
    let hadFailure = false;
    const exclusions: ExclusionSummary = { optional_filters: 0, invalid_or_duplicate: 0, career_level: 0, below_match_score: 0, display_eligible: 0 };
    let stopRequested = false;
    const partialPayloads: Record<JobAdapterKey, AdapterPayload> = {
      linkedin: { jobs: [], errors: [] },
      indeed: { jobs: [], errors: [] },
      rss: { jobs: [], errors: [] },
      company_career: { jobs: [], errors: [] },
    };
    const processedKeys = Object.fromEntries(JOB_ADAPTER_ORDER.map((key) => [key, new Set<string>()])) as Record<JobAdapterKey, Set<string>>;
    const processingChains = Object.fromEntries(JOB_ADAPTER_ORDER.map((key) => [key, Promise.resolve()])) as Record<JobAdapterKey, Promise<void>>;

    const processJobs = async (key: JobAdapterKey, incoming: NormalizedJob[], adapterIndex: number) => {
      const filtered = incoming.filter((job) => matchesOptionalFilters(job, jobType, workMode));
      exclusions.optional_filters += incoming.length - filtered.length;
      const deduplicated = deduplicateJobs(filtered);
      exclusions.invalid_or_duplicate += filtered.length - deduplicated.length;
      const uniqueJobs = deduplicated.filter((job) => {
        const identity = duplicateKey(job);
        if (processedKeys[key].has(identity)) return false;
        processedKeys[key].add(identity);
        return true;
      });
      totalScraped += uniqueJobs.length;
      if (!uniqueJobs.length) return;

      const scoredJobs = uniqueJobs.map((job) => {
        const match = calculateJobMatch(job, { query, location: requestedLocation || null, profile, matchWeights, hasSetMatchPreferences });
        return { job: { ...job, match_score: match.score, match_explanation: match.explanation }, match };
      });
      exclusions.below_match_score += scoredJobs.filter(({ match }) => match.score < minMatchThreshold).length;
      const acceptedJobs = scoredJobs.filter(({ match }) => match.score >= minMatchThreshold);
      exclusions.display_eligible += acceptedJobs.length;
      if (!acceptedJobs.length) return;

      const saved = await upsertCollectedJobs(acceptedJobs.map(({ job }) => job));
      const resultRows = saved.items.map((item, sourceResultOrder) => ({
        session_id: sessionId,
        user_id: userId,
        job_id: item.jobId,
        match_score: Number(item.job.match_score || 0),
        match_explanation: item.job.match_explanation || {},
        adapter_order: adapterIndex + 1,
        source_result_order: sourceResultOrder,
        published_at: item.job.posted_at,
        scraped_at: new Date().toISOString(),
      }));
      const { data: mapped, error: mappingError } = await admin.from("job_scrape_results")
        .upsert(resultRows, { onConflict: "session_id,job_id", ignoreDuplicates: true })
        .select("id");
      if (mappingError) throw new Error(`Could not save matched jobs: ${mappingError.message}`);
      totalSaved += mapped?.length || 0;
      const { count, error: countError } = await admin.from("job_scrape_results").select("id", { count: "exact", head: true }).eq("session_id", sessionId).gte("match_score", minMatchThreshold);
      if (countError) throw new Error(`Could not count visible jobs: ${countError.message}`);
      totalDisplayed = count || 0;
      await admin.from("job_scrape_sessions").update({ total_jobs_scraped: totalScraped, total_jobs_saved: totalSaved, total_jobs_displayed: totalDisplayed, exclusion_summary: exclusions }).eq("id", sessionId);
    };

    const enqueueJobs = (key: JobAdapterKey, jobs: NormalizedJob[]) => {
      const adapterIndex = selectedAdapters.indexOf(key);
      processingChains[key] = processingChains[key].then(() => processJobs(key, jobs, adapterIndex));
      return processingChains[key];
    };
    const rememberPartial = (key: JobAdapterKey, payload: AdapterPayload) => {
      partialPayloads[key] = payload;
      void enqueueJobs(key, payload.jobs).catch((error) => {
        const technical = error instanceof Error ? error : new Error("Partial job processing failed");
        console.error(`[scrape-orchestrator] ${key}:partial`, technical.message);
        adapterErrors[key] = [...(adapterErrors[key] || []), friendlyAdapterError(key, technical)];
      });
    };

    const isStopRequested = async () => {
      if (stopRequested) return true;
      const { data } = await admin.from("job_scrape_sessions")
        .select("session_status")
        .eq("id", sessionId)
        .maybeSingle();
      stopRequested = data?.session_status === "stopped";
      return stopRequested;
    };

    const adapters = [
      {
        key: "linkedin" as const,
        run: async (signal: AbortSignal): Promise<AdapterPayload> => {
          const jobs = await collectLinkedInJobs(keywords, [effectiveLocation], maxItems, { jobType, workMode }, signal, (partialJobs) => rememberPartial("linkedin", { jobs: partialJobs, errors: [] }));
          return { jobs, errors: [] };
        },
        getPartial: () => partialPayloads.linkedin,
      },
      {
        key: "indeed" as const,
        run: async (signal: AbortSignal): Promise<AdapterPayload> => {
          const jobs = await collectIndeedJobs(query, effectiveLocation, maxItems, signal, (partialJobs) => rememberPartial("indeed", { jobs: partialJobs, errors: [] }));
          return { jobs, errors: [] };
        },
        getPartial: () => partialPayloads.indeed,
      },
      {
        key: "rss" as const,
        run: (signal: AbortSignal) => collectConfiguredSources(admin, sources, "rss", signal, { query, location: effectiveLocation, maxItems }, (payload) => rememberPartial("rss", payload)),
        getPartial: () => partialPayloads.rss,
      },
      {
        key: "company_career" as const,
        run: (signal: AbortSignal) => collectConfiguredSources(admin, sources, "company_career", signal, { query, location: effectiveLocation, maxItems }, (payload) => rememberPartial("company_career", payload)),
        getPartial: () => partialPayloads.company_career,
      },
    ].filter((adapter) => selectedAdapters.includes(adapter.key));

    await admin.from("job_scrape_sessions").update({ session_status: "running" }).eq("id", sessionId);
    await runSequentialAdapters(adapters, {
      shouldStop: isStopRequested,
      onStart: async (key) => {
        adapterStatuses[key] = "running";
        await admin.from("job_scrape_sessions").update({
          current_adapter: key,
          session_status: "running",
          adapter_statuses: adapterStatuses,
        }).eq("id", sessionId);
      },
      onFinish: async (result, adapterIndex) => {
        const key = result.key;
        try {
          const payload = result.value || partialPayloads[key];
          if (payload.errors.length) {
            adapterErrors[key] = payload.errors;
            hadFailure = true;
          }

          await enqueueJobs(key, payload.jobs);
          // A configured-source adapter can partially succeed. Keep its useful
          // jobs and report source warnings without falsely marking it failed.
          adapterStatuses[key] = result.status;
          if (result.status === "timed_out" || result.status === "failed") {
            hadFailure = true;
            const technical = result.error || new Error(`Adapter ${result.status}`);
            adapterErrors[key] = [...(adapterErrors[key] || []), friendlyAdapterError(key, technical)];
          }
        } catch (error) {
          hadFailure = true;
          adapterStatuses[key] = result.status === "timed_out" || result.status === "stopped" ? result.status : "failed";
          const technical = error instanceof Error ? error : new Error("Adapter failed");
          console.error(`[scrape-orchestrator] ${key}`, technical.message);
          adapterErrors[key] = [...(adapterErrors[key] || []), friendlyAdapterError(key, technical)];
        }

        await admin.from("job_scrape_sessions").update({
          current_adapter: null,
          adapter_statuses: adapterStatuses,
          adapter_errors: adapterErrors,
          total_jobs_scraped: totalScraped,
          total_jobs_saved: totalSaved,
          total_jobs_displayed: totalDisplayed,
          exclusion_summary: exclusions,
        }).eq("id", sessionId);
        await isStopRequested();
      },
    });

    await isStopRequested();
    if (stopRequested) {
      for (const key of JOB_ADAPTER_ORDER) {
        if (adapterStatuses[key] === "waiting" || adapterStatuses[key] === "running") adapterStatuses[key] = "stopped";
      }
    }
    const failedCount = Object.values(adapterStatuses).filter((status) => status === "failed").length;
    const timedOutCount = Object.values(adapterStatuses).filter((status) => status === "timed_out").length;
    const finalStatus = stopRequested
      ? "stopped"
      : failedCount === selectedAdapters.length
      ? "failed"
      : hadFailure || failedCount > 0 || timedOutCount > 0
        ? "partially_completed"
        : "completed";
    const completedAt = new Date().toISOString();
    const { data: finalSession, error: finalError } = await admin.from("job_scrape_sessions").update({
      current_adapter: null,
      session_status: finalStatus,
      completed_at: completedAt,
      adapter_statuses: adapterStatuses,
      adapter_errors: adapterErrors,
      total_jobs_scraped: totalScraped,
      total_jobs_saved: totalSaved,
      total_jobs_displayed: totalDisplayed,
      exclusion_summary: exclusions,
    }).eq("id", sessionId).select("*").single();
    if (finalError) throw new Error(`Could not finish scrape session: ${finalError.message}`);

    await admin.from("job_searches").insert({
      user_id: userId,
      keyword: query,
      location: requestedLocation || null,
      results_count: totalDisplayed,
    });
    return { status: finalStatus as ScrapeOrchestrationResult["status"], session: finalSession };
  } catch (error) {
    const technical = error instanceof Error ? error : new Error("Job scraping failed");
    console.error("[scrape-orchestrator] fatal", technical.message);
    if (sessionId) {
      await admin.from("job_scrape_sessions").update({
        current_adapter: null,
        session_status: "failed",
        completed_at: new Date().toISOString(),
        adapter_errors: { system: ["The scraping session stopped unexpectedly."] },
      }).eq("id", sessionId);
    }
    return { status: "failed", session: sessionId ? { id: sessionId } : null };
  }
}

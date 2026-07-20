import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { collectLinkedInJobs } from "../_shared/adapters/linkedin-apify.adapter.ts";
import { collectIndeedJobs } from "../_shared/adapters/indeed-apify.adapter.ts";
import { collectRssJobs } from "../_shared/adapters/rss.adapter.ts";
import { collectCompanyCareerJobs } from "../_shared/adapters/company-career.adapter.ts";
import { deduplicateJobs, upsertCollectedJobs, type NormalizedJob } from "../_shared/job-collection.ts";
import { calculateJobMatch, type MatchProfile } from "../_shared/job-match-scoring.ts";
import { JOB_ADAPTER_ORDER, runSequentialAdapters, type JobAdapterKey } from "../_shared/job-scrape-plan.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AdapterPayload = { jobs: NormalizedJob[]; errors: string[] };
type SourceRow = { id: string; source_type: string; name: string; url: string | null };
type SupabaseAdmin = ReturnType<typeof createClient>;

const jsonResponse = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function sanitizeInput(value: unknown, maxLength: number): string {
  return Array.from(String(value || ""), (character) => character.charCodeAt(0) < 32 ? " " : character).join("")
    .replace(/[<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function friendlyAdapterError(key: JobAdapterKey, error: Error): string {
  const message = error.message.toLowerCase();
  if (message.includes("missing")) return `${key} is not configured on the server.`;
  if (message.includes("429") || message.includes("rate")) return `${key} reached its provider limit.`;
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
): Promise<AdapterPayload> {
  const configured = sources.filter((source) => source.source_type === sourceType && source.url);
  if (!configured.length) throw new Error(`No enabled ${sourceType.replace(/_/g, " ")} sources are configured`);

  const jobs: NormalizedJob[] = [];
  const errors: string[] = [];
  let successfulSources = 0;
  for (const source of configured) {
    try {
      const collected = sourceType === "rss"
        ? await collectRssJobs(source.url!, source.name)
        : await collectCompanyCareerJobs(source.url!, source.name);
      jobs.push(...collected);
      successfulSources += 1;
      await admin.from("job_sources").update({
        last_collected_at: new Date().toISOString(),
        last_result_count: collected.length,
        last_error: null,
      }).eq("id", source.id);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Collection failed";
      console.error(`[collect-jobs] ${sourceType}:${source.name}`, detail);
      errors.push(`${source.name}: this source was temporarily unavailable.`);
      await admin.from("job_sources").update({
        last_collected_at: new Date().toISOString(),
        last_result_count: 0,
        last_error: detail.slice(0, 500),
      }).eq("id", source.id);
    }
  }
  if (!successfulSources) throw new Error(errors[0] || `All ${sourceType} sources failed`);
  return { jobs, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let sessionId: string | null = null;
  let admin: SupabaseAdmin | null = null;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Please sign in before scraping jobs." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const client = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Your session expired. Please sign in again." }, 401);

    const input = await req.json().catch(() => ({}));
    const query = sanitizeInput(input.query, 120);
    const requestedLocation = sanitizeInput(input.location, 120);
    if (!query) return jsonResponse({ error: "Enter a skill, job title, or keyword before scraping jobs." }, 400);

    admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const serviceClient = admin;
    // An interrupted Edge invocation must not block this user forever. A new
    // request can recover a session that has made no progress for 15 minutes.
    await serviceClient.from("job_scrape_sessions").update({
      current_adapter: null,
      session_status: "failed",
      completed_at: new Date().toISOString(),
      adapter_errors: { system: ["The previous scrape stopped before it could finish."] },
    }).eq("user_id", user.id)
      .in("session_status", ["pending", "running"])
      .lt("updated_at", new Date(Date.now() - 15 * 60_000).toISOString());
    const { data: activeSession } = await serviceClient
      .from("job_scrape_sessions")
      .select("*")
      .eq("user_id", user.id)
      .in("session_status", ["pending", "running"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeSession) {
      return jsonResponse({ error: "A job scraping session is already running.", session: activeSession }, 409);
    }

    const { data: profileData } = await serviceClient
      .from("profiles")
      .select("skills, desired_roles, location, experience_years")
      .eq("user_id", user.id)
      .maybeSingle();
    const profile: MatchProfile = profileData || {};
    const effectiveLocation = requestedLocation || sanitizeInput(profile.location, 120) || "Pakistan";
    const jobType = ["full-time", "part-time", "contract", "internship"].includes(String(input.jobType).toLowerCase())
      ? String(input.jobType).toLowerCase()
      : "all";
    const workMode = ["remote", "hybrid"].includes(String(input.workMode).toLowerCase())
      ? String(input.workMode).toLowerCase()
      : "all";
    const maxItems = Math.min(Math.max(Number(input.maxItems) || 25, 1), 25);

    const initialStatuses = Object.fromEntries(JOB_ADAPTER_ORDER.map((key) => [key, "waiting"]));
    const { data: createdSession, error: createError } = await serviceClient.from("job_scrape_sessions").insert({
      user_id: user.id,
      search_query: query,
      location: requestedLocation || null,
      session_status: "pending",
      adapter_statuses: initialStatuses,
    }).select("*").single();
    if (createError) {
      const { data: racedSession } = await serviceClient.from("job_scrape_sessions").select("*")
        .eq("user_id", user.id).in("session_status", ["pending", "running"]).limit(1).maybeSingle();
      if (racedSession) return jsonResponse({ error: "A job scraping session is already running.", session: racedSession }, 409);
      throw new Error(`Could not create scrape session: ${createError.message}`);
    }
    sessionId = createdSession.id;

    const { data: sourceRows, error: sourceError } = await serviceClient
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

    const adapters = [
      {
        key: "linkedin" as const,
        run: async (): Promise<AdapterPayload> => ({
          jobs: await collectLinkedInJobs(keywords, [effectiveLocation], maxItems, { jobType, workMode }),
          errors: [],
        }),
      },
      {
        key: "indeed" as const,
        run: async (): Promise<AdapterPayload> => ({ jobs: await collectIndeedJobs(query, effectiveLocation, maxItems), errors: [] }),
      },
      { key: "rss" as const, run: () => collectConfiguredSources(serviceClient, sources, "rss") },
      { key: "company_career" as const, run: () => collectConfiguredSources(serviceClient, sources, "company_career") },
    ];

    await serviceClient.from("job_scrape_sessions").update({ session_status: "running" }).eq("id", sessionId);
    await runSequentialAdapters(adapters, {
      onStart: async (key) => {
        adapterStatuses[key] = "running";
        await serviceClient.from("job_scrape_sessions").update({
          current_adapter: key,
          session_status: "running",
          adapter_statuses: adapterStatuses,
        }).eq("id", sessionId);
      },
      onFinish: async (result, adapterIndex) => {
        const key = result.key;
        try {
          if (result.status === "failed" || !result.value) throw result.error || new Error("Adapter returned no result");
          const payload = result.value;
          totalScraped += payload.jobs.length;
          const adapterHadErrors = payload.errors.length > 0;
          if (payload.errors.length) {
            adapterErrors[key] = payload.errors;
            hadFailure = true;
          }

          const filtered = payload.jobs.filter((job) => matchesOptionalFilters(job, jobType, workMode));
          const uniqueJobs = deduplicateJobs(filtered);
          const saved = await upsertCollectedJobs(uniqueJobs);
          const resultRows = saved.items.map((item, sourceResultOrder) => {
            const match = calculateJobMatch(item.job, { query, location: requestedLocation || null, profile });
            return {
              session_id: sessionId,
              user_id: user.id,
              job_id: item.jobId,
              match_score: match.score,
              match_explanation: match.explanation,
              adapter_order: adapterIndex + 1,
              source_result_order: sourceResultOrder,
              published_at: item.job.posted_at,
              scraped_at: new Date().toISOString(),
            };
          });
          if (resultRows.length) {
            const { data: mapped, error: mappingError } = await serviceClient.from("job_scrape_results")
              .upsert(resultRows, { onConflict: "session_id,job_id", ignoreDuplicates: true })
              .select("id");
            if (mappingError) throw new Error(`Could not save matched jobs: ${mappingError.message}`);
            totalSaved += mapped?.length || 0;
          }
          const { count, error: countError } = await serviceClient.from("job_scrape_results")
            .select("id", { count: "exact", head: true })
            .eq("session_id", sessionId)
            .gte("match_score", 60);
          if (countError) throw new Error(`Could not count visible jobs: ${countError.message}`);
          totalDisplayed = count || 0;
          adapterStatuses[key] = adapterHadErrors ? "failed" : "completed";
        } catch (error) {
          hadFailure = true;
          adapterStatuses[key] = "failed";
          const technical = error instanceof Error ? error : new Error("Adapter failed");
          console.error(`[collect-jobs] ${key}`, technical.message);
          adapterErrors[key] = [...(adapterErrors[key] || []), friendlyAdapterError(key, technical)];
        }

        await serviceClient.from("job_scrape_sessions").update({
          adapter_statuses: adapterStatuses,
          adapter_errors: adapterErrors,
          total_jobs_scraped: totalScraped,
          total_jobs_saved: totalSaved,
          total_jobs_displayed: totalDisplayed,
        }).eq("id", sessionId);
      },
    });

    const failedCount = Object.values(adapterStatuses).filter((status) => status === "failed").length;
    const finalStatus = failedCount === JOB_ADAPTER_ORDER.length
      ? "failed"
      : hadFailure || failedCount > 0
        ? "partially_completed"
        : "completed";
    const completedAt = new Date().toISOString();
    const { data: finalSession, error: finalError } = await serviceClient.from("job_scrape_sessions").update({
      current_adapter: null,
      session_status: finalStatus,
      completed_at: completedAt,
      adapter_statuses: adapterStatuses,
      adapter_errors: adapterErrors,
      total_jobs_scraped: totalScraped,
      total_jobs_saved: totalSaved,
      total_jobs_displayed: totalDisplayed,
    }).eq("id", sessionId).select("*").single();
    if (finalError) throw new Error(`Could not finish scrape session: ${finalError.message}`);

    await client.from("job_searches").insert({
      user_id: user.id,
      keyword: query,
      location: requestedLocation || null,
      results_count: totalDisplayed,
    });
    return jsonResponse({ success: finalStatus !== "failed", session: finalSession });
  } catch (error) {
    const technical = error instanceof Error ? error : new Error("Job scraping failed");
    console.error("[collect-jobs] fatal", technical.message);
    if (admin && sessionId) {
      await admin.from("job_scrape_sessions").update({
        current_adapter: null,
        session_status: "failed",
        completed_at: new Date().toISOString(),
        adapter_errors: { system: ["The scraping session stopped unexpectedly."] },
      }).eq("id", sessionId);
    }
    return jsonResponse({ error: "Job scraping could not be completed. Please try again.", session_id: sessionId }, 500);
  }
});

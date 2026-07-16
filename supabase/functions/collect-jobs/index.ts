import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { collectLinkedInJobs } from "../_shared/adapters/linkedin-apify.adapter.ts";
import { collectIndeedJobs } from "../_shared/adapters/indeed-apify.adapter.ts";
import { collectMultiBoardJobs } from "../_shared/adapters/multi-job-apify.adapter.ts";
import { collectRssJobs } from "../_shared/adapters/rss.adapter.ts";
import { collectCompanyCareerJobs } from "../_shared/adapters/company-career.adapter.ts";
import { upsertCollectedJobs } from "../_shared/job-collection.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

function matchesRequestedFilters(job: any, input: any) {
  const source = String(input.source || "all").toLowerCase();
  const jobType = String(input.jobType || "all").toLowerCase();
  const workMode = String(input.workMode || "all").toLowerCase();
  if (source !== "all" && String(job.source || "").toLowerCase() !== source) return false;
  if (jobType !== "all" && !String(job.job_type || "").toLowerCase().includes(jobType)) return false;
  if (workMode !== "all" && !`${job.work_mode || ""} ${job.location || ""}`.toLowerCase().includes(workMode)) return false;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Authentication required");
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await client.auth.getUser(); if (!user) throw new Error("Unauthorized");
    const input = await req.json().catch(() => ({}));
    const keywords = Array.isArray(input.keywords) ? input.keywords : [input.query || input.role || "software engineer"];
    const locations = Array.isArray(input.locations) ? input.locations : [input.location || "Pakistan"];
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: sources } = await admin.from("job_sources").select("id, source_type, name, url, config").eq("enabled", true);
    const query = keywords.filter(Boolean).join(" "); const location = locations.filter(Boolean)[0] || "Pakistan";
    const requestedSource = String(input.source || "all").toLowerCase();
    const tasks: Promise<any[]>[] = [];
    if (requestedSource === "all" || requestedSource === "indeed_apify") tasks.push(collectIndeedJobs(query, location));
    if (requestedSource === "all" || requestedSource.startsWith("multi_")) tasks.push(collectMultiBoardJobs(query, location));
    if (requestedSource === "all" || requestedSource === "linkedin_apify") {
      tasks.push(collectLinkedInJobs(keywords.filter(Boolean).slice(0, 3), locations.filter(Boolean).slice(0, 3), Math.min(Number(input.maxItems) || 25, 50), { jobType: input.jobType, workMode: input.workMode }));
    }
    const trackedSources: Array<{ id: string; task: Promise<any[]> }> = [];
    for (const source of sources || []) {
      if (!source.url || (requestedSource !== "all" && requestedSource !== source.source_type)) continue;
      const task = source.source_type === "rss" ? collectRssJobs(source.url, source.name) : source.source_type === "company_career" ? collectCompanyCareerJobs(source.url, source.name) : null;
      if (task) { tasks.push(task); trackedSources.push({ id: source.id, task }); }
    }
    const results = await Promise.allSettled(tasks);
    const jobs = results
      .filter((result): result is PromiseFulfilledResult<any[]> => result.status === "fulfilled")
      .flatMap((result) => result.value)
      .filter((job) => matchesRequestedFilters(job, input));
    const sourceErrors = results
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason instanceof Error ? result.reason.message : "A source failed");
    if (!jobs.length && sourceErrors.length === results.length) throw new Error(sourceErrors.join(" | "));
    await Promise.all(trackedSources.map(async (source) => {
      try { const jobsForSource = await source.task; await admin.from("job_sources").update({ last_collected_at: new Date().toISOString(), last_result_count: jobsForSource.length, last_error: null }).eq("id", source.id); }
      catch (error) { await admin.from("job_sources").update({ last_collected_at: new Date().toISOString(), last_result_count: 0, last_error: error instanceof Error ? error.message.slice(0, 500) : "Collection failed" }).eq("id", source.id); }
    }));
    const result = await upsertCollectedJobs(jobs);
    await client.from("job_searches").insert({ user_id: user.id, keyword: keywords.join(", "), location: locations.join(", "), results_count: jobs.length });
    return new Response(JSON.stringify({ success: true, found: result.inserted + result.updated, ...result, sourceErrors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("collect-jobs", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Collection failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

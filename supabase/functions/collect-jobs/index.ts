import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { collectLinkedInJobs } from "../_shared/adapters/linkedin-apify.adapter.ts";
import { collectIndeedJobs } from "../_shared/adapters/indeed-apify.adapter.ts";
import { collectMultiBoardJobs } from "../_shared/adapters/multi-job-apify.adapter.ts";
import { collectRssJobs } from "../_shared/adapters/rss.adapter.ts";
import { collectCompanyCareerJobs } from "../_shared/adapters/company-career.adapter.ts";
import { deduplicateJobs, upsertCollectedJobs } from "../_shared/job-collection.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

function keywordMatchScore(job: any, query: unknown) {
  const terms = [...new Set(String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/[^a-z0-9+#-]/g, ""))
    .filter((term) => term.length >= 2))].slice(0, 4);
  if (!terms.length) return { score: 0, hasTitleOrSkillMatch: true };
  const coverage = (value: unknown) => {
    const text = String(value || "").toLowerCase();
    return terms.filter((term) => text.includes(term)).length / terms.length;
  };
  const titleCoverage = coverage(job.title);
  const skillsCoverage = coverage(Array.isArray(job.skills) ? job.skills.join(" ") : "");
  const descriptionCoverage = coverage(job.description);
  return {
    score: (titleCoverage * 50) + (skillsCoverage * 30) + (descriptionCoverage * 20),
    hasTitleOrSkillMatch: titleCoverage > 0 || skillsCoverage > 0,
  };
}

function matchesRequestedFilters(job: any, input: any) {
  const source = String(input.source || "all").toLowerCase();
  const jobType = String(input.jobType || "all").toLowerCase();
  const workMode = String(input.workMode || "all").toLowerCase();
  if (source !== "all" && String(job.source || "").toLowerCase() !== source) return false;
  if (jobType !== "all" && !String(job.job_type || "").toLowerCase().includes(jobType)) return false;
  if (workMode !== "all" && !`${job.work_mode || ""} ${job.location || ""}`.toLowerCase().includes(workMode)) return false;
  // RSS and career pages can return an entire site/feed, so they need a
  // relevance threshold. API job boards already receive the query upstream.
  if (["rss", "company_career"].includes(source)) {
    const match = keywordMatchScore(job, input.query || input.role);
    if (match.score < 30 || !match.hasTitleOrSkillMatch) return false;
  }
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
    const { data: sources, error: sourcesError } = await admin
      .from("job_sources")
      .select("id, source_type, name, url, config, last_result_count")
      .eq("enabled", true)
      // Use the limited collection budget on sources that have already proven
      // they return jobs, rather than repeatedly spending it on a slow page.
      .order("last_result_count", { ascending: false, nullsFirst: false });
    if (sourcesError) throw new Error(`Could not load configured sources: ${sourcesError.message}`);
    const query = keywords.filter(Boolean).join(" "); const location = locations.filter(Boolean)[0] || "Pakistan";
    const requestedSource = String(input.source || "all").toLowerCase();
    if (requestedSource === "all") {
      return new Response(JSON.stringify({ success: false, error: "Choose one source before refreshing. This keeps collection fast and prevents provider limits." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const maxItems = Math.min(Math.max(Number(input.maxItems) || 10, 1), 10);
    const tasks: Array<{ name: string; sourceId?: string; task: Promise<any[]> }> = [];
    if (requestedSource === "indeed_apify") tasks.push({ name: "Indeed", task: collectIndeedJobs(query, location, maxItems) });
    if (requestedSource.startsWith("multi_")) tasks.push({ name: "Multi-job board", task: collectMultiBoardJobs(query, location, maxItems) });
    if (requestedSource === "linkedin_apify") tasks.push({ name: "LinkedIn", task: collectLinkedInJobs(keywords.filter(Boolean).slice(0, 3), locations.filter(Boolean).slice(0, 3), maxItems, { jobType: input.jobType, workMode: input.workMode }) });
    const configuredSources = (sources || []).filter((source) => source.url && requestedSource === source.source_type).slice(0, 2);
    for (const source of configuredSources) {
      const task = source.source_type === "rss" ? collectRssJobs(source.url, source.name) : source.source_type === "company_career" ? collectCompanyCareerJobs(source.url, source.name) : null;
      if (task) tasks.push({ name: source.name, sourceId: source.id, task });
    }
    if (!tasks.length) throw new Error(`No enabled ${requestedSource.replace(/_/g, " ")} sources are configured`);
    const results = await Promise.allSettled(tasks.map(({ task }) => task));
    const jobs = results
      .filter((result): result is PromiseFulfilledResult<any[]> => result.status === "fulfilled")
      .flatMap((result) => result.value)
      .filter((job) => matchesRequestedFilters(job, input));
    const sourceErrors = results
      .flatMap((result, index) => result.status === "rejected" ? [`${tasks[index].name}: ${result.reason instanceof Error ? result.reason.message : "Collection failed"}`] : []);
    await Promise.all(tasks.map(async (task, index) => {
      if (!task.sourceId) return;
      const outcome = results[index];
      const update = outcome.status === "fulfilled"
        ? { last_collected_at: new Date().toISOString(), last_result_count: outcome.value.length, last_error: null }
        : { last_collected_at: new Date().toISOString(), last_result_count: 0, last_error: outcome.reason instanceof Error ? outcome.reason.message.slice(0, 500) : "Collection failed" };
      await admin.from("job_sources").update(update).eq("id", task.sourceId);
    }));
    const uniqueJobs = deduplicateJobs(jobs);
    const result = await upsertCollectedJobs(uniqueJobs);
    await client.from("job_searches").insert({ user_id: user.id, keyword: keywords.join(", "), location: locations.join(", "), results_count: jobs.length });
    return new Response(JSON.stringify({ success: true, found: result.inserted + result.updated, received: jobs.length, duplicatesRemoved: jobs.length - uniqueJobs.length, ...result, sourceErrors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("collect-jobs", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Collection failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

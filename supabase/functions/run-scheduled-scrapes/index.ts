import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runScrapeOrchestration } from "../_shared/scrape-orchestrator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

type DueSchedule = { id: string; user_id: string };

/**
 * System-triggered dispatcher, invoked once a minute by pg_cron/pg_net (see
 * the `dispatch-job-scrape-schedules` cron job in
 * supabase/migrations/20260721000400_job_scrape_schedules.sql). There is no
 * user session for this caller, so it authenticates via a shared secret
 * instead of a JWT -- `supabase secrets set CRON_DISPATCH_SECRET=...` must
 * set the same value the migration's cron job sends as `x-cron-secret`.
 *
 * This function does no adapter work itself: it claims due rows in one
 * atomic step (`claim_due_job_scrape_schedules`, which also advances/
 * deactivates each row so it stops being "due" immediately) and then runs
 * the exact same orchestration the manual "Scrape Jobs" button uses.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const expectedSecret = Deno.env.get("CRON_DISPATCH_SECRET");
  if (!expectedSecret || req.headers.get("x-cron-secret") !== expectedSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: due, error } = await admin.rpc("claim_due_job_scrape_schedules", { p_limit: 25 });
  if (error) {
    console.error("[run-scheduled-scrapes] claim failed", error.message);
    return jsonResponse({ error: error.message }, 500);
  }

  const claimed = (due || []) as DueSchedule[];

  // Each due user's scrape runs independently and concurrently -- one
  // schedule failing (or racing a manual scrape already in flight for that
  // user) must never block or delay any other user's run. pg_net's call into
  // this function is fire-and-forget from Postgres's perspective, so it's
  // fine for this response to take as long as the slowest scrape.
  await Promise.allSettled(claimed.map(async (schedule) => {
    const result = await runScrapeOrchestration({
      admin,
      userId: schedule.user_id,
      query: null,
      location: null,
      jobType: "all",
      workMode: "all",
      maxItems: 25,
      scheduleId: schedule.id,
    });
    // job_scrape_schedules.last_run_status uses "skipped_*" for the two
    // non-run outcomes; every other orchestrator status matches 1:1.
    const lastRunStatus = result.status === "conflict"
      ? "skipped_conflict"
      : result.status === "no_query"
        ? "skipped_no_query"
        : result.status;
    const { error: statusError } = await admin
      .from("job_scrape_schedules")
      .update({ last_run_status: lastRunStatus })
      .eq("id", schedule.id);
    if (statusError) console.error("[run-scheduled-scrapes] status update failed", schedule.id, statusError.message);
  }));

  return jsonResponse({ claimed: claimed.length });
});

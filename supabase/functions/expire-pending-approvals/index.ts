import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Marks pending account approvals older than 48 hours as expired.
 *
 * Invoked by:
 * - pg_cron job `expire-pending-approvals` (direct SQL via expire_pending_approvals())
 * - Manual / external HTTP POST with x-cron-secret (this Edge Function)
 *
 * Schedule (documented): every hour at :15 — `15 * * * *`
 * Cron secret must match CRON_DISPATCH_SECRET / vault `cron_dispatch_secret`.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const expectedSecret = Deno.env.get("CRON_DISPATCH_SECRET");
  const cronSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("Authorization");

  // Allow cron secret OR service-role bearer (admin tooling)
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const isCron = expectedSecret && cronSecret === expectedSecret;
  const isService =
    serviceKey && authHeader === `Bearer ${serviceKey}`;

  if (!isCron && !isService) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await admin.rpc("expire_pending_approvals");
  if (error) {
    console.error("[expire-pending-approvals]", error.message);
    return jsonResponse({ error: error.message }, 500);
  }

  const expiredCount = typeof data === "number" ? data : 0;
  console.log(`[expire-pending-approvals] expired ${expiredCount} pending account(s)`);

  return jsonResponse({ success: true, expiredCount });
});

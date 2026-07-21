import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runScrapeOrchestration } from "../_shared/scrape-orchestrator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const jobType = ["full-time", "part-time", "contract", "internship"].includes(String(input.jobType).toLowerCase())
      ? String(input.jobType).toLowerCase()
      : "all";
    const workMode = ["remote", "hybrid"].includes(String(input.workMode).toLowerCase())
      ? String(input.workMode).toLowerCase()
      : "all";
    const maxItems = Math.min(Math.max(Number(input.maxItems) || 25, 1), 25);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const result = await runScrapeOrchestration({
      admin, userId: user.id, query, location: requestedLocation || null, jobType, workMode, maxItems,
    });

    if (result.status === "conflict") return jsonResponse({ error: "A job scraping session is already running.", session: result.session }, 409);
    if (result.status === "no_query") return jsonResponse({ error: "Enter a skill, job title, or keyword before scraping jobs." }, 400);
    return jsonResponse({ success: result.status !== "failed", session: result.session });
  } catch (error) {
    const technical = error instanceof Error ? error : new Error("Job scraping failed");
    console.error("[collect-jobs] fatal", technical.message);
    return jsonResponse({ error: "Job scraping could not be completed. Please try again." }, 500);
  }
});

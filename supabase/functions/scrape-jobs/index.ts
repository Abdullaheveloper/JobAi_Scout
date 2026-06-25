import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Apify helpers ──────────────────────────────────────────
async function waitForRun(runId: string, token: string, maxWaitMs = 120000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
    const data = await res.json();
    const status = data?.data?.status;
    if (status === "SUCCEEDED") return data.data.defaultDatasetId;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) throw new Error(`Apify run ${status}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Apify run timed out");
}

async function scrapeApify(searchQuery: string, location: string, token: string): Promise<any[]> {
  try {
    console.log("[Apify] query:", searchQuery, "location:", location);
    const startRes = await fetch(
      `https://api.apify.com/v2/acts/orgupdate~google-jobs-scraper/runs?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries: [`${searchQuery} in ${location}`], maxResults: 20 }),
      }
    );
    if (!startRes.ok) { console.error("[Apify] start failed:", startRes.status); return []; }
    const runId = (await startRes.json())?.data?.id;
    if (!runId) return [];
    const datasetId = await waitForRun(runId, token);
    const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`);
    const items = await itemsRes.json();
    console.log(`[Apify] got ${items.length} results`);
    return items.map((j: any) => ({
      title: j.job_title || j.title || "",
      company: j.company_name || j.companyName || j.company || "",
      location: j.location || j.formattedLocation || null,
      description: (j.description || "").substring(0, 5000),
      job_url: j.URL || j.link || j.applyUrl || j.url || null,
      salary: j.salary || j.salaryInfo || "",
      source: "apify",
    }));
  } catch (e) { console.error("[Apify] error:", e); return []; }
}

// ── SerpAPI helper ─────────────────────────────────────────
async function scrapeSerpApi(searchQuery: string, location: string, token: string): Promise<any[]> {
  try {
    console.log("[SerpAPI] query:", searchQuery, "location:", location);
    const params = new URLSearchParams({
      engine: "google_jobs",
      q: searchQuery,
      location,
      api_key: token,
      num: "20",
    });
    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) { console.error("[SerpAPI] failed:", res.status); return []; }
    const data = await res.json();
    const jobs = data.jobs_results || [];
    console.log(`[SerpAPI] got ${jobs.length} results`);
    return jobs.map((j: any) => {
      const applyLink = j.apply_options?.[0]?.link || j.share_link || j.related_links?.[0]?.link || null;
      return {
        title: j.title || "",
        company: j.company_name || "",
        location: j.location || null,
        description: (j.description || "").substring(0, 5000),
        job_url: applyLink,
        salary: j.detected_extensions?.salary || "",
        source: "serpapi",
      };
    });
  } catch (e) { console.error("[SerpAPI] error:", e); return []; }
}

// ── Normalise & insert ────────────────────────────────────
function parseJob(raw: any) {
  let salaryMin: number | null = null;
  let salaryMax: number | null = null;
  const salaryMatch = (raw.salary || "").match(/([\d,]+)(?:K)?\s*[-–]\s*([\d,]+)(?:K)?/i);
  if (salaryMatch) {
    salaryMin = parseInt(salaryMatch[1].replace(/,/g, ""));
    salaryMax = parseInt(salaryMatch[2].replace(/,/g, ""));
    if (salaryMin < 1000) salaryMin *= 1000;
    if (salaryMax < 1000) salaryMax *= 1000;
  }

  const fullText = `${raw.title} ${raw.description}`.toLowerCase();
  let jobType = "full-time";
  if (fullText.includes("remote")) jobType = "remote";
  else if (fullText.includes("hybrid")) jobType = "hybrid";
  else if (fullText.includes("contract")) jobType = "contract";
  else if (fullText.includes("part-time") || fullText.includes("part time")) jobType = "part-time";

  const skillKeywords = raw.description.match(
    /(?:React|Node\.js|Python|Java|TypeScript|JavaScript|SQL|AWS|Docker|Kubernetes|Git|Angular|Vue|MongoDB|PostgreSQL|GraphQL|REST|CI\/CD|Agile|Scrum|C\+\+|Go|Rust|Ruby|Swift|Kotlin|Flutter|TensorFlow|PyTorch|Next\.js|Express|Django|Spring|Azure|GCP|Linux|HTML|CSS|Sass|Figma|Redis|Elasticsearch)/gi
  ) || [];

  const expText = raw.description.toLowerCase();
  const experienceLevel = /senior|staff|lead|principal/.test(expText) ? "senior"
    : /entry|junior|intern|graduate/.test(expText) ? "junior"
    : /mid[- ]level/.test(expText) ? "mid" : null;

  return {
    title: raw.title || "Untitled Position",
    company: raw.company || "Company Not Listed",
    location: raw.location,
    description: raw.description || null,
    job_url: raw.job_url,
    job_type: jobType,
    salary_min: salaryMin,
    salary_max: salaryMax,
    source: raw.source,
    skills: [...new Set(skillKeywords)].slice(0, 10),
    experience_level: experienceLevel,
    is_active: true,
  };
}

// ── Build multiple search queries from profile ────────────
function buildQueries(role: string, skills: string[], query: string): string[] {
  const queries: string[] = [];
  // Primary: first desired role
  if (role) queries.push(role);
  // Fallback: raw query
  else if (query) queries.push(query);
  // Default
  if (queries.length === 0) queries.push("software developer");

  // Add a skill-focused query if we have enough skills
  if (skills.length >= 2) {
    const skillQuery = skills.slice(0, 3).join(" ") + " developer";
    if (!queries.includes(skillQuery)) queries.push(skillQuery);
  }

  return queries.slice(0, 2); // max 2 queries to stay within limits
}

// ── Main handler ──────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APIFY_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    const SERPAPI_TOKEN = Deno.env.get("SERPAPI_API_KEY");

    if (!APIFY_TOKEN && !SERPAPI_TOKEN) {
      return new Response(
        JSON.stringify({ error: "No scraping API tokens configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { query, location, skills, role, strictLocation, cityFilter } = await req.json();
    const searchLocation = location || "Pakistan";
    const searchQueries = buildQueries(role || "", skills || [], query || "");

    console.log("Search queries:", searchQueries, "| Location:", searchLocation, "| Strict:", strictLocation, "| City:", cityFilter);

    // Run scrapers in parallel across all queries
    const allRawJobs: any[] = [];
    const scraperPromises: Promise<any[]>[] = [];

    for (const q of searchQueries) {
      if (APIFY_TOKEN) scraperPromises.push(scrapeApify(q, searchLocation, APIFY_TOKEN));
      if (SERPAPI_TOKEN) scraperPromises.push(scrapeSerpApi(q, searchLocation, SERPAPI_TOKEN));
    }

    const results = await Promise.allSettled(scraperPromises);
    for (const r of results) {
      if (r.status === "fulfilled") allRawJobs.push(...r.value);
    }

    console.log(`Total raw jobs from all sources: ${allRawJobs.length}`);

    // Filter by city if user specified a city filter
    let locationFiltered = allRawJobs;
    const filterCity = (cityFilter || "").trim().toLowerCase();
    if (strictLocation && filterCity) {
      locationFiltered = allRawJobs.filter((j: any) => {
        if (!j.location) return false;
        return j.location.toLowerCase().includes(filterCity);
      });
      console.log(`After city filter (${filterCity}): ${locationFiltered.length} jobs`);
    }

    // ── Supabase insert with dedup ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Delete old scraped jobs (keep recruiter-posted)
    await supabase.from("jobs").delete().in("source", ["apify", "serpapi"]).is("recruiter_id", null);

    const seenUrls = new Set<string>();
    let inserted = 0;
    let skipped = 0;

    for (const raw of locationFiltered) {
      if (!raw.title && !raw.company) { skipped++; continue; }
      if (raw.job_url && seenUrls.has(raw.job_url)) { skipped++; continue; }

      const record = parseJob(raw);
      const { error } = await supabase.from("jobs").insert(record);

      if (!error) {
        inserted++;
        if (raw.job_url) seenUrls.add(raw.job_url);
      } else {
        console.error("Insert error:", error.message);
        skipped++;
      }
    }

    console.log(`Inserted ${inserted}, skipped ${skipped}`);

    return new Response(
      JSON.stringify({ success: true, found: allRawJobs.length, inserted, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("scrape-jobs error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

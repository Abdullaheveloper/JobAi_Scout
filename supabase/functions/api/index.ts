import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const supabaseUser = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Routing based on URL path
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api/, "").replace(/\/$/, ""); // Normalize path

    // 1. GET /profile
    if (path.endsWith("/profile") && req.method === "GET") {
      const [profileRes, prefRes] = await Promise.all([
        supabaseAdmin.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabaseAdmin.from("job_preferences").select("*").eq("user_id", user.id).maybeSingle(),
      ]);

      const profile = profileRes.data || {};
      const pref = prefRes.data || {};

      // Map experience years to string format (e.g. Mid Level)
      let experience = "Mid Level";
      if (profile.experience_years !== undefined && profile.experience_years !== null) {
        const years = Number(profile.experience_years);
        if (years <= 2) experience = "Entry Level";
        else if (years <= 5) experience = "Mid Level";
        else experience = "Senior";
      }

      return new Response(
        JSON.stringify({
          id: user.id,
          skills: profile.skills || pref.skills || [],
          desired_role: pref.desired_role || (profile.desired_roles && profile.desired_roles[0]) || "",
          location: profile.location || (pref.preferred_locations && pref.preferred_locations[0]) || "",
          experience,
          job_type: pref.job_type || "Full Time",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. POST /jobs/discovered
    if (path.endsWith("/jobs/discovered") && req.method === "POST") {
      const body = await req.json();
      const { title, company, location, description, job_url, source, match_score } = body;

      if (!title || !company) {
        return new Response(JSON.stringify({ error: "title and company are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Deduplication check: user_id + job_url
      if (job_url) {
        const { data: existing, error: checkError } = await supabaseAdmin
          .from("recommended_jobs")
          .select("id")
          .eq("user_id", user.id)
          .eq("source_url", job_url)
          .maybeSingle();

        if (checkError) throw checkError;
        if (existing) {
          return new Response(JSON.stringify({ error: "Duplicate job", is_duplicate: true }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Insert recommended job
      const { data, error: insertError } = await supabaseAdmin
        .from("recommended_jobs")
        .insert({
          user_id: user.id,
          title,
          company,
          location: location || null,
          description: description || null,
          source_url: job_url || null,
          source_portal: source || "unknown",
          match_score: match_score || 0,
          synced_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return new Response(JSON.stringify({ success: true, job: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. GET /jobs/recommended
    if (path.endsWith("/jobs/recommended") && req.method === "GET") {
      const { data: jobs, error: fetchError } = await supabaseAdmin
        .from("recommended_jobs")
        .select("*")
        .eq("user_id", user.id)
        .order("match_score", { ascending: false });

      if (fetchError) throw fetchError;

      const mappedJobs = (jobs || []).map((j) => ({
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location || "",
        match_score: j.match_score || 0,
        job_url: j.source_url || "",
      }));

      return new Response(JSON.stringify(mappedJobs), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Route not found
    return new Response(JSON.stringify({ error: `Not Found: ${req.method} ${path}` }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("API handler error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

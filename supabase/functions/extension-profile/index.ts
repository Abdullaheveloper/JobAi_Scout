import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Sign in to JobAI Scout before loading your application profile." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Profile service is not configured." }, 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const token = authorization.slice("Bearer ".length);
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsError || !userId) return json({ error: "Your session has expired. Please sign in again." }, 401);

    // The caller never supplies an email or user ID. The profile is always
    // derived from the verified session, preventing account enumeration.
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile, error } = await admin
      .from("profiles")
      .select("full_name, email, phone, location, bio, cv_summary, resume_url, avatar_url, skills, desired_roles, experience_years, linkedin_url, github_url, portfolio_url, current_company, expected_salary, education, certifications, languages, work_authorization, willing_to_relocate, commute_to_office, availability, work_type, career_profile, autofill_preferences")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return json({ profile: profile || null });
  } catch (error) {
    console.error("extension-profile error:", error);
    return json({ error: "Could not load your application profile." }, 500);
  }
});

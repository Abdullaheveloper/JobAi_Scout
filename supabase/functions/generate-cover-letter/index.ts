import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: Record<string, unknown>, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Please sign in before tailoring a cover letter." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error("Missing Supabase environment variables for generate-cover-letter");
      return json({ error: "Cover letter service is not configured." }, 500);
    }

    const token = authHeader.slice("Bearer ".length);
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsError || !userId) {
      return json({ error: "Your session has expired. Please sign in again." }, 401);
    }

    const { jobId } = await req.json();
    if (typeof jobId !== "string" || !jobId.trim()) {
      return json({ error: "A valid job is required to tailor a cover letter." }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const [{ data: profile, error: profileError }, { data: job, error: jobError }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("full_name, email, phone, location, education, skills, experience_years, bio, cv_summary, linkedin_url, portfolio_url")
        .eq("user_id", userId)
        .single(),
      supabaseAdmin
        .from("jobs")
        .select("title, company, description, skills, requirements")
        .eq("id", jobId)
        .single(),
    ]);

    if (profileError || !profile) {
      return json({ error: "We could not find your profile. Please complete it and try again." }, 404);
    }
    if (jobError || !job) {
      return json({ error: "This job is no longer available. Refresh the job list and try again." }, 404);
    }

    const contactEmail = profile.email || (typeof claimsData.claims.email === "string" ? claimsData.claims.email : null);
    const hasProfileContext = Boolean(
      profile.full_name || profile.education || profile.cv_summary || profile.bio || profile.skills?.length || profile.experience_years,
    );
    if (!hasProfileContext) {
      return json({ error: "Add your skills, experience, or CV summary in Profile Settings before creating a tailored letter." }, 422);
    }

    const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterApiKey) return json({ error: "AI service not configured" }, 500);

    const prompt = `Write a short, natural-sounding cover letter for this job application. It should feel like a real person wrote it, not a template.

Job details:
- Title: ${job.title}
- Company: ${job.company || "Not provided"}
- Description: ${job.description || "Not provided"}
- Key skills or requirements: ${[...(job.skills || []), ...(job.requirements || [])].slice(0, 12).join(", ") || "Not provided"}

Applicant details:
- Name: ${profile.full_name || "Job Applicant"}
- Email: ${contactEmail || "Not provided"}
- Phone: ${profile.phone || "Not provided"}
- Location: ${profile.location || "Not provided"}
- Education: ${profile.education || "Not provided"}
- Skills: ${(profile.skills || []).join(", ") || "Not specified"}
- Experience: ${profile.experience_years || 0} years
- Bio: ${profile.bio || "Not provided"}
${profile.cv_summary ? `- CV summary: ${profile.cv_summary}` : ""}
${profile.linkedin_url ? `- LinkedIn: ${profile.linkedin_url}` : ""}
${profile.portfolio_url ? `- Portfolio: ${profile.portfolio_url}` : ""}

Instructions:
- Use standard professional cover-letter format, suitable to paste into a job application:
  1. A CV-style contact header with the candidate's name, email, location, and phone only when each value is provided.
  2. The current date.
  3. "Hiring Team" and the company name.
  4. A subject line: "Re: [job title]".
  5. A greeting, 2–3 concise body paragraphs, and a professional sign-off with the candidate's name.
- Keep the body roughly 150–200 words, excluding the header.
- Start with a specific reason this role is a good fit; do not use generic opening phrases.
- Use only facts from the applicant details. Never invent skills, achievements, employers, projects, or qualifications.
- Naturally mention the most relevant education, skills, location, and experience only when they strengthen the application. Do not force every field into the body.
- Focus on the applicant details that are relevant to this job.
- Do not include empty labels, placeholders, or details that were not provided. Return only the complete formatted cover letter.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openrouterApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You write concise, genuine cover letters. Use only facts in the supplied applicant background; never invent experience or skills." },
          { role: "user", content: prompt },
        ],
        temperature: 0.55,
        max_tokens: 700,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("OpenRouter API error:", response.status, detail);
      if (response.status === 429) return json({ error: "The AI is busy right now. Please try again in a moment." }, 429);
      return json({ error: "We could not generate a cover letter right now. Please try again." }, 502);
    }

    const data = await response.json();
    const coverLetter = data.choices?.[0]?.message?.content?.trim();
    if (!coverLetter) return json({ error: "The AI did not return a cover letter. Please try again." }, 502);

    return json({ coverLetter, job: { title: job.title, company: job.company } });
  } catch (error) {
    console.error("generate-cover-letter error:", error);
    return json({ error: "Something went wrong while tailoring your cover letter. Please try again." }, 500);
  }
});

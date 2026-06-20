const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobTitle, company, jobDescription, userName, userEmail, userSkills, userExperience, userBio, userCvSummary } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI gateway not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `Write a short, natural-sounding cover letter for this job application. It should feel like a real person wrote it — not a template.

Job Details:
- Title: ${jobTitle}
- Company: ${company}
- Description: ${jobDescription || "Not provided"}

Applicant Details:
- Name: ${userName || "Job Applicant"}
- Email: ${userEmail || ""}
- Skills: ${userSkills?.join(", ") || "Not specified"}
- Experience: ${userExperience || 0} years
- Bio: ${userBio || "Not provided"}
${userCvSummary ? `- CV Summary (use relevant details from this): ${userCvSummary}` : ""}

Instructions:
- Keep it SHORT — 2-3 paragraphs max, around 150-200 words total
- Sound human and genuine, not robotic or overly formal
- Mention specific skills/projects from the CV summary that are relevant to THIS job
- Don't repeat generic phrases like "I am writing to express my interest"
- Start with something specific about why this role/company is a good fit
- Only mention things that are actually in the applicant's background — DO NOT make up anything
- Don't include header/address block, just the letter body
- End with a brief, confident closing line`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You write short, genuine cover letters that sound like a real person. Use only facts from the applicant's actual background. Never invent experience or skills." },
          { role: "user", content: prompt },
        ],
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("AI gateway error:", err);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Failed to generate cover letter" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const coverLetter = data.choices?.[0]?.message?.content || "Could not generate cover letter.";

    return new Response(
      JSON.stringify({ coverLetter }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-cover-letter error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

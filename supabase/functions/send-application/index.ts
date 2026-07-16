import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    const { jobId, coverLetter } = await req.json();

    if (!jobId) {
      return new Response(JSON.stringify({ error: "jobId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get job details
    const { data: job } = await supabaseAdmin
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (!job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get resume file if available
    let resumeBase64: string | null = null;
    let resumeFileName: string | null = null;

    if (profile.resume_url) {
      const { data: fileData } = await supabaseAdmin.storage
        .from("resumes")
        .download(profile.resume_url);

      if (fileData) {
        const arrayBuffer = await fileData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        resumeBase64 = btoa(binary);
        resumeFileName = profile.resume_url.split("/").pop() || "resume.pdf";
      }
    }

    // Generate cover letter if not provided
    let finalCoverLetter = coverLetter;
    if (!finalCoverLetter) {
      const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
      if (openrouterApiKey) {
        const prompt = `Write a professional cover letter for ${profile.full_name} applying to ${job.title} at ${job.company}. Skills: ${(profile.skills || []).join(", ")}. Experience: ${profile.experience_years || 0} years. Job description: ${(job.description || "").substring(0, 1000)}. Keep it 3 paragraphs, concise and compelling.`;

        const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openrouterApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are an expert cover letter writer." },
              { role: "user", content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 800,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          finalCoverLetter = aiData.choices?.[0]?.message?.content || "";
        }
      }
    }

    // Track the application
    await supabaseAdmin.from("job_applications").insert({
      user_id: userId,
      job_id: jobId,
      cover_letter: finalCoverLetter || null,
      status: "sent",
    });

    // Build the application package response
    const applicationPackage = {
      success: true,
      applicant: {
        name: profile.full_name,
        email: profile.email,
        skills: profile.skills,
        experience_years: profile.experience_years,
        bio: profile.bio,
      },
      job: {
        title: job.title,
        company: job.company,
        location: job.location,
        job_url: job.job_url,
      },
      coverLetter: finalCoverLetter,
      hasResume: !!resumeBase64,
      resumeFileName,
      message: job.job_url
        ? `Application prepared for ${job.title} at ${job.company}. Cover letter generated and resume attached. Opening application page...`
        : `Application for ${job.title} at ${job.company} has been tracked with cover letter and resume.`,
    };

    console.log(`Application sent: ${profile.full_name} -> ${job.title} at ${job.company}`);

    return new Response(JSON.stringify(applicationPackage), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-application error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { createClient } from "npm:@supabase/supabase-js@2";
import { extractCvText, type ExtractionResult } from "../_shared/cv-extraction.ts";
import {
  normalizeExtractedData,
  buildProfileUpdateFromExtracted,
} from "../_shared/cv-profile-merge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert CV/Resume data extractor. Extract ALL information from the CV exactly as written. Do NOT invent, assume, or add anything not present in the CV. Only return what is explicitly stated in the document.

Rules:
- Extract the person's full name, email, phone, location exactly as written
- Extract LinkedIn and GitHub URLs if present
- Extract portfolio/personal website URL if present
- Extract current or most recent company name if present
- List all technical and soft skills mentioned
- List job titles/roles the person has held or is targeting
- Calculate total years of experience from work history dates. Use fractional years — e.g. 6 months at one company + 1 year at another = 1.5 years total. Count months precisely, don't round up to whole years.
- Extract education details: degrees, institutions, graduation years. Format as a readable summary.
- Extract all certifications mentioned (e.g. AWS Certified, PMP, Google Analytics, etc.)
- Extract all languages spoken if mentioned
- Extract a detailed summary that captures everything else: recent projects, achievements, certifications, volunteer work, publications, awards, tools used, methodologies, and any other details. Write this summary in first person as if the candidate wrote it, using only facts from the CV.
- The summary should be comprehensive enough that someone reading it gets the full picture of the candidate beyond just skills and roles.
- Handle both well-structured CVs (with clear sections) and unstructured ones (plain text, informal format). Extract whatever data is available regardless of format.

You must respond with a JSON object matching this exact schema:
{
  "fullName": "string",
  "email": "string (empty if not found)",
  "phone": "string (empty if not found)",
  "location": "string (empty if not found)",
  "linkedinUrl": "string (empty if not found)",
  "githubUrl": "string (empty if not found)",
  "portfolioUrl": "string (empty if not found)",
  "currentCompany": "string (empty if not found)",
  "skills": ["string"],
  "suggestedRoles": ["string"],
  "experienceYears": 0,
  "education": "string (empty if not found)",
  "certifications": ["string"],
  "languages": ["string"],
  "cvSummary": "string"
}`;

async function extractStructuredData(
  cvText: string,
  fileName: string,
  openrouterApiKey: string,
): Promise<Record<string, unknown>> {
  const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openrouterApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `Extract ALL data from this CV/Resume. Only include what is explicitly written - do not make up anything.\n\nFile name: ${fileName}\n\nCV Content:\n${cvText.substring(0, 15000)}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 3000,
    }),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error("OpenRouter API error:", aiResponse.status, errText);

    if (aiResponse.status === 429) {
      throw new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    throw new Error("AI analysis failed");
  }

  const aiData = await aiResponse.json();
  const responseText = aiData.choices?.[0]?.message?.content?.trim();
  if (!responseText) {
    throw new Error("AI did not return structured data");
  }

  return JSON.parse(responseText);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) throw new Error("Invalid auth token");

    const { fileName, filePath } = await req.json();
    if (!filePath) throw new Error("No file path provided");

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("resumes")
      .download(filePath);
    if (downloadError) throw new Error(`Download failed: ${downloadError.message}`);

    const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterApiKey) throw new Error("OPENROUTER_API_KEY not configured");

    const extractorUrl = Deno.env.get("CV_EXTRACTOR_URL");
    const resolvedFileName = fileName || filePath;

    // Step 1: Text extraction (PyMuPDF / pdfplumber / OCR via Python service, or Deno fallback)
    const extraction: ExtractionResult = await extractCvText(fileData, resolvedFileName, {
      serviceUrl: extractorUrl || undefined,
      openrouterApiKey,
    });

    if (!extraction.text || extraction.text.length < 30) {
      throw new Error("Could not extract readable text from the resume");
    }

    console.log(
      `CV text extracted via ${extraction.method} (${extraction.charCount} chars, OCR=${extraction.ocrUsed})`,
    );

    // Step 2: AI structured extraction from plain text
    const result = await extractStructuredData(extraction.text, resolvedFileName, openrouterApiKey);
    const extracted = normalizeExtractedData(result as Record<string, unknown>);

    // Step 3: Persist extracted fields into profile (only fill empty fields)
    let savedKeys: string[] = [];
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const { updatePayload, filledKeys } = buildProfileUpdateFromExtracted(profile, extracted);

    if (filledKeys.length > 0) {
      const coreKeys = [
        "full_name",
        "email",
        "phone",
        "location",
        "linkedin_url",
        "github_url",
        "skills",
        "desired_roles",
        "experience_years",
      ];
      const corePayload: Record<string, unknown> = {};
      for (const key of coreKeys) {
        if (updatePayload[key] !== undefined) corePayload[key] = updatePayload[key];
      }

      // An UPDATE matching no rows has no PostgREST error. Use upsert so a
      // missing profile (for example, from an older account without the signup
      // trigger) is created and the client can reliably load the extracted data.
      const profilePayload = {
        ...updatePayload,
        user_id: user.id,
        email: profile?.email || user.email || updatePayload.email || null,
      };
      const { data: savedProfile, error: updateError } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "user_id" })
        .select("user_id")
        .maybeSingle();

      if ((updateError || !savedProfile) && Object.keys(corePayload).length > 0) {
        console.error("Full profile save failed, trying core-only:", updateError?.message || "no profile row returned");
        const { data: coreProfile, error: coreError } = await supabase
          .from("profiles")
          .upsert({ ...corePayload, user_id: user.id, email: profile?.email || user.email || null }, { onConflict: "user_id" })
          .select("user_id")
          .maybeSingle();

        if (!coreError && coreProfile) {
          savedKeys = filledKeys.filter((key) => coreKeys.includes(key));
        } else {
          console.error("Core profile save failed:", coreError?.message || "no profile row returned");
        }
      } else if (!updateError && savedProfile) {
        savedKeys = filledKeys;
      } else {
        console.error("Server-side profile save failed:", updateError?.message || "no profile row returned");
      }

      if (savedKeys.length > 0) {
        try {
          await supabase.rpc("update_profile_data_sources", {
            p_user_id: user.id,
            p_field_names: savedKeys,
            p_source: "ai",
          });
        } catch (rpcErr) {
          console.error("update_profile_data_sources failed:", rpcErr);
        }
      }
    }

    return new Response(
      JSON.stringify({
        ...extracted,
        _extraction: {
          method: extraction.method,
          pages: extraction.pages,
          ocrUsed: extraction.ocrUsed,
          charCount: extraction.charCount,
        },
        _saved: {
          count: savedKeys.length,
          keys: savedKeys,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    if (e instanceof Response) return e;

    console.error("analyze-cv error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

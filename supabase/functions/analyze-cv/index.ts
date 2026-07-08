import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Invalid auth token");

    const { fileName, filePath } = await req.json();
    if (!filePath) throw new Error("No file path provided");

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("resumes")
      .download(filePath);
    if (downloadError) throw new Error(`Download failed: ${downloadError.message}`);

    // Detect file type and prepare content for AI
    const lowerName = (fileName || filePath).toLowerCase();
    const isPdf = lowerName.endsWith(".pdf");
    const isDocx = lowerName.endsWith(".docx") || lowerName.endsWith(".doc");

    let parts: any[];

    if (isPdf) {
      // Send PDF as base64 binary for multimodal parsing
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      const CHUNK_SIZE = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64 = btoa(binary);
      parts = [
        { text: `Extract ALL data from this CV/Resume. Only include what is explicitly written - do not make up anything.\n\nFile name: ${fileName}` },
        {
          inlineData: {
            mimeType: "application/pdf",
            data: base64,
          },
        },
      ];
    } else {
      // For DOCX/text files, extract as text
      const text = await fileData.text();
      parts = [
        { text: `Extract ALL data from this CV/Resume. Only include what is explicitly written - do not make up anything.\n\nFile name: ${fileName}\n\nCV Content:\n${text.substring(0, 15000)}` },
      ];
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const systemPrompt = `You are an expert CV/Resume data extractor. Extract ALL information from the CV exactly as written. Do NOT invent, assume, or add anything not present in the CV. Only return what is explicitly stated in the document.

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

    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [
            { role: "user", parts },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Gemini API error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResponse.json();
    const responseText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error("AI did not return structured data");
    }

    const result = JSON.parse(responseText);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-cv error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

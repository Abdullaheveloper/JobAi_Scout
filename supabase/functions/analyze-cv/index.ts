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

    let userContent: any[];

    if (isPdf) {
      // Send PDF as base64 binary for multimodal parsing (handles structured layouts, tables, columns)
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      const CHUNK_SIZE = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64 = btoa(binary);
      userContent = [
        {
          type: "text",
          text: `Extract ALL data from this CV/Resume. Only include what is explicitly written - do not make up anything.\n\nFile name: ${fileName}`
        },
        {
          type: "image_url",
          image_url: {
            url: `data:application/pdf;base64,${base64}`
          }
        }
      ];
    } else {
      // For DOCX/text files, extract as text
      const text = await fileData.text();
      userContent = [
        {
          type: "text",
          text: `Extract ALL data from this CV/Resume. Only include what is explicitly written - do not make up anything.\n\nFile name: ${fileName}\n\nCV Content:\n${text.substring(0, 15000)}`
        }
      ];
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

You must respond using the extract_cv_data tool.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_cv_data",
              description: "Return all extracted structured and unstructured data from a CV",
              parameters: {
                type: "object",
                properties: {
                  fullName: { type: "string", description: "Full name of the candidate as written in CV" },
                  email: { type: "string", description: "Email address from CV, empty string if not found" },
                  phone: { type: "string", description: "Phone number from CV, empty string if not found" },
                  location: { type: "string", description: "Location/city/address from CV, empty string if not found" },
                  linkedinUrl: { type: "string", description: "LinkedIn profile URL from CV, empty string if not found" },
                  githubUrl: { type: "string", description: "GitHub profile URL from CV, empty string if not found" },
                  portfolioUrl: { type: "string", description: "Portfolio or personal website URL from CV, empty string if not found" },
                  currentCompany: { type: "string", description: "Current or most recent company/employer name from CV, empty string if not found" },
                  skills: {
                    type: "array",
                    items: { type: "string" },
                    description: "All technical and soft skills explicitly mentioned in the CV"
                  },
                  suggestedRoles: {
                    type: "array",
                    items: { type: "string" },
                    description: "Job titles/roles the person has held or appears to be targeting based on CV content"
                  },
                  experienceYears: {
                    type: "number",
                    description: "Total years of professional experience calculated from work history"
                  },
                  education: {
                    type: "string",
                    description: "Education details: degrees, institutions, graduation years. Empty string if not found."
                  },
                  certifications: {
                    type: "array",
                    items: { type: "string" },
                    description: "All certifications explicitly mentioned in the CV. Empty array if none found."
                  },
                  languages: {
                    type: "array",
                    items: { type: "string" },
                    description: "All languages spoken as mentioned in the CV. Empty array if none found."
                  },
                  cvSummary: {
                    type: "string",
                    description: "Comprehensive first-person summary covering: recent projects with technologies used, achievements, awards, publications, methodologies, and any other notable information from the CV. Only include facts from the CV."
                  }
                },
                required: ["fullName", "email", "phone", "location", "linkedinUrl", "githubUrl", "portfolioUrl", "currentCompany", "skills", "suggestedRoles", "experienceYears", "education", "certifications", "languages", "cvSummary"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_cv_data" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured data");
    }

    const result = JSON.parse(toolCall.function.arguments);

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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { generateGeminiJson } from "../_shared/gemini.ts";
import {
  buildSynthesisGrounding,
  buildSynthesisUserPrompt,
  formatGroundingForPrompt,
  hasSynthesisGrounding,
  normalizeSynthesisResult,
  SYNTHESIS_SYSTEM_PROMPT,
  type SynthesisResult,
} from "../_shared/synthesize-form-answer.ts";
import { enforceUsageLimit } from "../_shared/usage-limits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Sign in to JobAI Scout before using synthesized fill." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json({ error: "Synthesis service is not configured." }, 500);
    }
    if (!geminiApiKey) return json({ error: "AI service is not configured." }, 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user?.id) return json({ error: "Your session has expired. Please sign in again." }, 401);

    const body = await req.json();
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question || question.length > 2000) {
      return json({ error: "A valid application question is required." }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Form Fill category — check quota without incrementing (fill attempt already meters via track-extension-usage).
    const usage = await enforceUsageLimit(supabase, user.id, "form_fill", { record: false });
    if (!usage.allowed) {
      return json(usage.body, usage.status);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("skills, career_profile")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const grounding = buildSynthesisGrounding((profile || {}) as Record<string, unknown>);
    if (!hasSynthesisGrounding(grounding)) {
      const empty: SynthesisResult = { answer: null, insufficient_data: true };
      return json(empty);
    }

    const groundingText = formatGroundingForPrompt(grounding);
    const parsed = await generateGeminiJson<SynthesisResult>(geminiApiKey, [
      { role: "system", content: SYNTHESIS_SYSTEM_PROMPT },
      { role: "user", content: buildSynthesisUserPrompt(question, groundingText) },
    ], { temperature: 0.3, maxOutputTokens: 512 });

    const result = normalizeSynthesisResult(parsed);
    return json(result);
  } catch (error) {
    console.error("synthesize-form-answer error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown" }, 500);
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assistantSessionLimitState } from "../_shared/assistant-session-limits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const allowedToolNames = new Set([
  "navigate", "read_current_job", "explain_job", "get_application_history", "get_stats", "analyze_cv",
  "compare_job_to_profile", "search_jobs", "scrape_jobs", "save_job", "remove_saved_job", "apply_to_job",
  "generate_cover_letter", "update_profile", "upload_cv", "create_automation", "stop_automation",
  "list_automations", "set_notification_rule",
  "remember_user_preference",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const sessionId = typeof body.session_id === "string" ? body.session_id : "";
    if (!sessionId) return json({ error: "A conversation session is required" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: session } = await admin.from("assistant_sessions").select("input_tokens,output_tokens").eq("id", sessionId).eq("user_id", user.id).maybeSingle();
    if (!session) return json({ error: "Conversation session not found" }, 404);
    if (assistantSessionLimitState(Number(session.input_tokens), Number(session.output_tokens)).reached) {
      return json({ error: "This chat has reached its token limit. Start a new chat to continue.", code: "SESSION_LIMIT", usage: session }, 409);
    }
    const messages = Array.isArray(body.messages) ? body.messages.slice(-32) : [];
    const screenState = body.screen_state && typeof body.screen_state === "object" ? body.screen_state : {};
    const requestedTools = Array.isArray(body.tools) ? body.tools : [];
    const tools = requestedTools
      .filter((tool: Record<string, unknown>) => allowedToolNames.has(String(tool.name)))
      .map((tool: Record<string, unknown>) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) return json({ error: "AI service is not configured" }, 500);

    const systemMessage = {
      role: "system",
      content: `You are the JobAI Scout in-app assistant. Help the user operate the live application and understand jobs.

Use the provided tools whenever an action or live database information is required. Never claim that navigation happened or describe a current job without calling the appropriate tool. You may call multiple tools in sequence. After tools finish, give a concise, natural final response in the user's language. Treat tool results as authoritative.

Current screen state:
${JSON.stringify(screenState)}

Durable user memory and compact cross-session context:
${JSON.stringify(body.memory_context || {})}

When the user states a durable preference about desired role, skills, experience level, location, or automation behavior, call remember_user_preference. Do not infer sensitive facts or store temporary requests.`,
    };

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [systemMessage, ...messages],
        tools,
        tool_choice: "auto",
        temperature: 0.2,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("assistant-agent OpenRouter error", response.status, detail.slice(0, 500));
      return json({ error: response.status === 429 ? "AI rate limit reached. Please try again shortly." : "AI service error" }, response.status === 429 ? 429 : 502);
    }

    const completion = await response.json();
    const message = completion?.choices?.[0]?.message;
    if (!message) return json({ error: "AI service returned no message" }, 502);
    const usage = completion?.usage || {};
    const inputDelta = Number(usage.prompt_tokens) || 0;
    const outputDelta = Number(usage.completion_tokens) || 0;
    const nextInput = Number(session.input_tokens) + inputDelta;
    const nextOutput = Number(session.output_tokens) + outputDelta;
    await admin.from("assistant_sessions").update({ input_tokens: nextInput, output_tokens: nextOutput, updated_at: new Date().toISOString() }).eq("id", sessionId).eq("user_id", user.id);
    return json({ message, usage: { input_tokens: nextInput, output_tokens: nextOutput, near_limit: assistantSessionLimitState(nextInput, nextOutput).near } });
  } catch (error) {
    console.error("assistant-agent error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

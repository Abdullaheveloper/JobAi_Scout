import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assistantSessionLimitState } from "../_shared/assistant-session-limits.ts";
import { normalizeAssistantToolSchema } from "../_shared/assistant-tool-schema.ts";
import { fromGeminiCompletion, toGeminiContents, toGeminiSchema } from "../_shared/assistant-gemini-adapter.ts";

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
  let quotaAdmin: ReturnType<typeof createClient> | null = null;
  let quotaUserId = "";
  let quotaPeriodKey = "";
  let quotaConsumed = false;
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
    quotaAdmin = admin;
    quotaUserId = user.id;
    const { data: quota, error: quotaError } = await admin.rpc("consume_metered_usage", {
      p_user: user.id, p_feature: "chat_bot", p_amount: 1,
    });
    if (quotaError) return json({ error: `Assistant quota check failed: ${quotaError.message}` }, 500);
    if (!quota?.allowed) return json({ error: "limit_reached", feature: "chat_bot", used: quota?.used ?? 0, limit: quota?.limit ?? 0, unit: quota?.unit ?? "messages", resetPeriod: quota?.resetPeriod ?? "fresh", message: quota?.message }, 429);
    quotaConsumed = quota?.limit !== null;
    quotaPeriodKey = quota?.periodKey || "";
    const { data: session } = await admin.from("assistant_sessions").select("input_tokens,output_tokens").eq("id", sessionId).eq("user_id", user.id).maybeSingle();
    if (!session) return json({ error: "Conversation session not found" }, 404);
    if (assistantSessionLimitState(Number(session.input_tokens), Number(session.output_tokens)).reached) {
      return json({ error: "This chat has reached its token limit. Start a new chat to continue.", code: "SESSION_LIMIT", usage: session }, 409);
    }
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter((message: Record<string, unknown>) => {
        if (message.role !== "assistant" || typeof message.content !== "string") return true;
        return !/AI provider|AI service error|internal issue preventing me|network dropped mid-response/i.test(message.content);
      })
      .slice(-32);
    const screenState = body.screen_state && typeof body.screen_state === "object" ? body.screen_state : {};
    const requestedTools = Array.isArray(body.tools) ? body.tools : [];
    const tools = requestedTools
      .filter((tool: Record<string, unknown>) => allowedToolNames.has(String(tool.name)))
      .map((tool: Record<string, unknown>) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: normalizeAssistantToolSchema(tool.parameters),
        },
      }));

    const systemInstruction = `You are the JobAI Scout in-app assistant. Help the user operate the live application and understand jobs.

Use the provided tools whenever an action or live database information is required. Never claim that navigation happened or describe a current job without calling the appropriate tool. You may call multiple tools in sequence. After tools finish, give a concise, natural final response in the user's language. Treat tool results as authoritative.
Use search_jobs for normal job searches because it reads stored database records. Call scrape_jobs only when the user explicitly asks to "Find Jobs", "start scraping", "scrape jobs", or otherwise clearly requests fresh external collection. Never infer permission to scrape from an ordinary search query or filter request.

Current screen state:
${JSON.stringify(screenState)}

The user's selected language is ${JSON.stringify(screenState.language || "en")} and their IANA timezone is ${JSON.stringify(screenState.timezone || "UTC")}.
Always reply in that selected language. Supported languages are English (en), French (fr), German (de), Hindi (hi), Urdu (ur), and Arabic (ar).
For schedules, interpret the user's clock time in their IANA timezone and always pass that timezone to create_automation. Never silently convert a displayed time to UTC.

Durable user memory and compact cross-session context:
${JSON.stringify(body.memory_context || {})}

When the user states a durable preference about desired role, skills, experience level, location, or automation behavior, call remember_user_preference. Do not infer sensitive facts or store temporary requests.`;

    let completion: Record<string, unknown> | null = null;
    let response: Response | null = null;
    let responseDetail = "";
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (geminiKey) {
      response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: toGeminiContents(messages),
          tools: [{
            functionDeclarations: tools.map((tool: Record<string, unknown>) => {
              const fn = tool.function as Record<string, unknown>;
              return { name: fn.name, description: fn.description, parameters: toGeminiSchema(fn.parameters) };
            }),
          }],
          toolConfig: { functionCallingConfig: { mode: "AUTO" } },
          generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
        }),
      });
      if (response.ok) {
        const adapted = fromGeminiCompletion(await response.json());
        if (adapted.message.content || adapted.message.tool_calls?.length) completion = { choices: [{ message: adapted.message }], usage: adapted.usage, provider: "gemini" };
      } else {
        responseDetail = await response.text();
        console.error("assistant-agent Gemini error; trying fallback", response.status, responseDetail.slice(0, 500));
      }
    }

    const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!completion && openRouterKey) {
      const systemMessage = { role: "system", content: systemInstruction };
      responseDetail = "";
      // Free-tier credit availability can vary. The final small reservation
      // keeps basic actions available when Gemini is temporarily unavailable.
      for (const maxTokens of [700, 350, 128]) {
        response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${openRouterKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [systemMessage, ...messages], tools, tool_choice: "auto", temperature: 0.2, max_tokens: maxTokens }),
        });
        if (response.status !== 402) break;
        responseDetail = await response.text();
      }
      if (response?.ok) completion = { ...await response.json(), provider: "openrouter" };
    }

    if (!completion && response && !response.ok) {
      const detail = responseDetail || await response.text();
      console.error("assistant-agent provider error", response.status, detail.slice(0, 500));
      const providerError = response.status === 429
        ? "AI rate limit reached. Please try again shortly."
        : response.status === 401 || response.status === 403
          ? "AI provider authentication failed. Please contact support."
          : response.status === 402
            ? "The AI provider cannot fund even a short reply. Add OpenRouter credits or configure a paid provider."
            : response.status >= 500
              ? "The AI provider is temporarily unavailable. Please try again shortly."
              : "The assistant request was rejected. Please refresh and try again.";
      if (quotaConsumed && quotaPeriodKey) await admin.rpc("refund_metered_usage", { p_user: user.id, p_feature: "chat_bot", p_amount: 1, p_period_key: quotaPeriodKey });
      quotaConsumed = false;
      return json({ error: providerError }, response.status === 429 ? 429 : 502);
    }
    if (!completion) {
      if (quotaConsumed && quotaPeriodKey) await admin.rpc("refund_metered_usage", { p_user: user.id, p_feature: "chat_bot", p_amount: 1, p_period_key: quotaPeriodKey });
      quotaConsumed = false;
      return json({ error: "AI service is not configured or returned no response." }, 502);
    }

    const choices = completion.choices as Array<Record<string, unknown>> | undefined;
    const message = choices?.[0]?.message;
    if (!message) return json({ error: "AI service returned no message" }, 502);
    const usage = (completion.usage as Record<string, unknown> | undefined) || {};
    const inputDelta = Number(usage.prompt_tokens) || 0;
    const outputDelta = Number(usage.completion_tokens) || 0;
    const nextInput = Number(session.input_tokens) + inputDelta;
    const nextOutput = Number(session.output_tokens) + outputDelta;
    await admin.from("assistant_sessions").update({ input_tokens: nextInput, output_tokens: nextOutput, updated_at: new Date().toISOString() }).eq("id", sessionId).eq("user_id", user.id);
    return json({ message, usage: { input_tokens: nextInput, output_tokens: nextOutput, near_limit: assistantSessionLimitState(nextInput, nextOutput).near } });
  } catch (error) {
    if (quotaConsumed && quotaAdmin && quotaPeriodKey && quotaUserId) {
      await quotaAdmin.rpc("refund_metered_usage", { p_user: quotaUserId, p_feature: "chat_bot", p_amount: 1, p_period_key: quotaPeriodKey }).catch(() => undefined);
    }
    console.error("assistant-agent error", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

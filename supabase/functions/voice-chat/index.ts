import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const EMBED_MODEL = "openai/text-embedding-3-small";
const CHAT_MODEL = "google/gemini-2.5-flash";

// Language detection from text patterns
function detectLanguage(text: string): string {
  const arabicRe = /[\u0600-\u06FF\u0750-\u077F]/;
  const devanagariRe = /[\u0900-\u097F]/;
  const frenchRe = /\b(je|tu|il|elle|nous|vous|ils|elles|le|la|les|un|une|des|est|sont|avoir|être|dans|pour|avec|sur|pas|que|qui|ce|cette)\b/i;
  const germanRe = /\b(ich|du|er|sie|es|wir|ihr|ist|sind|haben|sein|und|oder|aber|für|mit|von|zu|auf|in|der|die|das|ein|eine)\b/i;

  const arabicCount = (text.match(arabicRe) || []).length;
  const devanagariCount = (text.match(devanagariRe) || []).length;
  const frenchCount = (text.match(frenchRe) || []).length;
  const germanCount = (text.match(germanRe) || []).length;

  if (arabicCount > text.length * 0.3) return "ar";
  if (devanagariCount > text.length * 0.2) return "hi";
  if (frenchCount > 3) return "fr";
  if (germanCount > 3) return "de";
  if (arabicCount > 0 && /[\u0679\u0688\u0691\u06BA\u06BE\u06C1\u06CC\u06D2]/.test(text)) return "ur";
  return "en";
}

// Personality system prompts
const PERSONALITIES: Record<string, string> = {
  professional: "You speak in a clear, professional manner. You are knowledgeable and efficient.",
  friendly: "You speak warmly and casually. You use friendly language and show enthusiasm.",
  recruiter: "You speak like an experienced recruiter. You give practical career advice and industry insights.",
  support: "You are a helpful support agent. You are patient, empathetic, and thorough in explaining things.",
};

const BASE_SYSTEM_PROMPT = `You are the official AI assistant for Job Scout AI — a platform that helps job seekers find jobs, build CVs, and prepare for interviews.

Primary rule: answer questions about the website, company, products, services, pricing, policies, FAQs, blogs, or documentation ONLY from the retrieved context below. Never invent pricing, services, features, or policies.

If the user's question is about the website/company AND the retrieved context does NOT contain the answer, reply:
"I couldn't find that specific information, but I'm happy to help with general career advice."

Fallback allowance: General career advice (resumes, interviews, job search, salary tips, skill recommendations) MAY be answered from your general knowledge even if not in the retrieved context. Make clear when you are giving general advice vs. answering from the website.

Never hallucinate. Never invent information. Be concise and helpful. Speak naturally — your answer will be read aloud.
Always respond in the same language the user used.`;

function sanitizeInput(text: string): string {
  return text
    .replace(/ignore (all )?previous instructions/gi, "")
    .replace(/you are now/gi, "")
    .replace(/system prompt/gi, "")
    .replace(/\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>/gi, "")
    .trim();
}

async function embedOne(text: string, apiKey: string): Promise<number[]> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!r.ok) throw new Error(`Embedding failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.data[0].embedding;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Service not configured. Contact admin." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = req.headers.get("Authorization") || "";
    const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const adminSupabase = createClient(supabaseUrl, serviceKey);

    // Auth check
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      return new Response(JSON.stringify({ error: "Please log in to use the voice assistant." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = u.user.id;

    // Parse body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawQuestion: string = ((body.question as string) || "").trim();
    let conversationId: string | null = (body.conversationId as string) || null;
    const personality: string = (body.personality as string) || "professional";
    const speed: number = (body.speed as number) || 1.0;
    const streamMode: boolean = (body.stream as boolean) || false;
    const language: string = (body.language as string) || "";

    if (!rawQuestion) {
      return new Response(JSON.stringify({ error: "Please say something first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const question = sanitizeInput(rawQuestion);
    const startTime = Date.now();
    const detectedLang = language || detectLanguage(question);

    // Load admin settings
    const { data: globalSettings } = await adminSupabase
      .from("voice_settings")
      .select("*")
      .is("user_id", null)
      .maybeSingle();

    const confidenceThreshold = globalSettings?.confidence_threshold ?? 0.70;

    if (globalSettings?.assistant_enabled === false) {
      return new Response(JSON.stringify({ error: "Voice assistant is currently disabled by admin." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure conversation exists
    if (!conversationId) {
      const { data: convo, error: convErr } = await supabase
        .from("voice_conversations")
        .insert({ user_id: userId, title: question.slice(0, 80) })
        .select()
        .single();
      if (convErr) throw new Error(`Could not create conversation: ${convErr.message}`);
      conversationId = convo.id;
    }

    // Load conversation history (last 16 messages = 8 turns)
    const { data: history } = await supabase
      .from("voice_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(16);

    // Embed and retrieve relevant KB chunks
    let qEmbed: number[] | null = null;
    let matches: Array<{ url: string; title: string; content: string; similarity: number }> = [];

    try {
      qEmbed = await embedOne(question, apiKey);
      const { data: matchData } = await supabase.rpc("match_kb_chunks", {
        query_embedding: qEmbed as unknown as string,
        match_user_id: userId,
        match_count: 5,
      });
      matches = matchData || [];
    } catch (embedErr) {
      console.warn("Embedding/retrieval failed (continuing without context):", embedErr);
    }

    const topSimilarity = matches[0]?.similarity ?? 0;
    const confidenceScore = Math.max(0, Math.min(1, topSimilarity));
    const isLowConfidence = confidenceScore < confidenceThreshold;

    const context = matches
      .map((m, i) => `[Source ${i + 1}: ${m.title || m.url}]\n${m.content}`)
      .join("\n\n---\n\n");

    const personalityPrompt = PERSONALITIES[personality] || PERSONALITIES.professional;

    const chatMessages = [
      { role: "system", content: BASE_SYSTEM_PROMPT },
      { role: "system", content: personalityPrompt },
      { role: "system", content: `Retrieved knowledge base context:\n\n${context || "(No website content has been indexed yet. Use general knowledge for career advice.)"}` },
      ...(history || []).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
      { role: "user", content: question },
    ];

    const sources = matches.map((m) => ({ url: m.url, title: m.title, similarity: m.similarity }));

    // Log search analytics (fire-and-forget, don't let it block the response)
    const latencyMs = Date.now() - startTime;
    adminSupabase.from("voice_search_logs").insert({
      user_id: userId,
      conversation_id: conversationId,
      query: question,
      top_similarity: topSimilarity,
      confidence_score: confidenceScore,
      result_count: matches.length,
      language_detected: detectedLang,
      response_latency_ms: latencyMs,
      was_successful: true,
    }).catch((e: unknown) => console.warn("Analytics log failed:", e));

    // ── Streaming Mode ──────────────────────────────────────────────────────
    if (streamMode) {
      const chatResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: CHAT_MODEL, messages: chatMessages, stream: true }),
      });

      if (!chatResp.ok) {
        const errText = await chatResp.text();
        console.error("Chat API error:", chatResp.status, errText);
        return new Response(JSON.stringify({ error: `AI service error (${chatResp.status}). Please try again.` }), {
          status: chatResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const reader = chatResp.body!.getReader();
      const encoder = new TextEncoder();
      let fullAnswer = "";

      const readable = new ReadableStream({
        async start(controller) {
          // Send metadata first so the client knows the conversationId immediately
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "metadata",
            conversationId,
            sources,
            confidence: confidenceScore,
            language: detectedLang,
            isLowConfidence,
          })}\n\n`));

          const decoder = new TextDecoder();
          let buffer = "";
          let closed = false;

          const closeStream = async (answer: string) => {
            if (closed) return;
            closed = true;

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: "done",
              fullAnswer: answer || "I couldn't generate a response. Please try again.",
            })}\n\n`));

            // Persist messages
            try {
              await adminSupabase.from("voice_messages").insert([
                { conversation_id: conversationId, user_id: userId, role: "user", content: question },
                { conversation_id: conversationId, user_id: userId, role: "assistant", content: answer || "I couldn't generate a response." },
              ]);
            } catch (e) {
              console.warn("Failed to persist messages:", e);
            }

            controller.close();
          };

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") {
                  await closeStream(fullAnswer);
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta?.content || "";
                  if (delta) {
                    fullAnswer += delta;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "chunk", text: delta })}\n\n`));
                  }
                } catch {
                  // skip malformed SSE lines
                }
              }
            }

            // Stream ended without [DONE] — still close cleanly
            await closeStream(fullAnswer);
          } catch (streamErr) {
            console.error("Stream read error:", streamErr);
            if (!closed) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: "error",
                error: "Stream interrupted. Please try again.",
              })}\n\n`));
              await closeStream(fullAnswer);
            }
          }
        },
      });

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // ── Non-Streaming Mode ─────────────────────────────────────────────────
    const chatResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: CHAT_MODEL, messages: chatMessages }),
    });

    if (!chatResp.ok) {
      const t = await chatResp.text();
      return new Response(JSON.stringify({ error: `AI service error (${chatResp.status}). Please try again.` }), {
        status: chatResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatJson = await chatResp.json();
    const answer: string = chatJson.choices?.[0]?.message?.content?.trim() || "I couldn't generate a response. Please try again.";

    // Persist messages
    await supabase.from("voice_messages").insert([
      { conversation_id: conversationId, user_id: userId, role: "user", content: question },
      { conversation_id: conversationId, user_id: userId, role: "assistant", content: answer },
    ]);

    return new Response(JSON.stringify({
      answer,
      sources,
      conversationId,
      confidence: confidenceScore,
      language: detectedLang,
      isLowConfidence,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("voice-chat unhandled error:", e);
    return new Response(JSON.stringify({
      error: "Something went wrong. Please try again in a moment.",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

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

function openaiToGemini(messages: Array<{role: string; content: string}>) {
  const systemMsgs = messages.filter(m => m.role === 'system');
  const chatMsgs = messages.filter(m => m.role !== 'system');
  return {
    systemInstruction: systemMsgs.length > 0 ? { parts: [{ text: systemMsgs.map(m => m.content).join('\n\n') }] } : undefined,
    contents: chatMsgs.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
  };
}

async function embedOne(text: string, apiKey: string): Promise<number[]> {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text }] },
      }),
    }
  );
  if (!r.ok) throw new Error(`Embedding failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.embedding.values;
}

// Context-Aware Query Rewriter for follow-up questions
async function rewriteQuery(question: string, history: Array<{role: string; content: string}>, apiKey: string): Promise<string> {
  if (!history || history.length === 0) return question;

  try {
    const prompt = `You are a query reformulation assistant for a semantic search engine.
Given the conversation history and the latest user query, reformulate it into a single, standalone search query containing all relevant details.
If the query is already self-contained or is generic career advice, return it unmodified.
Do not answer the query. Do not include any intro, explanation, or quotes.

Conversation history:
${history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join("\n")}

Latest query: ${question}

Standalone search query:`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 60,
          }
        }),
      }
    );

    if (!resp.ok) return question;
    const json = await resp.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text ? text.replace(/^["']|["']$/g, "") : question;
  } catch (err) {
    console.warn("rewriteQuery failed, using original:", err);
    return question;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
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

    // ── Cache Check ────────────────────────────────────────────────────────
    const { data: cached } = await adminSupabase
      .from("voice_cache")
      .select("*")
      .eq("user_id", userId)
      .eq("query", question.toLowerCase())
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached) {
      // Log analytics for cache hit
      const latencyMs = Date.now() - startTime;
      adminSupabase.from("voice_search_logs").insert({
        user_id: userId,
        conversation_id: conversationId,
        query: question,
        top_similarity: cached.confidence,
        confidence_score: cached.confidence,
        result_count: cached.sources?.length || 0,
        language_detected: detectedLang,
        response_latency_ms: latencyMs,
        was_successful: true,
      }).catch((e: unknown) => console.warn("Analytics log failed:", e));

      // Persist messages
      await supabase.from("voice_messages").insert([
        { conversation_id: conversationId, user_id: userId, role: "user", content: question },
        { conversation_id: conversationId, user_id: userId, role: "assistant", content: cached.answer },
      ]);

      if (streamMode) {
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          async start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: "metadata",
              conversationId,
              sources: cached.sources,
              confidence: cached.confidence,
              language: cached.language,
              isLowConfidence: cached.confidence < confidenceThreshold,
            })}\n\n`));

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: "chunk",
              text: cached.answer,
            })}\n\n`));

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: "done",
              fullAnswer: cached.answer,
            })}\n\n`));

            controller.close();
          }
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

      return new Response(JSON.stringify({
        answer: cached.answer,
        sources: cached.sources,
        conversationId,
        confidence: cached.confidence,
        language: cached.language,
        isLowConfidence: cached.confidence < confidenceThreshold,
        cached: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load conversation history (last 16 messages = 8 turns)
    const { data: history } = await supabase
      .from("voice_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(16);

    // ── Reformulate query for search using context ────────────────────────
    const searchQuestion = await rewriteQuery(question, history || [], apiKey);

    // Embed and retrieve relevant KB chunks
    let qEmbed: number[] | null = null;
    let matches: Array<{ url: string; title: string; content: string; similarity: number }> = [];

    try {
      qEmbed = await embedOne(searchQuestion, apiKey);
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
    
    // Filter matches that meet the similarity threshold
    const highConfidenceMatches = matches.filter(m => m.similarity >= confidenceThreshold);
    const hasHighConfidence = highConfidenceMatches.length > 0;
    const isLowConfidence = !hasHighConfidence;

    let dynamicContextPrompt = "";
    if (hasHighConfidence) {
      const context = highConfidenceMatches
        .map((m, i) => `[Source ${i + 1}: ${m.title || m.url}]\n${m.content}`)
        .join("\n\n---\n\n");
      
      dynamicContextPrompt = `Retrieved knowledge base context (grounded truth):
${context}

You MUST answer the question using ONLY the provided knowledge base context above.
Do not hallucinate or invent any information.
Cite the Source numbers (e.g. [Source 1], [Source 2]) to reference where in the knowledge base you got the information.`;
    } else {
      dynamicContextPrompt = `No relevant information was found in the internal knowledge base for this query.
Therefore, you must fall back to your general AI knowledge to answer the query.
Please explicitly state in a brief, polite manner in your response that you are answering from your general knowledge (e.g., "I couldn't find this in the official documentation, but from my general knowledge...").`;
    }

    const personalityPrompt = PERSONALITIES[personality] || PERSONALITIES.professional;

    const chatMessages = [
      { role: "system", content: BASE_SYSTEM_PROMPT },
      { role: "system", content: personalityPrompt },
      { role: "system", content: dynamicContextPrompt },
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
      const geminiBody = openaiToGemini(chatMessages);
      const chatResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}&alt=sse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiBody),
        }
      );

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

            // Cache response if valid
            if (answer && answer.length > 5) {
              try {
                await adminSupabase.from("voice_cache").upsert({
                  user_id: userId,
                  query: question.toLowerCase(),
                  answer,
                  sources,
                  confidence: confidenceScore,
                  language: detectedLang,
                  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                }, { onConflict: "user_id,query" });
              } catch (cacheErr) {
                console.warn("Failed to write voice cache:", cacheErr);
              }
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
                  const delta = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
    const geminiBody = openaiToGemini(chatMessages);
    const chatResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      }
    );

    if (!chatResp.ok) {
      const t = await chatResp.text();
      return new Response(JSON.stringify({ error: `AI service error (${chatResp.status}). Please try again.` }), {
        status: chatResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatJson = await chatResp.json();
    const answer: string = chatJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "I couldn't generate a response. Please try again.";

    // Persist messages
    await supabase.from("voice_messages").insert([
      { conversation_id: conversationId, user_id: userId, role: "user", content: question },
      { conversation_id: conversationId, user_id: userId, role: "assistant", content: answer },
    ]);

    // Cache response
    try {
      await adminSupabase.from("voice_cache").upsert({
        user_id: userId,
        query: question.toLowerCase(),
        answer,
        sources,
        confidence: confidenceScore,
        language: detectedLang,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "user_id,query" });
    } catch (cacheErr) {
      console.warn("Failed to write voice cache:", cacheErr);
    }

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

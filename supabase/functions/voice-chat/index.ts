import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const EMBED_MODEL = "openai/text-embedding-3-small";
const CHAT_MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `You are a website assistant for the user's site.
Primary rule: answer questions about the website, company, products, services, pricing, policies, FAQs, blogs, or documentation ONLY from the retrieved context below. Never invent pricing, services, features, or policies.

If the user's question is about the website/company AND the retrieved context does NOT contain the answer, reply EXACTLY:
"I couldn't find that information on this website."

Fallback allowance: General career advice (resumes, interviews, job search, salary tips, skill recommendations) MAY be answered from your general knowledge even if not in the retrieved context. Make clear when you are giving general advice vs. answering from the website.

Be concise and helpful. Speak naturally — your answer will be read aloud.`;

async function embedOne(text: string, apiKey: string): Promise<number[]> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!r.ok) throw new Error(`embed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.data[0].embedding;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const auth = req.headers.get("Authorization") || "";
    const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = u.user.id;

    const body = await req.json();
    const question: string = (body.question || "").trim();
    let conversationId: string | null = body.conversationId || null;
    if (!question) {
      return new Response(JSON.stringify({ error: "question required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure conversation
    if (!conversationId) {
      const { data: convo, error: convErr } = await supabase
        .from("voice_conversations")
        .insert({ user_id: userId, title: question.slice(0, 80) })
        .select().single();
      if (convErr) throw convErr;
      conversationId = convo.id;
    }

    // Load short history (last 8)
    const { data: history } = await supabase
      .from("voice_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(16);

    // Embed question + retrieve chunks
    const qEmbed = await embedOne(question, apiKey);
    const { data: matches, error: matchErr } = await supabase.rpc("match_kb_chunks", {
      query_embedding: qEmbed as unknown as string, // pgvector accepts array
      match_user_id: userId,
      match_count: 5,
    });
    if (matchErr) console.warn("match error", matchErr);

    const context = (matches || [])
      .map((m: { url: string; title: string; content: string }, i: number) =>
        `[Source ${i + 1}: ${m.title || m.url}]\n${m.content}`)
      .join("\n\n---\n\n");

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `Retrieved website context:\n\n${context || "(no website content indexed yet)"}` },
      ...(history || []).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: question },
    ];

    const chatResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: CHAT_MODEL, messages }),
    });
    if (!chatResp.ok) {
      const t = await chatResp.text();
      return new Response(JSON.stringify({ error: `chat: ${chatResp.status} ${t}` }), {
        status: chatResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const chatJson = await chatResp.json();
    const answer: string = chatJson.choices?.[0]?.message?.content?.trim() || "I couldn't generate a response.";

    // Persist
    await supabase.from("voice_messages").insert([
      { conversation_id: conversationId, user_id: userId, role: "user", content: question },
      { conversation_id: conversationId, user_id: userId, role: "assistant", content: answer },
    ]);

    const sources = (matches || []).map((m: { url: string; title: string; similarity: number }) => ({
      url: m.url, title: m.title, similarity: m.similarity,
    }));

    return new Response(JSON.stringify({ answer, sources, conversationId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-chat error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
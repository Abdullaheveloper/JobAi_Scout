import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;
const EMBED_MODEL = "openai/text-embedding-3-small";
const EXTRACT_MODEL = "google/gemini-2.5-flash";

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + CHUNK_SIZE, text.length);
    chunks.push(text.slice(i, end));
    if (end >= text.length) break;
    i = end - CHUNK_OVERLAP;
  }
  return chunks;
}

async function embed(texts: string[], apiKey: string): Promise<number[][]> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  if (!r.ok) throw new Error(`embed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.data.map((d: { embedding: number[] }) => d.embedding);
}

async function extractPdfText(base64: string, filename: string, apiKey: string): Promise<string> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: EXTRACT_MODEL,
      messages: [
        {
          role: "system",
          content: "You extract the full readable text from documents. Output ONLY the document text with natural paragraph breaks. No commentary, no markdown fences, no summaries.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Extract all readable text from this PDF (${filename}). Preserve order. Skip headers/footers if repetitive.` },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64}` } },
          ],
        },
      ],
    }),
  });
  if (!r.ok) throw new Error(`extract: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return (j.choices?.[0]?.message?.content || "").trim();
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

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "file required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (file.size > 20 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File too large (max 20MB)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const filename = file.name || "document.pdf";
    const sourceKey = `pdf://${userId}/${Date.now()}-${filename}`;

    // Create source row
    const { data: source, error: srcErr } = await supabase
      .from("kb_sources")
      .insert({ user_id: userId, url: sourceKey, title: filename, status: "crawling" })
      .select().single();
    if (srcErr) throw srcErr;

    try {
      // Base64 encode
      const buf = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      const CS = 8192;
      for (let i = 0; i < buf.length; i += CS) {
        binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, Math.min(i + CS, buf.length))));
      }
      const base64 = btoa(binary);

      const text = await extractPdfText(base64, filename, apiKey);
      if (!text || text.length < 30) throw new Error("Could not extract text from PDF");

      const chunks = chunkText(text);
      type Row = { user_id: string; source_id: string; url: string; title: string; content: string; chunk_index: number; embedding: number[] };
      const rows: Row[] = chunks.map((c, i) => ({
        user_id: userId, source_id: source.id, url: sourceKey, title: filename,
        content: c, chunk_index: i, embedding: [] as unknown as number[],
      }));

      const BATCH = 32;
      for (let i = 0; i < rows.length; i += BATCH) {
        const slice = rows.slice(i, i + BATCH);
        const embeds = await embed(slice.map((r) => r.content), apiKey);
        slice.forEach((r, j) => (r.embedding = embeds[j]));
      }

      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from("kb_chunks").insert(rows.slice(i, i + 100));
        if (error) throw error;
      }

      await supabase.from("kb_sources").update({
        status: "ready", pages_indexed: 1, last_crawled_at: new Date().toISOString(), error: null,
      }).eq("id", source.id);

      return new Response(JSON.stringify({
        success: true, source_id: source.id, chunks: rows.length, characters: text.length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      await supabase.from("kb_sources").update({
        status: "failed", error: (e as Error).message, last_crawled_at: new Date().toISOString(),
      }).eq("id", source.id);
      throw e;
    }
  } catch (e) {
    console.error("kb-ingest-pdf error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
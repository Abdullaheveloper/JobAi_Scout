import { createClient } from "npm:@supabase/supabase-js@2";
import { generateEmbeddings } from "../_shared/openrouter-embeddings.ts";
import { generateGeminiDocumentText } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n") // replace excessive newlines
    .replace(/[ \t]+/g, " ")      // replace duplicate spaces
    .trim();
}

function chunkTextSemantic(text: string, maxChunkSize = CHUNK_SIZE, overlapSize = CHUNK_OVERLAP): string[] {
  const cleaned = cleanText(text);
  const paragraphs = cleaned.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    const paraCleaned = para.trim();
    if (!paraCleaned) continue;

    if ((currentChunk + "\n\n" + paraCleaned).length <= maxChunkSize) {
      currentChunk = currentChunk ? currentChunk + "\n\n" + paraCleaned : paraCleaned;
    } else {
      if (paraCleaned.length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = "";
        }

        const sentences = paraCleaned.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [paraCleaned];
        for (const sentence of sentences) {
          const sentTrimmed = sentence.trim();
          if (!sentTrimmed) continue;

          if ((currentChunk + " " + sentTrimmed).length <= maxChunkSize) {
            currentChunk = currentChunk ? currentChunk + " " + sentTrimmed : sentTrimmed;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
              const lastWords = currentChunk.split(/\s+/);
              let overlapText = "";
              for (let w = lastWords.length - 1; w >= 0; w--) {
                const candidate = lastWords.slice(w).join(" ");
                if (candidate.length <= overlapSize) {
                  overlapText = candidate;
                } else {
                  break;
                }
              }
              currentChunk = overlapText ? overlapText + " " + sentTrimmed : sentTrimmed;
            } else {
              let charIndex = 0;
              while (charIndex < sentTrimmed.length) {
                const end = Math.min(charIndex + maxChunkSize, sentTrimmed.length);
                chunks.push(sentTrimmed.slice(charIndex, end));
                charIndex = end - overlapSize;
                if (charIndex >= sentTrimmed.length - overlapSize) break;
              }
            }
          }
        }
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = paraCleaned;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.filter(c => c.trim().length > 10);
}

function parsePagesAndChunk(text: string, maxChunkSize = CHUNK_SIZE, overlapSize = CHUNK_OVERLAP): Array<{ content: string; pageNumber: number }> {
  const parts = text.split(/\[PAGE\s+\d+\]/gi);
  const markers = [...text.matchAll(/\[PAGE\s+(\d+)\]/gi)].map(m => parseInt(m[1]));

  const chunksWithPages: Array<{ content: string; pageNumber: number }> = [];

  if (parts.length <= 1 || markers.length === 0) {
    const chunks = chunkTextSemantic(text, maxChunkSize, overlapSize);
    return chunks.map(c => ({ content: c, pageNumber: 1 }));
  }

  const firstPart = parts[0].trim();
  if (firstPart) {
    const chunks = chunkTextSemantic(firstPart, maxChunkSize, overlapSize);
    for (const c of chunks) {
      chunksWithPages.push({ content: c, pageNumber: 1 });
    }
  }

  for (let i = 1; i < parts.length; i++) {
    const pageNum = markers[i - 1] || 1;
    const pageText = parts[i].trim();
    if (!pageText) continue;

    const chunks = chunkTextSemantic(pageText, maxChunkSize, overlapSize);
    for (const c of chunks) {
      chunksWithPages.push({ content: c, pageNumber: pageNum });
    }
  }

  return chunksWithPages;
}

async function embed(texts: string[], geminiApiKey: string): Promise<number[][]> {
  const results: number[][] = [];
  const BATCH = 16;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    results.push(...await generateEmbeddings(batch, geminiApiKey));
  }
  return results;
}

async function extractPdfText(base64: string, filename: string, geminiApiKey: string): Promise<string> {
  return generateGeminiDocumentText(geminiApiKey, `Extract all readable text from this PDF (${filename}). Preserve order. Identify the pages and insert explicit page markers like "[PAGE 1]", "[PAGE 2]", etc. at the beginning of each page's content. Skip headers/footers if repetitive.`, base64, "application/pdf");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!apiKey) throw new Error("GEMINI_API_KEY missing");

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

      const text = await extractPdfText(base64, filename, apiKey || "");
      if (!text || text.length < 30) throw new Error("Could not extract text from PDF");

      const pagesAndChunks = parsePagesAndChunk(text, CHUNK_SIZE, CHUNK_OVERLAP);
      type Row = {
        user_id: string;
        source_id: string;
        url: string;
        title: string;
        content: string;
        chunk_index: number;
        embedding: number[];
        metadata: Record<string, unknown>;
      };
      
      const rows: Row[] = pagesAndChunks.map((pc, i) => ({
        user_id: userId,
        source_id: source.id,
        url: sourceKey,
        title: filename,
        content: pc.content,
        chunk_index: i,
        embedding: [] as unknown as number[],
        metadata: {
          page_number: pc.pageNumber,
          document_id: source.id,
          source: sourceKey,
          filename: filename,
          created_at: new Date().toISOString()
        }
      }));

      const BATCH = 32;
      for (let i = 0; i < rows.length; i += BATCH) {
        const slice = rows.slice(i, i + BATCH);
        const embeds = await embed(slice.map((r) => r.content), apiKey || "");
        slice.forEach((r, j) => (r.embedding = embeds[j]));
      }

      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from("kb_chunks").insert(rows.slice(i, i + 100));
        if (error) throw error;
      }

      // Invalidate cache for this user
      await supabase.from("voice_cache").delete().eq("user_id", userId);

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

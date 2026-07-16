import { createClient } from "npm:@supabase/supabase-js@2";
import { generateEmbeddings } from "../_shared/openrouter-embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_PAGES = 30;
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

function stripHtml(html: string): { text: string; title: string; links: string[] } {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";
  const linkRegex = /<a[^>]+href=["']([^"'#]+)["']/gi;
  const links: string[] = [];
  let m;
  while ((m = linkRegex.exec(html)) !== null) links.push(m[1]);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return { text, title, links };
}

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

async function embed(texts: string[], geminiApiKey: string): Promise<number[][]> {
  const results: number[][] = [];
  const BATCH = 16;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    results.push(...await generateEmbeddings(batch, geminiApiKey));
  }
  return results;
}

async function fetchSitemap(origin: string): Promise<string[]> {
  try {
    const r = await fetch(new URL("/sitemap.xml", origin).toString(), { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const xml = await r.text();
    const matches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    return matches;
  } catch {
    return [];
  }
}

async function crawlSite(startUrl: string): Promise<Array<{ url: string; text: string; title: string }>> {
  const start = new URL(startUrl);
  const origin = start.origin;
  const visited = new Set<string>();
  const queue: string[] = [];
  const sitemapUrls = await fetchSitemap(origin);
  for (const u of sitemapUrls) {
    try {
      if (new URL(u).origin === origin) queue.push(u);
    } catch { /* skip */ }
  }
  if (queue.length === 0) queue.push(startUrl);

  const pages: Array<{ url: string; text: string; title: string }> = [];

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LovableKBBot/1.0)",
          "Accept": "text/html,application/xhtml+xml",
        },
      });
      if (!r.ok) continue;
      const ct = r.headers.get("content-type") || "";
      if (!ct.includes("text/html")) continue;
      const html = await r.text();
      const { text, title, links } = stripHtml(html);
      if (text.length > 40) pages.push({ url, text, title: title || url });
      for (const link of links) {
        try {
          const abs = new URL(link, url).toString().split("#")[0];
          if (new URL(abs).origin === origin && !visited.has(abs) && queue.length < MAX_PAGES * 3) {
            queue.push(abs);
          }
        } catch { /* skip */ }
      }
    } catch {
      // skip
    }
  }
  return pages;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert source
    const { data: srcData, error: srcErr } = await supabase
      .from("kb_sources")
      .upsert({ user_id: userId, url, status: "crawling" }, { onConflict: "id" })
      .select()
      .single();
    let source = srcData;
    if (srcErr || !source) {
      const { data: existing } = await supabase
        .from("kb_sources").select("*").eq("user_id", userId).eq("url", url).maybeSingle();
      if (existing) {
        source = existing;
        await supabase.from("kb_sources").update({ status: "crawling", error: null }).eq("id", existing.id);
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from("kb_sources")
          .insert({ user_id: userId, url, status: "crawling" })
          .select().single();
        if (insErr) throw insErr;
        source = inserted;
      }
    }

    // Crawl
    const pages = await crawlSite(url);
    if (pages.length === 0) {
      await supabase.from("kb_sources").update({
        status: "failed",
        error: "No readable content found. If this is a JavaScript single-page app (React/Vite/Next client-only), the crawler can't see rendered text — try a server-rendered URL, a /sitemap.xml, or upload a PDF instead.",
        last_crawled_at: new Date().toISOString(),
      }).eq("id", source.id);
      return new Response(JSON.stringify({
        error: "No readable content found at that URL. If it's a client-rendered SPA, the crawler can't extract text. Try a server-rendered site or upload a PDF.",
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Wipe old chunks
    await supabase.from("kb_chunks").delete().eq("source_id", source.id);

    // Chunk + embed in batches
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
    const rows: Row[] = [];
    for (const p of pages) {
      const chunks = chunkTextSemantic(p.text);
      for (let i = 0; i < chunks.length; i++) {
        rows.push({
          user_id: userId,
          source_id: source.id,
          url: p.url,
          title: p.title,
          content: chunks[i],
          chunk_index: i,
          embedding: [] as unknown as number[],
          metadata: {
            document_id: source.id,
            source: p.url,
            title: p.title,
            created_at: new Date().toISOString()
          }
        });
      }
    }

    const BATCH = 32;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const embeds = await embed(slice.map((r) => r.content), apiKey || "");
      slice.forEach((r, j) => (r.embedding = embeds[j]));
    }

    // Insert in batches
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabase.from("kb_chunks").insert(rows.slice(i, i + 100));
      if (error) throw error;
    }

    // Invalidate cache for this user
    await supabase.from("voice_cache").delete().eq("user_id", userId);

    await supabase.from("kb_sources").update({
      status: "ready",
      pages_indexed: pages.length,
      title: pages[0]?.title || url,
      last_crawled_at: new Date().toISOString(),
      error: null,
    }).eq("id", source.id);

    return new Response(JSON.stringify({
      success: true, source_id: source.id, pages: pages.length, chunks: rows.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("kb-reindex error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

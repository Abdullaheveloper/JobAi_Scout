import { createClient } from "npm:@supabase/supabase-js@2";

// ─── CORS Headers ─────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Shared Constants ──────────────────────────────────────────────────────────
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;

// ─── Text Cleaning ────────────────────────────────────────────────────────────
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\u0000/g, "")        // strip null bytes
    .trim();
}

// ─── Heading Extraction ───────────────────────────────────────────────────────
function extractSectionHeadings(text: string): Map<number, string> {
  const headings = new Map<number, string>();
  const lines = text.split("\n");
  let charPos = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    // Markdown headings
    const mdMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (mdMatch) {
      headings.set(charPos, mdMatch[2].trim());
    }
    // ALL CAPS headings (common in PDFs and DOCs)
    else if (trimmed.length > 4 && trimmed.length < 120 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
      headings.set(charPos, trimmed);
    }
    charPos += line.length + 1;
  }
  return headings;
}

function findNearestHeading(pos: number, headings: Map<number, string>): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const [hPos, hText] of headings) {
    if (hPos <= pos && pos - hPos < bestDist) {
      bestDist = pos - hPos;
      best = hText;
    }
  }
  return best;
}

// ─── Semantic Chunking ────────────────────────────────────────────────────────
function chunkTextSemantic(
  text: string,
  maxChunkSize = CHUNK_SIZE,
  overlapSize = CHUNK_OVERLAP
): Array<{ content: string; startPos: number }> {
  const cleaned = cleanText(text);
  const paragraphs = cleaned.split(/\n\n+/);
  const chunks: Array<{ content: string; startPos: number }> = [];
  let currentChunk = "";
  let currentPos = 0;
  let chunkStartPos = 0;

  for (const para of paragraphs) {
    const paraCleaned = para.trim();
    if (!paraCleaned) { currentPos += para.length + 2; continue; }

    if ((currentChunk + "\n\n" + paraCleaned).length <= maxChunkSize) {
      currentChunk = currentChunk ? currentChunk + "\n\n" + paraCleaned : paraCleaned;
    } else {
      if (paraCleaned.length > maxChunkSize) {
        if (currentChunk) {
          chunks.push({ content: currentChunk, startPos: chunkStartPos });
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
              chunks.push({ content: currentChunk, startPos: chunkStartPos });
              chunkStartPos = currentPos;
              currentChunk = sentTrimmed;
            } else {
              let charIdx = 0;
              while (charIdx < sentTrimmed.length) {
                const end = Math.min(charIdx + maxChunkSize, sentTrimmed.length);
                chunks.push({ content: sentTrimmed.slice(charIdx, end), startPos: currentPos + charIdx });
                charIdx = end - overlapSize;
                if (charIdx >= sentTrimmed.length - overlapSize) break;
              }
            }
          }
        }
      } else {
        if (currentChunk) {
          chunks.push({ content: currentChunk, startPos: chunkStartPos });
        }
        chunkStartPos = currentPos;
        currentChunk = paraCleaned;
      }
    }
    currentPos += para.length + 2;
  }

  if (currentChunk) chunks.push({ content: currentChunk, startPos: chunkStartPos });
  return chunks.filter(c => c.content.trim().length > 10);
}

// ─── Page-Aware Chunking (for PDFs) ───────────────────────────────────────────
function parsePagesAndChunk(
  text: string,
  maxChunkSize = CHUNK_SIZE,
  overlapSize = CHUNK_OVERLAP
): Array<{ content: string; pageNumber: number; startPos: number }> {
  const parts = text.split(/\[PAGE\s+\d+\]/gi);
  const markers = [...text.matchAll(/\[PAGE\s+(\d+)\]/gi)].map(m => parseInt(m[1]));

  if (parts.length <= 1 || markers.length === 0) {
    return chunkTextSemantic(text, maxChunkSize, overlapSize).map(c => ({
      ...c, pageNumber: 1,
    }));
  }

  const result: Array<{ content: string; pageNumber: number; startPos: number }> = [];
  const firstPart = parts[0].trim();
  if (firstPart) {
    chunkTextSemantic(firstPart, maxChunkSize, overlapSize).forEach(c => {
      result.push({ ...c, pageNumber: 1 });
    });
  }

  for (let i = 1; i < parts.length; i++) {
    const pageNum = markers[i - 1] || i;
    const pageText = parts[i].trim();
    if (!pageText) continue;
    chunkTextSemantic(pageText, maxChunkSize, overlapSize).forEach(c => {
      result.push({ ...c, pageNumber: pageNum });
    });
  }

  return result;
}

// ─── Embedding (single) ───────────────────────────────────────────────────────
async function embed(texts: string[], openrouterApiKey: string): Promise<number[][]> {
  if (!openrouterApiKey) throw new Error("OPENROUTER_API_KEY is missing");
  const results: number[][] = [];
  const BATCH = 16;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const r = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-embedding-2",
        input: batch,
        dimensions: 1536,
      }),
    });
    if (!r.ok) throw new Error(`OpenRouter embed failed: ${r.status} ${await r.text()}`);
    const json = await r.json();
    if (!json.data || !Array.isArray(json.data)) throw new Error(`Invalid OpenRouter response: ${JSON.stringify(json)}`);
    const sorted = [...json.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    for (const item of sorted) {
      if (item.embedding) results.push(item.embedding.slice(0, 1536));
    }
  }
  return results;
}

// ─── Gemini Multimodal Extraction ─────────────────────────────────────────────
async function extractWithGemini(
  base64Data: string,
  mimeType: string,
  filename: string,
  openrouterApiKey: string,
  isPdf = false
): Promise<string> {
  if (!openrouterApiKey) throw new Error("OPENROUTER_API_KEY is missing");
  const prompt = isPdf
    ? `Extract all readable text from this PDF (${filename}). Preserve order. Insert explicit page markers like "[PAGE 1]", "[PAGE 2]", etc. at the beginning of each page's content. Skip repetitive headers/footers.`
    : `Extract all readable text from this document (${filename}). Preserve structure, paragraphs, headings, and lists. Output ONLY the document text — no commentary, no markdown fences, no summaries.`;

  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openrouterApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: "You extract full readable text from documents. Output ONLY the document text with natural paragraph breaks. No commentary, no markdown fences, no summaries."
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "file",
              file: {
                url: `data:${mimeType};base64,${base64Data}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 8000,
    }),
  });
  if (!r.ok) throw new Error(`Gemini extraction failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return (j.choices?.[0]?.message?.content || "").trim();
}

// ─── Format-Specific Extractors ───────────────────────────────────────────────
function extractTxt(buffer: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}

function extractCsv(text: string): string {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return "";
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    return headers.map((h, i) => `${h}: ${values[i] || ""}`).join(", ");
  });
  return `Columns: ${headers.join(", ")}\n\n${rows.join("\n")}`;
}

function extractMarkdown(text: string): string {
  // Keep structure for heading extraction, only remove code fences and HTML
  return text
    .replace(/```[\s\S]*?```/g, "[code block]")
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1))
    .replace(/<[^>]+>/g, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "Image: $1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function toBase64(buf: Uint8Array): string {
  let binary = "";
  const CS = 8192;
  for (let i = 0; i < buf.length; i += CS) {
    binary += String.fromCharCode(...Array.from(buf.subarray(i, Math.min(i + CS, buf.length))));
  }
  return btoa(binary);
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const auth = req.headers.get("Authorization") || "";
    const db = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: u } = await db.auth.getUser();
    if (!u.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = u.user.id;

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Size limit: 20MB
    if (file.size > 20 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File too large (max 20MB)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const filename = file.name || "document";
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const mimeType = file.type || "application/octet-stream";

    // Determine document type
    let documentType = "txt";
    if (ext === "pdf") documentType = "pdf";
    else if (ext === "docx" || ext === "doc") documentType = "docx";
    else if (ext === "csv") documentType = "csv";
    else if (ext === "md" || ext === "markdown") documentType = "md";
    else if (ext === "txt") documentType = "txt";

    const sourceKey = `${documentType}://${userId}/${Date.now()}-${filename}`;

    // Create source record
    const { data: source, error: srcErr } = await db
      .from("kb_sources")
      .insert({
        user_id: userId,
        url: sourceKey,
        title: filename,
        status: "crawling",
        document_type: documentType,
        file_size: file.size,
        mime_type: mimeType,
      })
      .select()
      .single();
    if (srcErr) throw new Error(`Could not create source: ${srcErr.message}`);

    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      let extractedText = "";

      // Extract text based on format
      if (documentType === "pdf") {
        const base64 = toBase64(buffer);
        extractedText = await extractWithGemini(base64, "application/pdf", filename, openrouterApiKey || apiKey || "", true);
      } else if (documentType === "docx" || documentType === "doc") {
        // DOCX: use Gemini multimodal for reliable extraction
        const base64 = toBase64(buffer);
        const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        extractedText = await extractWithGemini(base64, docxMime, filename, openrouterApiKey || apiKey || "", false);
      } else if (documentType === "csv") {
        const rawText = extractTxt(buffer);
        extractedText = extractCsv(rawText);
      } else if (documentType === "md") {
        const rawText = extractTxt(buffer);
        extractedText = extractMarkdown(rawText);
      } else {
        // TXT and everything else
        extractedText = extractTxt(buffer);
      }

      if (!extractedText || extractedText.length < 20) {
        throw new Error(`Could not extract readable text from ${filename}`);
      }

      // Extract section headings from the full text
      const headings = extractSectionHeadings(extractedText);

      // Chunk the text (page-aware for PDFs)
      let chunksWithMeta: Array<{ content: string; pageNumber: number; startPos: number }>;
      if (documentType === "pdf") {
        chunksWithMeta = parsePagesAndChunk(extractedText, CHUNK_SIZE, CHUNK_OVERLAP);
      } else {
        chunksWithMeta = chunkTextSemantic(extractedText, CHUNK_SIZE, CHUNK_OVERLAP).map((c, _) => ({
          ...c, pageNumber: 1,
        }));
      }

      if (chunksWithMeta.length === 0) {
        throw new Error("No text chunks could be generated from the document");
      }

      // Build rows with metadata
      type ChunkRow = {
        user_id: string;
        source_id: string;
        url: string;
        title: string;
        content: string;
        chunk_index: number;
        page_number: number;
        section_heading: string | null;
        document_type: string;
        embedding: number[];
        metadata: Record<string, unknown>;
      };

      const rows: ChunkRow[] = chunksWithMeta.map((c, i) => ({
        user_id: userId,
        source_id: source.id,
        url: sourceKey,
        title: filename,
        content: c.content,
        chunk_index: i,
        page_number: c.pageNumber,
        section_heading: findNearestHeading(c.startPos, headings),
        document_type: documentType,
        embedding: [] as unknown as number[],
        metadata: {
          document_id: source.id,
          source: sourceKey,
          filename,
          document_type: documentType,
          page_number: c.pageNumber,
          chunk_index: i,
          created_at: new Date().toISOString(),
        },
      }));

      // Generate embeddings in batches
      const EMBED_BATCH = 32;
      for (let i = 0; i < rows.length; i += EMBED_BATCH) {
        const slice = rows.slice(i, i + EMBED_BATCH);
        const embeds = await embed(slice.map(r => r.content), openrouterApiKey || apiKey || "");
        slice.forEach((r, j) => (r.embedding = embeds[j]));
      }

      // Insert chunks in batches of 100
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await db.from("kb_chunks").insert(rows.slice(i, i + 100));
        if (error) throw new Error(`Failed to insert chunks: ${error.message}`);
      }

      // Invalidate cache for this user
      await db.from("voice_cache").delete().eq("user_id", userId);

      // Update source status
      await db.from("kb_sources").update({
        status: "ready",
        pages_indexed: Math.max(...chunksWithMeta.map(c => c.pageNumber)),
        last_crawled_at: new Date().toISOString(),
        error: null,
      }).eq("id", source.id);

      return new Response(JSON.stringify({
        success: true,
        source_id: source.id,
        chunks: rows.length,
        characters: extractedText.length,
        document_type: documentType,
        pages: Math.max(...chunksWithMeta.map(c => c.pageNumber)),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (e) {
      await db.from("kb_sources").update({
        status: "failed",
        error: (e as Error).message,
        last_crawled_at: new Date().toISOString(),
      }).eq("id", source.id);
      throw e;
    }
  } catch (e) {
    console.error("kb-ingest-document error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

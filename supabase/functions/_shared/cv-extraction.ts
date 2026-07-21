import { generateGeminiDocumentText } from "./gemini.ts";

export type ExtractionResult = {
  text: string;
  method: string;
  pages: number;
  ocrUsed: boolean;
  charCount: number;
};

const MIN_CHARS_PER_PAGE = 50;
const MAX_TEXT_LENGTH = 50000;

function cleanText(text: string): string {
  const lines = text.split("\n").map((line) => line.trimEnd());
  const cleaned: string[] = [];
  let blankRun = 0;

  for (const line of lines) {
    if (!line.trim()) {
      blankRun += 1;
      if (blankRun <= 2) cleaned.push("");
      continue;
    }
    blankRun = 0;
    cleaned.push(line);
  }

  return cleaned.join("\n").trim();
}

function truncate(text: string, limit = MAX_TEXT_LENGTH): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n\n[... truncated ...]`;
}

async function extractPdfWithUnpdf(data: Uint8Array): Promise<{ text: string; pages: number }> {
  const { extractText, getDocumentProxy } = await import("npm:unpdf@0.12.1");
  const pdf = await getDocumentProxy(data);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  const joined = pages
    .map((pageText, index) => `[PAGE ${index + 1}]\n${(pageText || "").trim()}`)
    .join("\n\n");
  return { text: joined, pages: totalPages || pages.length || 1 };
}

async function extractDocxWithMammoth(data: Uint8Array): Promise<string> {
  const mammoth = await import("npm:mammoth@1.8.0");
  // Mammoth's npm build checks for Node's Buffer API internally. Supabase
  // Edge gives us a Uint8Array from Blob.arrayBuffer(), which can otherwise
  // make valid DOCX files fail before the document XML is read.
  try {
    const { Buffer } = await import("node:buffer");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(data) });
    return result.value || "";
  } catch (bufferError) {
    // Keep a browser-compatible path for Edge runtime updates where the Node
    // compatibility module is unavailable.
    console.warn("Mammoth Buffer path failed; retrying with ArrayBuffer", bufferError);
    const result = await mammoth.extractRawText({ arrayBuffer: data.buffer });
    return result.value || "";
  }
}

async function ocrPdfWithGemini(
  base64: string,
  fileName: string,
  geminiApiKey: string,
): Promise<string> {
  return generateGeminiDocumentText(
    geminiApiKey,
    `OCR this resume/CV (${fileName}). Preserve all text exactly as written. Output only the document text with page markers like [PAGE 1], [PAGE 2]. No commentary.`,
    base64,
    "application/pdf",
  );
}

function toBase64(data: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.subarray(i, Math.min(i + chunkSize, data.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

export async function extractViaPythonService(
  fileData: Blob,
  fileName: string,
  serviceUrl: string,
): Promise<ExtractionResult | null> {
  const formData = new FormData();
  formData.append("file", fileData, fileName);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(`${serviceUrl.replace(/\/$/, "")}/extract`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("Python extractor failed:", response.status, await response.text());
      return null;
    }

    const result = await response.json();
    return {
      text: truncate(cleanText(result.text || "")),
      method: result.method || "python-service",
      pages: result.pages || 1,
      ocrUsed: Boolean(result.ocr_used),
      charCount: result.char_count || (result.text || "").length,
    };
  } catch (error) {
    console.warn("Python extractor unavailable:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractLocally(
  fileData: Blob,
  fileName: string,
  geminiApiKey?: string,
): Promise<ExtractionResult> {
  const lowerName = fileName.toLowerCase();
  const bytes = new Uint8Array(await fileData.arrayBuffer());

  if (lowerName.endsWith(".pdf")) {
    let text = "";
    let pages = 1;
    let method = "unpdf";

    try {
      const extracted = await extractPdfWithUnpdf(bytes);
      text = extracted.text;
      pages = extracted.pages;
    } catch (error) {
      console.warn("unpdf extraction failed:", error);
      text = "";
    }

    const avgChars = text.trim().length / Math.max(pages, 1);
    let ocrUsed = false;

    if (avgChars < MIN_CHARS_PER_PAGE && geminiApiKey) {
      try {
        text = await ocrPdfWithGemini(toBase64(bytes), fileName, geminiApiKey);
        method = "gemini-ocr";
        ocrUsed = true;
      } catch (error) {
        console.warn("Gemini OCR fallback failed:", error);
      }
    }

    const cleaned = truncate(cleanText(text));
    return {
      text: cleaned,
      method,
      pages,
      ocrUsed,
      charCount: cleaned.length,
    };
  }

  if (lowerName.endsWith(".docx") || lowerName.endsWith(".doc")) {
    let text = "";
    let method = "mammoth";

    try {
      text = await extractDocxWithMammoth(bytes);
    } catch (error) {
      console.warn("mammoth extraction failed:", error);
      text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      method = "raw-decode";
    }

    const cleaned = truncate(cleanText(text));
    return {
      text: cleaned,
      method,
      pages: 1,
      ocrUsed: false,
      charCount: cleaned.length,
    };
  }

  const cleaned = truncate(cleanText(new TextDecoder("utf-8", { fatal: false }).decode(bytes)));
  return {
    text: cleaned,
    method: "plain-text",
    pages: 1,
    ocrUsed: false,
    charCount: cleaned.length,
  };
}

export async function extractCvText(
  fileData: Blob,
  fileName: string,
  options?: { serviceUrl?: string; geminiApiKey?: string },
): Promise<ExtractionResult> {
  if (options?.serviceUrl) {
    const fromPython = await extractViaPythonService(fileData, fileName, options.serviceUrl);
    if (fromPython?.text) return fromPython;
  }

  return extractLocally(fileData, fileName, options?.geminiApiKey);
}

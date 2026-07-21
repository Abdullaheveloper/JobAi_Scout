import { fetchWithRetry } from "./http.ts";

const EMBEDDING_MODEL = "gemini-embedding-2";
const VECTOR_DIMENSIONS = 1536;
const EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`;

export async function generateEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");
  if (!texts.length) return [];
  const response = await fetchWithRetry(EMBEDDING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        output_dimensionality: VECTOR_DIMENSIONS,
      })),
    }),
  }, { timeoutMs: 10000, retries: 1 });
  if (!response.ok) throw new Error(`Gemini embeddings failed (${response.status}): ${await response.text()}`);
  const data = await response.json();
  const vectors = (data.embeddings || []).map((item: { values?: number[] }) => item.values || []);
  if (vectors.length !== texts.length || vectors.some((vector: number[]) => vector.length !== VECTOR_DIMENSIONS)) {
    throw new Error("Gemini returned incomplete embedding data");
  }
  return vectors;
}

export async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const [vector] = await generateEmbeddings([text], apiKey);
  if (!vector) throw new Error("Gemini returned no embedding");
  return vector;
}

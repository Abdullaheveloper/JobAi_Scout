const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";

export const GEMINI_FLASH_MODEL = "gemini-2.5-flash";

export type GeminiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function responseText(payload: Record<string, unknown>): string {
  const candidates = payload.candidates as Array<Record<string, unknown>> | undefined;
  const parts = candidates?.[0]?.content as Record<string, unknown> | undefined;
  const contentParts = parts?.parts as Array<Record<string, unknown>> | undefined;
  return contentParts?.map((part) => typeof part.text === "string" ? part.text : "").join("").trim() || "";
}

export async function generateGeminiText(
  apiKey: string,
  messages: GeminiMessage[],
  options: { temperature?: number; maxOutputTokens?: number; responseMimeType?: string } = {},
): Promise<string> {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");
  const system = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
  const contents = messages.filter((message) => message.role !== "system").map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
  const response = await fetch(`${GEMINI_API}/${GEMINI_FLASH_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.4,
        ...(options.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
        ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
      },
    }),
  });
  if (!response.ok) throw new Error(`Gemini API failed (${response.status}): ${await response.text()}`);
  const text = responseText(await response.json());
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

export async function generateGeminiDocumentText(
  apiKey: string,
  prompt: string,
  base64Data: string,
  mimeType: string,
): Promise<string> {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");
  const response = await fetch(`${GEMINI_API}/${GEMINI_FLASH_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64Data } }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 8000 } }),
  });
  if (!response.ok) throw new Error(`Gemini document extraction failed (${response.status}): ${await response.text()}`);
  const text = responseText(await response.json());
  if (!text) throw new Error("Gemini returned no document text");
  return text;
}

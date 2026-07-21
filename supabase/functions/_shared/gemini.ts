const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";

export const GEMINI_FLASH_MODEL = "gemini-2.5-flash";

export type GeminiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GeminiTextOptions = {
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
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
  options: GeminiTextOptions = {},
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

function jsonCandidate(text: string): string {
  const withoutFence = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const first = withoutFence.search(/[\[{]/);
  const last = Math.max(withoutFence.lastIndexOf("}"), withoutFence.lastIndexOf("]"));
  return first >= 0 && last >= first ? withoutFence.slice(first, last + 1) : withoutFence;
}

/**
 * Gemini JSON mode is requested on every call, but a defensive repair pass
 * prevents one malformed model string from failing an otherwise valid CV upload.
 */
export async function generateGeminiJson<T>(
  apiKey: string,
  messages: GeminiMessage[],
  options: GeminiTextOptions = {},
): Promise<T> {
  const parse = (text: string): T => JSON.parse(jsonCandidate(text)) as T;
  const text = await generateGeminiText(apiKey, messages, { ...options, responseMimeType: "application/json" });
  try {
    return parse(text);
  } catch (firstError) {
    console.warn("Gemini returned malformed JSON; requesting a JSON-only repair.", firstError instanceof Error ? firstError.message : firstError);
    const repaired = await generateGeminiText(apiKey, [
      { role: "system", content: "Return only valid JSON. Repair JSON syntax only; preserve the supplied data and do not add commentary." },
      { role: "user", content: `Repair this malformed JSON:\n${text}` },
    ], {
      temperature: 0,
      maxOutputTokens: options.maxOutputTokens ?? 3000,
      responseMimeType: "application/json",
    });
    try {
      return parse(repaired);
    } catch (repairError) {
      console.error("Gemini JSON repair failed.", repairError instanceof Error ? repairError.message : repairError);
      throw new Error("Gemini returned an invalid structured response. Please try the analysis again.");
    }
  }
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

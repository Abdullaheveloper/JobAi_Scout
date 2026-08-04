type JsonObject = Record<string, unknown>;

type OpenAiToolCall = {
  id?: string;
  function?: { name?: string; arguments?: string };
};

type OpenAiMessage = {
  role?: string;
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: OpenAiToolCall[];
};

export function toGeminiSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toGeminiSchema);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as JsonObject)
      .filter(([key]) => key !== "additionalProperties")
      .map(([key, child]) => [key, toGeminiSchema(child)]),
  );
}

function parsedToolResult(content: unknown): JsonObject {
  if (typeof content !== "string") return { result: content ?? null };
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : { result: parsed };
  } catch {
    return { result: content };
  }
}

export function toGeminiContents(messages: OpenAiMessage[]) {
  const callNames = new Map<string, string>();
  const contents: Array<{ role: "user" | "model"; parts: JsonObject[] }> = [];

  for (const message of messages) {
    if (message.role === "assistant") {
      const parts: JsonObject[] = [];
      if (message.content) parts.push({ text: message.content });
      for (const call of message.tool_calls || []) {
        const name = call.function?.name || "unknown_tool";
        if (call.id) callNames.set(call.id, name);
        let args: JsonObject = {};
        try { args = JSON.parse(call.function?.arguments || "{}"); } catch { /* invalid args are handled by the client executor */ }
        parts.push({ functionCall: { name, args } });
      }
      if (parts.length) contents.push({ role: "model", parts });
      continue;
    }

    if (message.role === "tool") {
      const name = callNames.get(message.tool_call_id || "") || "unknown_tool";
      const part = { functionResponse: { name, response: parsedToolResult(message.content) } };
      const previous = contents.at(-1);
      if (previous?.role === "user" && previous.parts.every((item) => "functionResponse" in item)) previous.parts.push(part);
      else contents.push({ role: "user", parts: [part] });
      continue;
    }

    if (typeof message.content === "string" && message.content) {
      contents.push({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] });
    }
  }
  return contents;
}

export function fromGeminiCompletion(payload: JsonObject) {
  const candidates = payload.candidates as JsonObject[] | undefined;
  const content = candidates?.[0]?.content as JsonObject | undefined;
  const parts = content?.parts as JsonObject[] | undefined || [];
  const text = parts.map((part) => typeof part.text === "string" ? part.text : "").join("").trim();
  const calls = parts.flatMap((part, index) => {
    const call = part.functionCall as JsonObject | undefined;
    if (!call || typeof call.name !== "string") return [];
    return [{
      id: `gemini_${index}_${call.name}`,
      type: "function",
      function: { name: call.name, arguments: JSON.stringify(call.args || {}) },
    }];
  });
  return {
    message: { role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) },
    usage: {
      prompt_tokens: Number((payload.usageMetadata as JsonObject | undefined)?.promptTokenCount) || 0,
      completion_tokens: Number((payload.usageMetadata as JsonObject | undefined)?.candidatesTokenCount) || 0,
    },
  };
}

import { describe, expect, it } from "vitest";
import { fromGeminiCompletion, toGeminiContents, toGeminiSchema } from "../../supabase/functions/_shared/assistant-gemini-adapter";

describe("Gemini assistant provider adapter", () => {
  it("converts tool calls and their results across provider formats", () => {
    const contents = toGeminiContents([
      { role: "user", content: "Open automation" },
      { role: "assistant", content: null, tool_calls: [{ id: "call-1", function: { name: "navigate", arguments: '{"target":"automation"}' } }] },
      { role: "tool", tool_call_id: "call-1", content: '{"opened":"automation"}' },
    ]);
    expect(contents[1].parts[0]).toEqual({ functionCall: { name: "navigate", args: { target: "automation" } } });
    expect(contents[2].parts[0]).toEqual({ functionResponse: { name: "navigate", response: { opened: "automation" } } });
  });

  it("converts Gemini function calls to the existing browser contract", () => {
    const completion = fromGeminiCompletion({ candidates: [{ content: { parts: [{ functionCall: { name: "navigate", args: { target: "automation" } } }] } }], usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 8 } });
    expect(completion.message.tool_calls?.[0].function).toEqual({ name: "navigate", arguments: '{"target":"automation"}' });
    expect(completion.usage).toEqual({ prompt_tokens: 20, completion_tokens: 8 });
  });

  it("removes OpenAI-only schema fields before sending declarations to Gemini", () => {
    expect(toGeminiSchema({ type: "object", properties: {}, additionalProperties: false })).toEqual({ type: "object", properties: {} });
  });
});

import { describe, expect, it } from "vitest";
import { normalizeAssistantToolSchema } from "../../supabase/functions/_shared/assistant-tool-schema";

describe("assistant tool schema normalization", () => {
  it("repairs missing nested types and disallows undeclared object fields", () => {
    const schema = normalizeAssistantToolSchema({
      type: "object",
      properties: { value: { description: "A value" } },
      additionalProperties: true,
    });

    expect(schema).toEqual({
      type: "object",
      properties: { value: { type: "string", description: "A value" } },
      additionalProperties: false,
    });
  });
});

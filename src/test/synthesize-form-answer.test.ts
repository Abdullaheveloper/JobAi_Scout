import { describe, expect, it } from "vitest";

import {
  buildSynthesisGrounding,
  buildSynthesisUserPrompt,
  formatGroundingForPrompt,
  hasSynthesisGrounding,
  normalizeSynthesisResult,
  SYNTHESIS_SYSTEM_PROMPT,
} from "../../supabase/functions/_shared/synthesize-form-answer.ts";

describe("synthesize-form-answer shared helpers", () => {
  it("builds grounding from career_profile sections", () => {
    const grounding = buildSynthesisGrounding({
      skills: ["TypeScript", "Docker"],
      career_profile: {
        experiences: [{ title: "Engineer", company: "Acme", summary: "Built APIs" }],
        projects: [{ name: "Portal", description: "Customer dashboard" }],
      },
    });
    expect(grounding.skills).toEqual(["TypeScript", "Docker"]);
    expect(grounding.experiences[0]?.company).toBe("Acme");
    expect(hasSynthesisGrounding(grounding)).toBe(true);
    expect(formatGroundingForPrompt(grounding)).toMatch(/Work experience/);
    expect(formatGroundingForPrompt(grounding)).toMatch(/Projects/);
  });

  it("reports insufficient grounding when empty", () => {
    expect(hasSynthesisGrounding(buildSynthesisGrounding({}))).toBe(false);
  });

  it("normalizes insufficient_data responses", () => {
    expect(normalizeSynthesisResult({ answer: "hello", insufficient_data: true })).toEqual({
      answer: null,
      insufficient_data: true,
    });
    expect(normalizeSynthesisResult({ answer: "  Draft answer  ", insufficient_data: false })).toEqual({
      answer: "Draft answer",
      insufficient_data: false,
    });
  });

  it("includes strict system prompt rules", () => {
    expect(SYNTHESIS_SYSTEM_PROMPT).toMatch(/ONLY/);
    expect(SYNTHESIS_SYSTEM_PROMPT).toMatch(/Never invent/);
    expect(SYNTHESIS_SYSTEM_PROMPT).toMatch(/insufficient_data/);
    expect(buildSynthesisUserPrompt("Why hire you?", "Skills: Go")).toMatch(/Why hire you\?/);
  });
});

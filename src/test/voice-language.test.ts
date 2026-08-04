import { describe, expect, it } from "vitest";
import { toSpeechLocale } from "@/lib/voice/recognition";

describe("voice locale mapping", () => {
  it.each([
    ["en", "en-US"],
    ["fr", "fr-FR"],
    ["de", "de-DE"],
    ["hi", "hi-IN"],
    ["ur", "ur-PK"],
    ["ar", "ar-SA"],
  ])("maps %s to %s without a reload", (locale, expected) => {
    expect(toSpeechLocale(locale)).toBe(expected);
  });
});

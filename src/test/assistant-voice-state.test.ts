import { describe, expect, it } from "vitest";
import { canSpeakAssistantResponse, isStopCommand, shouldSpeakAssistantResponse, speechText } from "@/lib/assistant/voice-state";

describe("assistant voice state helpers", () => {
  it("matches output mode to each individual input turn", () => {
    expect(shouldSpeakAssistantResponse("text")).toBe(false);
    expect(shouldSpeakAssistantResponse("voice")).toBe(true);
    expect(canSpeakAssistantResponse("voice", "text")).toBe(false);
    expect(canSpeakAssistantResponse("voice", "voice")).toBe(true);
  });
  it("catches stop locally despite casing or terminal punctuation", () => {
    expect(isStopCommand("stop")).toBe(true);
    expect(isStopCommand(" STOP! ")).toBe(true);
    expect(isStopCommand("stop the search")).toBe(false);
  });

  it("removes markdown control characters before browser TTS", () => {
    expect(speechText("**Upload CV** is `open`.")).toBe("Upload CV is open.");
  });
});

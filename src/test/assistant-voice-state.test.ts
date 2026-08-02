import { describe, expect, it } from "vitest";
import { isStopCommand, speechText } from "@/lib/assistant/voice-state";

describe("assistant voice state helpers", () => {
  it("catches stop locally despite casing or terminal punctuation", () => {
    expect(isStopCommand("stop")).toBe(true);
    expect(isStopCommand(" STOP! ")).toBe(true);
    expect(isStopCommand("stop the search")).toBe(false);
  });

  it("removes markdown control characters before browser TTS", () => {
    expect(speechText("**Upload CV** is `open`.")).toBe("Upload CV is open.");
  });
});

import { describe, expect, it } from "vitest";
import { compactMemoryContext, type MemoryBootstrap } from "@/lib/assistant/memory";
import { assistantSessionLimitState } from "../../supabase/functions/_shared/assistant-session-limits";

describe("assistant persistent memory", () => {
  it("builds compact cross-session context without replaying the current session", () => {
    const memory = {
      sessions: [], active_session: null,
      profile_memory: [{ memory_key: "desired_role", memory_value: "Frontend Engineer", updated_at: "2026-01-01" }],
      messages: [
        { id: "1", session_id: "old", role: "user", content: "I prefer remote work", linked_tool_call: null, created_at: "2026-01-01" },
        { id: "2", session_id: "current", role: "user", content: "current message", linked_tool_call: null, created_at: "2026-01-02" },
      ], actions: [],
    } satisfies MemoryBootstrap;
    const context = compactMemoryContext(memory, "current") as { profile_memory: Record<string, unknown>; recent_prior_messages: Array<{ content: string }> };
    expect(context.profile_memory.desired_role).toBe("Frontend Engineer");
    expect(context.recent_prior_messages.map((message) => message.content)).toEqual(["I prefer remote work"]);
  });

  it("warns at 90 percent and stops at the hard input or output limit", () => {
    expect(assistantSessionLimitState(809_999, 53_999)).toEqual({ near: false, reached: false });
    expect(assistantSessionLimitState(810_000, 0)).toEqual({ near: true, reached: false });
    expect(assistantSessionLimitState(0, 60_000)).toEqual({ near: true, reached: true });
  });
});

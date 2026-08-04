import { afterEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { runAssistantTurn } from "@/lib/assistant/agent";
import { assistantTools, executeAssistantTool } from "@/lib/assistant/tools";

afterEach(() => vi.restoreAllMocks());

describe("assistant agent tool loop", () => {
  it("executes a model-selected navigation tool and returns the final reply", async () => {
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: { access_token: "test-token" } },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>);

    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{ id: "call-1", type: "function", function: { name: "navigate", arguments: JSON.stringify({ target: "upload_cv" }) } }],
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { opened: "upload_cv" }, ui_update: "Upload CV opened", ui_effect: { type: "navigate", route: "/dashboard/cv" },
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        message: { role: "assistant", content: "Upload CV is open." },
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const navigate = vi.fn();
    const statuses: string[] = [];

    const reply = await runAssistantTurn({
      history: [
        { id: "error-1", role: "assistant", content: "Provider failed", transientError: true },
        { id: "user-1", role: "user", content: "open upload cv" },
      ],
      screen: { route: "/dashboard", visible_job_id: null, role: "user" },
      navigate,
      signal: new AbortController().signal,
      onToolResult: (result) => statuses.push(result.ui_update),
      requestConfirmation: vi.fn(),
      sessionId: "session-1",
      memoryContext: {},
      onUsage: vi.fn(),
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(navigate).toHaveBeenCalledWith("/dashboard/cv");
    expect(statuses).toEqual(["Upload CV opened"]);
    expect(reply).toBe("Upload CV is open.");
    const firstRequest = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(firstRequest.messages).toEqual([{ role: "user", content: "open upload cv" }]);
    const thirdRequest = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(thirdRequest.messages.at(-1)).toMatchObject({ role: "tool", tool_call_id: "call-1" });
  });

  it("exposes the required safe tool contracts", () => {
    expect(assistantTools).toHaveLength(20);
    expect(assistantTools.filter(({ permission_tier }) => permission_tier === "safe").map(({ name }) => name)).toEqual(expect.arrayContaining([
      "navigate", "read_current_job", "explain_job", "get_application_history", "get_stats", "analyze_cv",
      "compare_job_to_profile", "search_jobs", "scrape_jobs", "save_job", "remove_saved_job", "upload_cv",
      "list_automations", "set_notification_rule",
      "remember_user_preference",
    ]));
    expect(assistantTools.filter(({ permission_tier }) => permission_tier === "confirm").map(({ name }) => name)).toEqual([
      "apply_to_job", "generate_cover_letter", "update_profile", "create_automation", "stop_automation",
    ]);
  });

  it("returns a structured result when no current job can be resolved", async () => {
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({ data: { session: { access_token: "test-token" } }, error: null } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ result: { found: false }, ui_update: "No current job found" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const result = await executeAssistantTool("read_current_job", {}, {
      route: "/dashboard/jobs",
      visible_job_id: null,
      role: "user",
      navigate: vi.fn(),
      requestConfirmation: vi.fn(),
    });
    expect(result.result).toMatchObject({ found: false });
    expect(result.ui_update).toBe("No current job found");
  });

  it("does not execute a confirm-tier action until the server ticket is confirmed", async () => {
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({ data: { session: { access_token: "test-token" } }, error: null } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ confirmation_required: true, confirmation: { action_id: "action-1", tool: "apply_to_job", permission_tier: "confirm", scope: "Apply to job 42", title: "Apply to job 42", details: ["Apply to job 42"] } }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { applied: true }, ui_update: "Application submitted" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const requestConfirmation = vi.fn().mockResolvedValue({ decision: "confirm" });
    const result = await executeAssistantTool("apply_to_job", { job_id: "42" }, { route: "/dashboard/jobs/42", visible_job_id: "42", role: "user", navigate: vi.fn(), requestConfirmation });
    expect(requestConfirmation).toHaveBeenCalledWith(expect.objectContaining({ action_id: "action-1", permission_tier: "confirm" }));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({ action_id: "action-1", decision: "confirm", context: { route: "/dashboard/jobs/42", visible_job_id: "42" } });
    expect(result.result).toMatchObject({ applied: true });
  });
});

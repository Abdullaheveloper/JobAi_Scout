import { describe, expect, it } from "vitest";
import { assistantToolPolicy, canRoleExecuteAssistantTool } from "../../supabase/functions/_shared/assistant-tool-policy";

describe("server assistant tool policy", () => {
  it("keeps mutations behind confirmation while safe groups execute directly", () => {
    expect(assistantToolPolicy.apply_to_job.tier).toBe("confirm");
    expect(assistantToolPolicy.update_profile.tier).toBe("confirm");
    expect(assistantToolPolicy.create_automation.tier).toBe("confirm");
    expect(assistantToolPolicy.search_jobs.tier).toBe("safe");
    expect(assistantToolPolicy.set_notification_rule.tier).toBe("safe");
  });

  it("refuses jobseeker tools for recruiter and admin roles on the server policy", () => {
    expect(canRoleExecuteAssistantTool("user", "apply_to_job")).toBe(true);
    expect(canRoleExecuteAssistantTool("recruiter", "apply_to_job")).toBe(false);
    expect(canRoleExecuteAssistantTool("admin", "update_profile")).toBe(false);
    expect(canRoleExecuteAssistantTool("admin", "navigate")).toBe(true);
  });
});

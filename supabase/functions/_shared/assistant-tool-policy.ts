export type AssistantPermissionTier = "safe" | "confirm" | "strong_confirm";
export type AssistantRole = "user" | "recruiter" | "admin";

export const assistantToolPolicy: Record<string, { tier: AssistantPermissionTier; roles: AssistantRole[] }> = {
  navigate: { tier: "safe", roles: ["user", "recruiter", "admin"] },
  read_current_job: { tier: "safe", roles: ["user"] }, explain_job: { tier: "safe", roles: ["user"] },
  get_application_history: { tier: "safe", roles: ["user"] }, get_stats: { tier: "safe", roles: ["user"] },
  analyze_cv: { tier: "safe", roles: ["user"] }, compare_job_to_profile: { tier: "safe", roles: ["user"] },
  search_jobs: { tier: "safe", roles: ["user"] }, scrape_jobs: { tier: "safe", roles: ["user"] },
  save_job: { tier: "safe", roles: ["user"] }, remove_saved_job: { tier: "safe", roles: ["user"] },
  apply_to_job: { tier: "confirm", roles: ["user"] }, generate_cover_letter: { tier: "confirm", roles: ["user"] },
  update_profile: { tier: "confirm", roles: ["user"] }, upload_cv: { tier: "safe", roles: ["user"] },
  create_automation: { tier: "confirm", roles: ["user"] }, stop_automation: { tier: "confirm", roles: ["user"] },
  list_automations: { tier: "safe", roles: ["user"] }, set_notification_rule: { tier: "safe", roles: ["user"] },
  remember_user_preference: { tier: "safe", roles: ["user"] },
};

export function canRoleExecuteAssistantTool(role: AssistantRole, tool: string) {
  return assistantToolPolicy[tool]?.roles.includes(role) === true;
}

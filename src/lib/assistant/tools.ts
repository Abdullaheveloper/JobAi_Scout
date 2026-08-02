import type { NavigateFunction } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export type PermissionTier = "safe" | "confirm" | "strong_confirm";
export type AssistantScreenContext = {
  route: string;
  visible_job_id: string | null;
  role: "admin" | "user" | "recruiter" | null;
  session_id?: string;
  language?: string;
  timezone?: string;
};
export type ConfirmationRequest = { action_id: string; tool: string; permission_tier: PermissionTier; scope: string; title: string; details: string[]; acknowledgement?: string };
export type ConfirmationDecision = { decision: "confirm" | "cancel"; acknowledgement?: string };
export type ToolExecutionResult = { result: Record<string, unknown>; ui_update: string; linked_tool_call?: { name: string; params: Record<string, unknown> } };
export type AssistantToolContext = AssistantScreenContext & {
  navigate: NavigateFunction;
  signal?: AbortSignal;
  requestConfirmation: (request: ConfirmationRequest) => Promise<ConfirmationDecision>;
};
export type AssistantTool = {
  name: string; description: string; parameters: Record<string, unknown>; permission_tier: PermissionTier; needs_screen_context: boolean;
  execute: (params: Record<string, unknown>, ctx: AssistantToolContext) => Promise<ToolExecutionResult>;
};

const object = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const string = (description: string) => ({ type: "string", description });
const jobId = { job_id: string("Optional job ID. Omit it to use the job visible on screen.") };

const specs: Omit<AssistantTool, "execute">[] = [
  { name: "navigate", description: "Open a named JobAI Scout page or section.", parameters: object({ target: { type: "string", enum: ["dashboard","upload_cv","browse_jobs","automation","saved_jobs","applications","form_fill","profile_settings","recruiter_jobs","recruiter_candidates","recruiter_profile","admin_dashboard","admin_users","admin_jobs","admin_analytics"] } }, ["target"]), permission_tier: "safe", needs_screen_context: false },
  { name: "read_current_job", description: "Read the job currently visible in the live site.", parameters: object({}), permission_tier: "safe", needs_screen_context: true },
  { name: "explain_job", description: "Explain a job's role, requirements, compensation, and important details.", parameters: object(jobId), permission_tier: "safe", needs_screen_context: true },
  { name: "get_application_history", description: "Get the signed-in jobseeker's application history.", parameters: object({}), permission_tier: "safe", needs_screen_context: false },
  { name: "get_stats", description: "Get the signed-in jobseeker's job, application, saved-job, and profile statistics.", parameters: object({}), permission_tier: "safe", needs_screen_context: false },
  { name: "analyze_cv", description: "Analyze the user's most recently uploaded CV.", parameters: object({}), permission_tier: "safe", needs_screen_context: false },
  { name: "compare_job_to_profile", description: "Compare a job against the user's stored profile and CV; report matches, gaps, and improvements.", parameters: object(jobId), permission_tier: "safe", needs_screen_context: true },
  { name: "search_jobs", description: "Search jobs already stored in JobAI Scout using natural filters.", parameters: object({ filters: object({ query: string("Keywords or job title"), location: string("Location"), job_type: string("Job type"), work_mode: string("Remote, hybrid, or on-site"), experience_level: string("Experience level"), limit: { type: "integer", minimum: 1, maximum: 50 } }) }, ["filters"]), permission_tier: "safe", needs_screen_context: false },
  { name: "scrape_jobs", description: "Collect fresh jobs from supported sources for a search query.", parameters: object({ query: string("Job search query"), source: string("Optional preferred source"), count: { type: "integer", minimum: 1, maximum: 25 } }, ["query"]), permission_tier: "safe", needs_screen_context: false },
  { name: "save_job", description: "Save a job for the signed-in jobseeker.", parameters: object(jobId), permission_tier: "safe", needs_screen_context: true },
  { name: "remove_saved_job", description: "Remove a job from saved jobs.", parameters: object({ job_id: string("Job ID to remove") }, ["job_id"]), permission_tier: "safe", needs_screen_context: false },
  { name: "apply_to_job", description: "Submit and record an application for a job after explicit confirmation.", parameters: object(jobId), permission_tier: "confirm", needs_screen_context: true },
  { name: "generate_cover_letter", description: "Generate a tailored cover letter for a job after explicit confirmation.", parameters: object(jobId), permission_tier: "confirm", needs_screen_context: true },
  { name: "update_profile", description: "Update selected signed-in jobseeker profile fields after explicit confirmation.", parameters: object({ fields: object({ full_name: string("Full name"), phone: string("Phone number"), location: string("Location"), headline: string("Professional headline"), bio: string("Professional summary"), skills: { type: "array", items: { type: "string" } }, experience_level: string("Experience level"), desired_role: string("Desired role") }) }, ["fields"]), permission_tier: "confirm", needs_screen_context: false },
  { name: "upload_cv", description: "Open the secure CV file picker so the user can upload a CV.", parameters: object({ file: string("Optional file name supplied by the user") }), permission_tier: "safe", needs_screen_context: false },
  { name: "create_automation", description: "Create a scheduled job-search automation. Convert natural language to a five-field cron expression and explicit start time.", parameters: object({ schedule: object({ cron: string("Five-field cron expression"), timezone: string("IANA timezone"), starts_at: string("ISO start datetime"), summary: string("Human-readable schedule") }, ["cron"]), action: object({ query: string("Job search query"), location: string("Optional location"), source: string("Optional source"), count: { type: "integer", minimum: 1, maximum: 25 } }, ["query"]), summary: string("Short automation description") }, ["schedule","action"]), permission_tier: "confirm", needs_screen_context: false },
  { name: "stop_automation", description: "Stop an existing automation after explicit confirmation.", parameters: object({ id: string("Automation ID") }, ["id"]), permission_tier: "confirm", needs_screen_context: false },
  { name: "list_automations", description: "List the signed-in jobseeker's automations.", parameters: object({}), permission_tier: "safe", needs_screen_context: false },
  { name: "set_notification_rule", description: "Create a notification rule for matching jobs or application events.", parameters: object({ criteria: object({ query: string("Keywords or job title"), location: string("Location"), minimum_salary: { type: "number" }, job_type: string("Job type"), work_mode: string("Work mode"), event: string("Application event"), frequency: string("Notification frequency") }) }, ["criteria"]), permission_tier: "safe", needs_screen_context: false },
  { name: "remember_user_preference", description: "Store a durable preference explicitly stated by the user. Use only for desired_role, skills, experience_level, location, or automation_preferences.", parameters: object({ key: { type: "string", enum: ["desired_role","skills","experience_level","location","automation_preferences"] }, value: string("The durable value to remember; serialize lists as a comma-separated string") }, ["key","value"]), permission_tier: "safe", needs_screen_context: false },
];

const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function invoke(body: Record<string, unknown>, signal?: AbortSignal) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please sign in to use assistant actions.");
  let response: Response;
  try {
    response = await fetch(`${functionsUrl}/assistant-tool`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: apiKey }, body: JSON.stringify(body), signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error("The network dropped while running that action. Nothing was hidden; please check your connection and try again.");
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Assistant action failed (${response.status})`);
  return data;
}

function applyUiEffect(effect: { type?: string; route?: string; url?: string } | undefined, ctx: AssistantToolContext) {
  if (effect?.type === "navigate" && effect.route) ctx.navigate(effect.route);
  if (effect?.type === "file_picker") ctx.navigate(effect.route || "/dashboard/cv?assistantUpload=1");
  if (effect?.type === "external_url" && effect.url) window.open(effect.url, "_blank", "noopener,noreferrer");
}

async function executeOnServer(name: string, params: Record<string, unknown>, ctx: AssistantToolContext): Promise<ToolExecutionResult> {
  const context = { route: ctx.route, visible_job_id: ctx.visible_job_id, session_id: ctx.session_id, language: ctx.language, timezone: ctx.timezone };
  let data = await invoke({ tool: name, params, context }, ctx.signal);
  if (data.confirmation_required) {
    const decision = await ctx.requestConfirmation(data.confirmation as ConfirmationRequest);
    data = await invoke({ action_id: data.confirmation.action_id, decision: decision.decision, acknowledgement: decision.acknowledgement, context }, ctx.signal);
  }
  applyUiEffect(data.ui_effect, ctx);
  return { result: data.result || { ok: true }, ui_update: data.ui_update || `${name.replaceAll("_", " ")} completed` };
}

export const assistantTools: AssistantTool[] = specs.map((spec) => ({ ...spec, execute: (params, ctx) => executeOnServer(spec.name, params, ctx) }));
export const assistantToolDefinitions = specs;
export async function executeAssistantTool(name: string, params: Record<string, unknown>, ctx: AssistantToolContext) {
  const tool = assistantTools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Unknown assistant tool: ${name}`);
  return tool.execute(params, ctx);
}

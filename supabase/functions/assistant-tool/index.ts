import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assistantToolPolicy as toolPolicy, type AssistantRole as Role } from "../_shared/assistant-tool-policy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
type Params = Record<string, unknown>;

const destinations: Record<string, { route: string; label: string; roles: Role[] }> = {
  dashboard: { route: "/dashboard", label: "Dashboard", roles: ["user"] }, upload_cv: { route: "/dashboard/cv", label: "Upload CV", roles: ["user"] },
  browse_jobs: { route: "/dashboard/jobs", label: "Browse Jobs", roles: ["user"] }, automation: { route: "/dashboard/automation", label: "Automation", roles: ["user"] },
  saved_jobs: { route: "/dashboard/saved", label: "Saved Jobs", roles: ["user"] }, applications: { route: "/dashboard/applications", label: "Applications", roles: ["user"] },
  form_fill: { route: "/dashboard/auto-fill", label: "Form Fill", roles: ["user"] }, profile_settings: { route: "/dashboard/settings", label: "Profile Settings", roles: ["user"] },
  recruiter_jobs: { route: "/recruiter/jobs", label: "Recruiter Jobs", roles: ["recruiter"] }, recruiter_candidates: { route: "/recruiter/candidates", label: "Candidates", roles: ["recruiter"] },
  recruiter_profile: { route: "/recruiter/profile", label: "Company Profile", roles: ["recruiter"] }, admin_dashboard: { route: "/admin", label: "Admin Dashboard", roles: ["admin"] },
  admin_users: { route: "/admin/users", label: "Manage Users", roles: ["admin"] }, admin_jobs: { route: "/admin/jobs", label: "Manage Jobs", roles: ["admin"] },
  admin_analytics: { route: "/admin/analytics", label: "Platform Analytics", roles: ["admin"] },
};

const text = (value: unknown, max = 200) => typeof value === "string" ? value.trim().slice(0, max) : "";
const number = (value: unknown, fallback: number, min: number, max: number) => Math.min(max, Math.max(min, Number(value) || fallback));

function scopeSummary(tool: string, params: Params) {
  if (tool === "apply_to_job") return `Submit and record an application for job ${text(params.job_id, 50) || "currently visible"}`;
  if (tool === "generate_cover_letter") return `Generate a tailored cover letter for job ${text(params.job_id, 50) || "currently visible"}`;
  if (tool === "update_profile") return `Update profile fields: ${Object.keys((params.fields as Params) || {}).join(", ") || "none"}`;
  if (tool === "create_automation") return `Create automation: ${text(params.summary) || text((params.schedule as Params)?.summary) || text((params.action as Params)?.query) || "scheduled job search"}`;
  if (tool === "stop_automation") return `Stop automation ${text(params.id, 50)}`;
  return `Run ${tool}`;
}

function uiSummary(tool: string, scope: string, params: Params) {
  if (tool !== "create_automation") return { title: scope, details: [scope] };
  const schedule = (params.schedule as Params) || {};
  return {
    title: "Create job automation",
    details: [
      `Starts: ${text(schedule.starts_at) || "Next scheduled occurrence"}`,
      `Schedule: ${text(schedule.cron) || text(schedule.summary) || "Not specified"}`,
      `Timezone: ${text(schedule.timezone) || "UTC"}`,
      `Action: ${text((params.action as Params)?.query) || "Scrape matching jobs"}`,
    ],
  };
}

async function getJob(admin: ReturnType<typeof createClient>, userId: string, id: string) {
  const regular = await admin.from("jobs").select("id,title,company,location,description,requirements,skills,job_type,work_mode,experience_level,salary_min,salary_max,salary_currency,source_url").eq("id", id).maybeSingle();
  if (regular.data) return { ...regular.data, kind: "regular" };
  const recommended = await admin.from("recommended_jobs").select("id,title,company,location,description,salary,employment_type,experience_required,skills_required,source_url,match_score").eq("id", id).eq("user_id", userId).maybeSingle();
  return recommended.data ? { ...recommended.data, kind: "recommended" } : null;
}

function cronToSchedule(cron: string) {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error("Use a five-field cron expression.");
  const [minute, hour, day, month, weekday] = parts;
  if (!/^\d{1,2}$/.test(minute) || !/^\d{1,2}$/.test(hour)) throw new Error("Cron must use a fixed hour and minute.");
  const time_of_day = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00`;
  if (day === "*" && month === "*" && weekday === "*") return { recurrence_type: "daily", time_of_day, days_of_week: null, day_of_month: null, run_date: null };
  if (day === "*" && month === "*" && /^(\d)(,\d)*$/.test(weekday)) return { recurrence_type: "days_of_week", time_of_day, days_of_week: weekday.split(",").map(Number), day_of_month: null, run_date: null };
  if (/^\d{1,2}$/.test(day) && month === "*" && weekday === "*") return { recurrence_type: "monthly_repeat", time_of_day, days_of_week: null, day_of_month: Number(day), run_date: null };
  throw new Error("This schedule is not supported. Use daily, selected weekdays, or monthly recurrence.");
}

async function invokeFunction(name: string, authorization: string, body: Params) {
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`, {
    method: "POST", headers: { Authorization: authorization, apikey: Deno.env.get("SUPABASE_ANON_KEY")!, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `${name} failed`);
  return payload;
}

async function executeTool(tool: string, params: Params, context: Params, userId: string, role: Role, userClient: ReturnType<typeof createClient>, admin: ReturnType<typeof createClient>, authorization: string) {
  const jobId = text(params.job_id, 50) || text(context.visible_job_id, 50);
  if (tool === "navigate") {
    const destination = destinations[text(params.target, 50)];
    if (!destination || !destination.roles.includes(role)) return { result: { refused: true, message: "That page belongs to a different account role, so I did not open it." }, ui_update: "Navigation refused" };
    return { result: { opened: params.target, route: destination.route, confirmation: `Opening ${destination.label}.` }, ui_update: `${destination.label} opened`, ui_effect: { type: "navigate", route: destination.route } };
  }
  if (tool === "read_current_job" || tool === "explain_job") {
    if (!jobId) return { result: { found: false, message: "No job is currently selected." }, ui_update: "No current job found" };
    const job = await getJob(admin, userId, jobId);
    return job ? { result: { found: true, job }, ui_update: `${job.title} read` } : { result: { found: false, message: "That job is no longer available." }, ui_update: "Job unavailable" };
  }
  if (tool === "get_application_history") {
    const [applications, actions] = await Promise.all([
      admin.from("job_applications").select("id,job_id,status,applied_at,cover_letter,jobs(title,company,location)").eq("user_id", userId).order("applied_at", { ascending: false }).limit(50),
      admin.from("action_history").select("action_type,params,result,created_at").eq("user_id", userId).eq("action_type", "apply_to_job").order("created_at", { ascending: false }).limit(50),
    ]);
    if (applications.error || actions.error) throw applications.error || actions.error; return { result: { applications: applications.data || [], action_history: actions.data || [], count: applications.data?.length || 0 }, ui_update: "Application history loaded" };
  }
  if (tool === "get_stats") {
    const [apps, saved, recommendations, profile, actions] = await Promise.all([
      admin.from("job_applications").select("id", { count: "exact", head: true }).eq("user_id", userId),
      admin.from("saved_jobs").select("id", { count: "exact", head: true }).eq("user_id", userId),
      admin.from("recommended_jobs").select("id", { count: "exact", head: true }).eq("user_id", userId),
      admin.from("profiles").select("profile_completion").eq("user_id", userId).maybeSingle(),
      admin.from("action_history").select("action_type", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    return { result: { applications: apps.count || 0, saved_jobs: saved.count || 0, recommended_jobs: recommendations.count || 0, profile_completion: profile.data?.profile_completion || 0, assistant_actions: actions.count || 0 }, ui_update: "Career stats loaded" };
  }
  if (tool === "analyze_cv") {
    const { data: profile } = await admin.from("profiles").select("resume_url").eq("user_id", userId).maybeSingle();
    if (!profile?.resume_url) return { result: { analyzed: false, message: "Upload a CV first." }, ui_update: "No CV uploaded", ui_effect: { type: "navigate", route: "/dashboard/cv" } };
    const result = await invokeFunction("analyze-cv", authorization, { filePath: profile.resume_url, fileName: profile.resume_url.split("/").pop() });
    return { result: { analyzed: true, analysis: result }, ui_update: "CV analysis completed" };
  }
  if (tool === "compare_job_to_profile") {
    if (!jobId) return { result: { found: false, message: "Select a job first." }, ui_update: "No current job found" };
    const [job, profileResult] = await Promise.all([getJob(admin, userId, jobId), admin.from("profiles").select("skills,desired_roles,experience_years,education,cv_summary,bio").eq("user_id", userId).maybeSingle()]);
    if (!job || !profileResult.data) return { result: { found: false }, ui_update: "Comparison unavailable" };
    const required = [...((job as Params).skills as string[] || []), ...((job as Params).requirements as string[] || []), ...((job as Params).skills_required as string[] || [])];
    const owned = profileResult.data.skills || []; const ownedLower = new Set(owned.map((skill: string) => skill.toLowerCase()));
    const have = required.filter((skill) => ownedLower.has(String(skill).toLowerCase())); const missing = required.filter((skill) => !ownedLower.has(String(skill).toLowerCase()));
    return { result: { job: { id: job.id, title: job.title, company: job.company }, have, missing, profile: profileResult.data, suggested_improvements: missing.slice(0, 8).map((skill) => `Add evidence of ${skill} only if you genuinely have this skill.`) }, ui_update: "Job compared with profile" };
  }
  if (tool === "search_jobs") {
    const filters = (params.filters as Params) || params; const query = text(filters.query, 100); const location = text(filters.location, 100); const limit = number(filters.limit, 10, 1, 25);
    let db = admin.from("jobs").select("id,title,company,location,description,skills,job_type,work_mode,salary_min,salary_max,salary_currency,source_url").eq("status", "active").limit(limit);
    if (query) db = db.or(`title.ilike.%${query.replace(/[%_,()]/g, " ")}%,company.ilike.%${query.replace(/[%_,()]/g, " ")}%,description.ilike.%${query.replace(/[%_,()]/g, " ")}%`);
    if (location) db = db.ilike("location", `%${location.replace(/[%_]/g, " ")}%`); if (text(filters.job_type, 30)) db = db.eq("job_type", text(filters.job_type, 30));
    const { data, error } = await db; if (error) throw error; return { result: { jobs: data || [], count: data?.length || 0, filters }, ui_update: `${data?.length || 0} jobs found` };
  }
  if (tool === "scrape_jobs") {
    const result = await invokeFunction("collect-jobs", authorization, { query: text(params.query, 120), maxItems: number(params.count, 20, 1, 25), source: text(params.source, 30) || undefined });
    return { result, ui_update: "Job discovery started" };
  }
  if (tool === "save_job") {
    if (!jobId) return { result: { saved: false, message: "Select a job first." }, ui_update: "No current job found" };
    const job = await getJob(admin, userId, jobId); if (!job) return { result: { saved: false }, ui_update: "Job unavailable" };
    const row = job.kind === "recommended" ? { user_id: userId, recommended_job_id: jobId } : { user_id: userId, job_id: jobId };
    const matchColumn = job.kind === "recommended" ? "recommended_job_id" : "job_id";
    const existing = await admin.from("saved_jobs").select("id").eq("user_id", userId).eq(matchColumn, jobId).maybeSingle();
    if (!existing.data) { const { error } = await admin.from("saved_jobs").insert(row); if (error) throw error; }
    return { result: { saved: true, job: { id: job.id, title: job.title } }, ui_update: `${job.title} saved` };
  }
  if (tool === "remove_saved_job") {
    if (!jobId) return { result: { removed: false, message: "A job ID is required." }, ui_update: "Job ID missing" };
    const { error } = await admin.from("saved_jobs").delete().eq("user_id", userId).or(`job_id.eq.${jobId},recommended_job_id.eq.${jobId}`); if (error) throw error;
    return { result: { removed: true, job_id: jobId }, ui_update: "Job removed from saved jobs" };
  }
  if (tool === "apply_to_job") {
    if (!jobId) return { result: { applied: false, message: "Select a job first." }, ui_update: "No current job found" };
    const result = await invokeFunction("send-application", authorization, { jobId });
    return { result, ui_update: "Application prepared", ui_effect: result.job?.job_url ? { type: "external_url", url: result.job.job_url } : undefined };
  }
  if (tool === "generate_cover_letter") {
    if (!jobId) return { result: { generated: false, message: "Select a job first." }, ui_update: "No current job found" };
    const result = await invokeFunction("generate-cover-letter", authorization, { jobId }); return { result, ui_update: "Cover letter generated" };
  }
  if (tool === "update_profile") {
    const fields = (params.fields as Params) || {}; const allowed = new Set(["full_name", "phone", "location", "bio", "skills", "desired_roles", "experience_years", "linkedin_url", "github_url", "portfolio_url", "current_company", "expected_salary", "education", "certifications", "languages", "work_authorization", "willing_to_relocate", "availability", "work_type"]);
    const update = Object.fromEntries(Object.entries(fields).filter(([key]) => allowed.has(key))); if (!Object.keys(update).length) return { result: { updated: false, message: "No supported profile fields were provided." }, ui_update: "No profile changes" };
    const { data, error } = await admin.from("profiles").update(update).eq("user_id", userId).select("id,full_name,location,skills,desired_roles,experience_years").single(); if (error) throw error;
    return { result: { updated: true, profile: data }, ui_update: "Profile updated" };
  }
  if (tool === "upload_cv") return { result: { ready: true, message: "Choose a CV file in Upload CV." }, ui_update: "Upload CV opened", ui_effect: { type: "file_picker", route: "/dashboard/cv?assistantUpload=1" } };
  if (tool === "create_automation") {
    const schedule = (params.schedule as Params) || {}; const cron = text(schedule.cron, 80); const parsed = cronToSchedule(cron); const timezone = text(schedule.timezone, 80) || "UTC"; const startsAt = text(schedule.starts_at, 80) || null;
    const { data, error } = await admin.from("job_scrape_schedules").insert({ user_id: userId, name: text((params.action as Params)?.query, 80) || "Assistant job search", timezone, is_active: true, cron_expression: cron, action: params.action || { type: "scrape_jobs" }, starts_at: startsAt, ...parsed }).select("*").single(); if (error) throw error;
    return { result: { created: true, automation: data }, ui_update: "Automation created" };
  }
  if (tool === "stop_automation") {
    const id = text(params.id, 50); const { data, error } = await admin.from("job_scrape_schedules").update({ is_active: false }).eq("id", id).eq("user_id", userId).select("id,name,is_active").maybeSingle(); if (error) throw error;
    return { result: { stopped: Boolean(data), automation: data }, ui_update: data ? "Automation stopped" : "Automation not found" };
  }
  if (tool === "list_automations") {
    const { data, error } = await admin.from("job_scrape_schedules").select("id,name,recurrence_type,time_of_day,timezone,is_active,next_run_at,last_run_at,last_run_status,cron_expression,action,starts_at").eq("user_id", userId).order("created_at", { ascending: false }); if (error) throw error;
    return { result: { automations: data || [], count: data?.length || 0 }, ui_update: "Automations loaded" };
  }
  if (tool === "set_notification_rule") {
    const criteria = (params.criteria as Params) || {}; if (!Object.keys(criteria).length) return { result: { created: false, message: "Notification criteria are required." }, ui_update: "Criteria missing" };
    const { data, error } = await userClient.from("assistant_notification_rules").insert({ user_id: userId, criteria }).select("*").single(); if (error) throw error;
    return { result: { created: true, rule: data }, ui_update: "Notification rule created" };
  }
  if (tool === "remember_user_preference") {
    const key = text(params.key, 50); const allowed = new Set(["desired_role", "skills", "experience_level", "location", "automation_preferences"]);
    if (!allowed.has(key)) return { result: { remembered: false, message: "That memory category is not supported." }, ui_update: "Preference not stored" };
    const { error } = await admin.from("user_profile_memory").upsert({ user_id: userId, memory_key: key, memory_value: params.value, source_session_id: text(context.session_id, 50) || null, updated_at: new Date().toISOString() }, { onConflict: "user_id,memory_key" });
    if (error) throw error; return { result: { remembered: true, key, value: params.value }, ui_update: "Preference remembered" };
  }
  throw new Error(`Unsupported tool: ${tool}`);
}

async function executeAndAudit(tool: string, params: Params, context: Params, userId: string, role: Role, userClient: ReturnType<typeof createClient>, admin: ReturnType<typeof createClient>, authorization: string) {
  try {
    const outcome = await executeTool(tool, params, context, userId, role, userClient, admin, authorization);
    await admin.from("action_history").insert({ user_id: userId, session_id: text(context.session_id, 50) || null, action_type: tool, params, result: outcome.result || {} });
    return outcome;
  } catch (error) {
    await admin.from("action_history").insert({ user_id: userId, session_id: text(context.session_id, 50) || null, action_type: tool, params, result: { error: error instanceof Error ? error.message : "Tool execution failed" } });
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authorization = req.headers.get("Authorization") || ""; const url = Deno.env.get("SUPABASE_URL")!; const anon = Deno.env.get("SUPABASE_ANON_KEY")!; const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } }); const admin = createClient(url, service);
    const { data: { user }, error: authError } = await userClient.auth.getUser(); if (authError || !user) return json({ error: "Unauthorized" }, 401);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(); const role = roleRow?.role as Role | undefined; if (!role) return json({ result: { refused: true, message: "I could not verify your account role, so nothing was changed." }, ui_update: "Role check failed" });
    const body = await req.json();

    if (body.action_id) {
      const { data: pending } = await admin.from("assistant_pending_actions").select("*").eq("id", body.action_id).eq("user_id", user.id).eq("status", "pending").maybeSingle();
      if (!pending || new Date(pending.expires_at) <= new Date()) return json({ result: { cancelled: true, message: "That confirmation expired. Please ask again." }, ui_update: "Confirmation expired" });
      if (body.decision === "cancel") { await admin.from("assistant_pending_actions").update({ status: "cancelled" }).eq("id", pending.id).eq("status", "pending"); return json({ result: { cancelled: true, message: "Cancelled. Nothing was changed." }, ui_update: "Action cancelled" }); }
      const requiredAcknowledgement = `I confirm: ${pending.scope_summary}`;
      if (pending.permission_tier === "strong_confirm" && text(body.acknowledgement, 500) !== requiredAcknowledgement) return json({ confirmation_required: true, confirmation: { action_id: pending.id, tool: pending.tool_name, permission_tier: "strong_confirm", scope: pending.scope_summary, acknowledgement: requiredAcknowledgement, ...uiSummary(pending.tool_name, pending.scope_summary, pending.parameters) } });
      const claimed = await admin.from("assistant_pending_actions").update({ status: "confirmed" }).eq("id", pending.id).eq("status", "pending").select("id").maybeSingle(); if (!claimed.data) return json({ result: { cancelled: true, message: "That action was already handled." }, ui_update: "Action already handled" });
      const policy = toolPolicy[pending.tool_name]; if (!policy?.roles.includes(role)) return json({ result: { refused: true, message: "That action belongs to a different account role, so I did not run it." }, ui_update: "Action refused" });
      const outcome = await executeAndAudit(pending.tool_name, pending.parameters, body.context || {}, user.id, role, userClient, admin, authorization); await admin.from("assistant_pending_actions").update({ status: "executed", executed_at: new Date().toISOString() }).eq("id", pending.id); return json(outcome);
    }

    const tool = text(body.tool, 80); const params = body.params && typeof body.params === "object" ? body.params as Params : {}; const context = body.context && typeof body.context === "object" ? body.context as Params : {}; const policy = toolPolicy[tool];
    if (!policy) return json({ error: "Unknown assistant tool" }, 400);
    if (!policy.roles.includes(role)) return json({ result: { refused: true, message: "That request belongs to a different account role, so I did not run it." }, ui_update: "Action refused" });
    if (policy.tier !== "safe") {
      const scope = scopeSummary(tool, params); const { data, error } = await admin.from("assistant_pending_actions").insert({ user_id: user.id, tool_name: tool, parameters: params, permission_tier: policy.tier, scope_summary: scope }).select("id").single(); if (error) throw error;
      return json({ confirmation_required: true, confirmation: { action_id: data.id, tool, permission_tier: policy.tier, scope, acknowledgement: policy.tier === "strong_confirm" ? `I confirm: ${scope}` : undefined, ...uiSummary(tool, scope, params) } });
    }
    return json(await executeAndAudit(tool, params, context, user.id, role, userClient, admin, authorization));
  } catch (error) { console.error("assistant-tool error", error); return json({ error: error instanceof Error ? error.message : "Tool execution failed" }, 500); }
});

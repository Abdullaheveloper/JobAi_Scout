import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

// DB-level recurrence type. "days_of_week" backs both the "Specific days" and
// "Weekly" UI modes -- a weekly schedule is just a days_of_week array with one
// entry, so there's no separate DB value or next-run logic for it.
export type RecurrenceType = "once" | "daily" | "days_of_week" | "monthly_repeat" | "monthly_once";
// UI-facing recurrence choice -- one extra option ("weekly") than the DB enum.
export type RecurrenceUiType = "once" | "daily" | "specific_days" | "weekly" | "monthly";
export type MonthlyMode = "repeat" | "once";

// job_scrape_schedules hasn't been added to the generated Supabase types yet
// (see src/integrations/supabase/types.ts) -- this mirrors the migration's
// column shape 1:1 and should be replaced by `Tables<"job_scrape_schedules">`
// once `supabase gen types typescript` is re-run.
export interface JobScrapeSchedule {
  id: string;
  user_id: string;
  name: string;
  recurrence_type: RecurrenceType;
  time_of_day: string; // "HH:MM:SS"
  timezone: string; // IANA name
  days_of_week: number[] | null; // 0=Sun..6=Sat
  day_of_month: number | null;
  run_date: string | null; // "YYYY-MM-DD"
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  created_at: string;
  updated_at: string;
}

export type JobScrapeScheduleInput = Pick<
  JobScrapeSchedule,
  "name" | "recurrence_type" | "time_of_day" | "timezone" | "days_of_week" | "day_of_month" | "run_date" | "is_active"
>;

export interface ScheduleFormState {
  name: string;
  timeOfDay: string; // "HH:MM", straight from <input type="time">
  uiType: RecurrenceUiType;
  daysOfWeek: number[]; // used by both "specific_days" (multi) and "weekly" (single)
  dayOfMonth: number; // 1-31
  runDate: Date | undefined;
  monthlyMode: MonthlyMode;
  isActive: boolean;
}

export const DAY_OPTIONS: Array<{ value: number; label: string; full: string }> = [
  { value: 1, label: "Mon", full: "Monday" },
  { value: 2, label: "Tue", full: "Tuesday" },
  { value: 3, label: "Wed", full: "Wednesday" },
  { value: 4, label: "Thu", full: "Thursday" },
  { value: 5, label: "Fri", full: "Friday" },
  { value: 6, label: "Sat", full: "Saturday" },
  { value: 0, label: "Sun", full: "Sunday" },
];

export function emptyScheduleForm(): ScheduleFormState {
  return {
    name: "",
    timeOfDay: "09:00",
    uiType: "daily",
    daysOfWeek: [],
    dayOfMonth: 1,
    runDate: undefined,
    monthlyMode: "repeat",
    isActive: true,
  };
}

const currentTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const toDateOnly = (date: Date) => format(date, "yyyy-MM-dd");

export function toScheduleInput(form: ScheduleFormState): JobScrapeScheduleInput {
  const timeOfDay = form.timeOfDay.length === 5 ? `${form.timeOfDay}:00` : form.timeOfDay;
  const base = { name: form.name.trim(), time_of_day: timeOfDay, timezone: currentTimezone(), is_active: form.isActive };

  switch (form.uiType) {
    case "daily":
      return { ...base, recurrence_type: "daily", days_of_week: null, day_of_month: null, run_date: null };
    case "weekly":
      return { ...base, recurrence_type: "days_of_week", days_of_week: form.daysOfWeek.slice(0, 1), day_of_month: null, run_date: null };
    case "specific_days":
      return { ...base, recurrence_type: "days_of_week", days_of_week: form.daysOfWeek, day_of_month: null, run_date: null };
    case "monthly":
      return form.monthlyMode === "repeat"
        ? { ...base, recurrence_type: "monthly_repeat", days_of_week: null, day_of_month: form.dayOfMonth, run_date: null }
        : { ...base, recurrence_type: "monthly_once", days_of_week: null, day_of_month: null, run_date: form.runDate ? toDateOnly(form.runDate) : null };
    case "once":
    default:
      return { ...base, recurrence_type: "once", days_of_week: null, day_of_month: null, run_date: form.runDate ? toDateOnly(form.runDate) : null };
  }
}

// Re-deriving "weekly" vs "specific days" from a saved row is inherently a
// guess (both share recurrence_type "days_of_week") -- a single selected day
// is assumed to have come from the "Weekly" tab, since that's the far more
// common reason to pick exactly one day. This only affects which tab reopens
// for editing, never execution.
export function toFormState(schedule: JobScrapeSchedule): ScheduleFormState {
  const timeOfDay = schedule.time_of_day.slice(0, 5);
  const daysOfWeek = schedule.days_of_week || [];
  let uiType: RecurrenceUiType = "daily";
  if (schedule.recurrence_type === "once") uiType = "once";
  else if (schedule.recurrence_type === "daily") uiType = "daily";
  else if (schedule.recurrence_type === "days_of_week") uiType = daysOfWeek.length === 1 ? "weekly" : "specific_days";
  else if (schedule.recurrence_type === "monthly_repeat" || schedule.recurrence_type === "monthly_once") uiType = "monthly";

  return {
    name: schedule.name,
    timeOfDay,
    uiType,
    daysOfWeek,
    dayOfMonth: schedule.day_of_month || 1,
    runDate: schedule.run_date ? new Date(`${schedule.run_date}T00:00:00`) : undefined,
    monthlyMode: schedule.recurrence_type === "monthly_once" ? "once" : "repeat",
    isActive: schedule.is_active,
  };
}

function formatTime(timeOfDay: string): string {
  const [hourStr, minuteStr] = timeOfDay.split(":");
  const date = new Date();
  date.setHours(Number(hourStr), Number(minuteStr), 0, 0);
  return format(date, "h:mm a");
}

function dayLabels(days: number[] | null): string {
  const ordered = DAY_OPTIONS.filter((d) => (days || []).includes(d.value));
  return ordered.map((d) => d.label).join(", ");
}

function ordinal(day: number): string {
  if (day > 3 && day < 21) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

export function recurrenceSummary(schedule: JobScrapeSchedule): string {
  const time = formatTime(schedule.time_of_day);
  switch (schedule.recurrence_type) {
    case "daily":
      return `Every day at ${time}`;
    case "days_of_week": {
      const days = schedule.days_of_week || [];
      if (days.length === 1) return `Every ${DAY_OPTIONS.find((d) => d.value === days[0])?.full || ""} at ${time}`;
      return `Every ${dayLabels(days)} at ${time}`;
    }
    case "monthly_repeat":
      return `Monthly on the ${ordinal(schedule.day_of_month || 1)} at ${time}`;
    case "monthly_once":
    case "once": {
      const dateLabel = schedule.run_date ? format(new Date(`${schedule.run_date}T00:00:00`), "MMM d, yyyy") : "an unset date";
      return `One-time on ${dateLabel} at ${time}`;
    }
    default:
      return time;
  }
}

export function formatNextRun(nextRunAt: string | null): string {
  if (!nextRunAt) return "Calculating next run…";
  return format(new Date(nextRunAt), "EEEE, MMM d 'at' h:mm a");
}

// Best-effort client-side estimate shown only while a form is open and
// unsaved. Deliberately not required to be perfectly correct (DST edges,
// short-month clamping) -- the server's next_run_at (via
// compute_job_scrape_next_run_at) is the source of truth the moment the row
// is saved.
export function previewNextRun(form: ScheduleFormState): string {
  const [hours, minutes] = form.timeOfDay.split(":").map(Number);
  const now = new Date();
  const withTime = (date: Date) => {
    const next = new Date(date);
    next.setHours(hours, minutes, 0, 0);
    return next;
  };

  if (form.uiType === "daily") {
    let candidate = withTime(now);
    if (candidate <= now) candidate.setDate(candidate.getDate() + 1);
    return format(candidate, "EEEE, MMM d 'at' h:mm a");
  }

  if (form.uiType === "specific_days" || form.uiType === "weekly") {
    if (!form.daysOfWeek.length) return "Pick at least one day";
    for (let i = 0; i <= 7; i += 1) {
      const candidate = withTime(new Date(now.getTime() + i * 86_400_000));
      if (form.daysOfWeek.includes(candidate.getDay()) && candidate > now) {
        return format(candidate, "EEEE, MMM d 'at' h:mm a");
      }
    }
    return "—";
  }

  if (form.uiType === "monthly") {
    if (form.monthlyMode === "once") {
      if (!form.runDate) return "Pick a date";
      return format(withTime(form.runDate), "EEEE, MMM d 'at' h:mm a");
    }
    let candidate = withTime(new Date(now.getFullYear(), now.getMonth(), form.dayOfMonth));
    if (candidate <= now) candidate = withTime(new Date(now.getFullYear(), now.getMonth() + 1, form.dayOfMonth));
    return format(candidate, "EEEE, MMM d 'at' h:mm a");
  }

  if (form.uiType === "once") {
    if (!form.runDate) return "Pick a date";
    return format(withTime(form.runDate), "EEEE, MMM d 'at' h:mm a");
  }

  return "—";
}

export async function listSchedules(userId: string): Promise<JobScrapeSchedule[]> {
  const { data, error } = await supabase
    .from("job_scrape_schedules" as never)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as JobScrapeSchedule[];
}

export async function createSchedule(userId: string, input: JobScrapeScheduleInput): Promise<JobScrapeSchedule> {
  const { data, error } = await supabase
    .from("job_scrape_schedules" as never)
    .insert({ ...input, user_id: userId } as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as JobScrapeSchedule;
}

export async function updateSchedule(id: string, input: Partial<JobScrapeScheduleInput>): Promise<JobScrapeSchedule> {
  const { data, error } = await supabase
    .from("job_scrape_schedules" as never)
    .update(input as never)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as JobScrapeSchedule;
}

export async function toggleScheduleActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("job_scrape_schedules" as never).update({ is_active: isActive } as never).eq("id", id);
  if (error) throw error;
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.from("job_scrape_schedules" as never).delete().eq("id", id);
  if (error) throw error;
}

export type ExperienceType = "job" | "internship" | "project";

export type ExperienceEntry = {
  title?: string;
  company?: string;
  description?: string;
  dates?: string;
  type?: ExperienceType;
  url?: string;
};

export type EducationStatus = "Completed" | "Ongoing";

export type EducationEntry = {
  degree?: string;
  institution?: string;
  startYear?: string;
  endYear?: string;
  status?: EducationStatus;
  fieldOfStudy?: string;
  grade?: string;
};

export type CredentialType = "certification" | "award" | "publication";

export type CredentialEntry = {
  title?: string;
  issuer?: string;
  date?: string | null;
  verificationLink?: string;
  type?: CredentialType;
  description?: string;
};

export type ExtractedData = {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  currentCompany?: string;
  skills?: string[];
  suggestedRoles?: string[];
  experienceYears?: number;
  experienceCalcNote?: string;
  education?: string;
  educationEntries?: EducationEntry[];
  certifications?: string[];
  credentials?: CredentialEntry[];
  languages?: string[];
  cvSummary?: string;
  experience?: ExperienceEntry[];
  fieldStatus?: Record<string, "present" | "missing" | "uncertain">;
  fieldConfidence?: Record<string, number>;
};

export type CareerProfileLike = {
  version?: number;
  experiences?: Array<Record<string, unknown>>;
  education?: Array<Record<string, unknown>>;
  projects?: Array<Record<string, unknown>>;
  achievements?: Array<Record<string, unknown>>;
  references?: Array<Record<string, unknown>>;
};

export type ProfileLike = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
  current_company?: string | null;
  skills?: string[] | null;
  desired_roles?: string[] | null;
  experience_years?: number | null;
  education?: string | null;
  certifications?: string[] | null;
  languages?: string[] | null;
  cv_summary?: string | null;
  bio?: string | null;
  resume_url?: string | null;
  expected_salary?: string | null;
  data_sources?: Record<string, unknown> | null;
  field_metadata?: Record<string, unknown> | null;
};

export type CvProfileSync = {
  updatePayload: Record<string, unknown>;
  updatedKeys: string[];
  clearedKeys: string[];
  uncertainKeys: string[];
};

export const EXPERIENCE_YEARS_MIN = 0;
export const EXPERIENCE_YEARS_MAX = 40;
export const SALARY_MIN_EXCLUSIVE = 10000;
export const EXPERIENCE_INVALID_MESSAGE = "Experience value seems incorrect, please review";
export const SALARY_INVALID_MESSAGE = "Salary must be greater than 10,000";

export function hasValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "string") return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "number") return val > 0;
  return false;
}

const CONFIDENCE_THRESHOLD = 0.55;

/** Whether a CV field should be written into a full profile replacement payload. */
export function resolveCvReplacementStatus(
  extracted: ExtractedData,
  extractionKey: string,
  rawValue: unknown,
): "present" | "missing" | "uncertain" {
  const explicit = extracted.fieldStatus?.[extractionKey];
  const score = Math.min(
    1,
    Math.max(
      0,
      Number(
        extracted.fieldConfidence?.[extractionKey]
          ?? (explicit === "present" ? 0.9 : hasValue(rawValue) ? 0.85 : 0),
      ),
    ),
  );

  if (explicit === "missing") return "missing";
  if (explicit === "present") return score >= CONFIDENCE_THRESHOLD ? "present" : "uncertain";
  if (explicit === "uncertain") return hasValue(rawValue) ? "present" : "uncertain";
  // Parser omitted fieldStatus — treat non-empty extracted values as present.
  return hasValue(rawValue) ? "present" : "missing";
}

export function confidenceForCvReplacementField(
  extracted: ExtractedData,
  extractionKey: string,
  rawValue: unknown,
): number {
  return Math.min(
    1,
    Math.max(
      0,
      Number(
        extracted.fieldConfidence?.[extractionKey]
          ?? (extracted.fieldStatus?.[extractionKey] === "present" ? 0.9 : hasValue(rawValue) ? 0.85 : 0),
      ),
    ),
  );
}

function toStringArray(val: unknown): string[] | undefined {
  if (Array.isArray(val)) {
    const items = val.map(String).map((s) => s.trim()).filter(Boolean);
    return items.length ? items : undefined;
  }
  if (typeof val === "string" && val.trim()) {
    const items = val.split(",").map((s) => s.trim()).filter(Boolean);
    return items.length ? items : undefined;
  }
  return undefined;
}

function toNumber(val: unknown): number | undefined {
  if (typeof val === "number" && Number.isFinite(val) && val > 0) return val;
  if (typeof val === "string") {
    const n = Number.parseFloat(val.replace(/,/g, ""));
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return undefined;
}

function pickString(raw: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const val = raw[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return undefined;
}

function toFieldStatus(value: unknown): Record<string, "present" | "missing" | "uncertain"> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const result: Record<string, "present" | "missing" | "uncertain"> = {};
  for (const [key, status] of Object.entries(value)) {
    if (status === "present" || status === "missing" || status === "uncertain") result[key] = status;
  }
  return Object.keys(result).length ? result : undefined;
}

function toFieldConfidence(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const result: Record<string, number> = {};
  for (const [key, confidence] of Object.entries(value)) {
    const number = Number(confidence);
    if (Number.isFinite(number)) result[key] = Math.min(1, Math.max(0, number));
  }
  return Object.keys(result).length ? result : undefined;
}

function normalizeExperienceType(value: unknown): ExperienceType | undefined {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "job" || normalized === "internship" || normalized === "project") return normalized;
  if (normalized.includes("intern")) return "internship";
  if (normalized.includes("project")) return "project";
  if (normalized.includes("job") || normalized.includes("employ") || normalized.includes("work")) return "job";
  return undefined;
}

function normalizeEducationStatus(value: unknown): EducationStatus | undefined {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return undefined;
  if (/\b(ongoing|current|present|in\s*progress|pursuing)\b/.test(normalized)) return "Ongoing";
  if (/\b(completed|complete|graduated|finished)\b/.test(normalized)) return "Completed";
  return undefined;
}

function normalizeCredentialType(value: unknown): CredentialType {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("award") || normalized.includes("achiev")) return "award";
  if (normalized.includes("public") || normalized.includes("paper") || normalized.includes("journal")) {
    return "publication";
  }
  return "certification";
}

export function normalizeExperienceEntries(raw: unknown): ExperienceEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const entries: ExperienceEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const title = pickString(row, "title", "name", "role");
    const company = pickString(row, "company", "organization", "employer");
    const description = pickString(row, "description", "summary", "details");
    const dates = pickString(row, "dates", "date", "period");
    const url = pickString(row, "url", "link", "verificationUrl", "verification_url");
    let type = normalizeExperienceType(row.type ?? row.experienceType ?? row.experience_type);
    if (!type) {
      const blob = `${title || ""} ${company || ""} ${description || ""}`.toLowerCase();
      if (/\bintern(ship)?\b/.test(blob)) type = "internship";
      else if (company) type = "job";
      else type = "project";
    }
    if (!title && !company && !description) continue;
    entries.push({
      title: title || (type === "internship" ? "Internship" : undefined),
      company,
      description,
      dates,
      type,
      url,
    });
  }
  return entries.length ? entries : undefined;
}

export function normalizeEducationEntries(raw: unknown): EducationEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const entries: EducationEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const degree = pickString(row, "degree", "qualification", "title");
    const institution = pickString(row, "institution", "school", "university", "college");
    const startYear = pickString(row, "startYear", "start_year", "startDate", "start_date");
    const endYear = pickString(row, "endYear", "end_year", "endDate", "end_date");
    const status = normalizeEducationStatus(row.status ?? row.state);
    const fieldOfStudy = pickString(row, "fieldOfStudy", "field_of_study", "major");
    const grade = pickString(row, "grade", "gpa", "cgpa");
    if (!degree && !institution) continue;
    entries.push({
      degree,
      institution,
      startYear: extractYearToken(startYear) || startYear,
      endYear: extractYearToken(endYear) || endYear,
      status,
      fieldOfStudy,
      grade,
    });
  }
  return entries.length ? entries : undefined;
}

export function normalizeCredentialEntries(raw: unknown): CredentialEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const entries: CredentialEntry[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      const parsed = parseCredentialLine(item);
      if (parsed) entries.push(parsed);
      continue;
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const title = pickString(row, "title", "name", "credential");
    if (!title) continue;
    entries.push({
      title,
      issuer: pickString(row, "issuer", "organization", "publisher", "from"),
      date: pickString(row, "date", "issued", "year") || null,
      verificationLink: pickString(
        row,
        "verificationLink",
        "verification_link",
        "url",
        "link",
        "verifyUrl",
        "verify_url",
      ),
      type: normalizeCredentialType(row.type),
      description: pickString(row, "description", "details"),
    });
  }
  return entries.length ? entries : undefined;
}

function extractYearToken(value?: string | null): string | undefined {
  if (!value) return undefined;
  const match = String(value).match(/\b(19|20)\d{2}\b/);
  return match?.[0];
}

/** Parse flat education text into structured rows when possible. */
export function parseEducationString(education?: string | null): EducationEntry[] {
  if (!education?.trim()) return [];
  const chunks = education
    .split(/\n|;/)
    .map((part) => part.trim())
    .filter(Boolean);

  const entries: EducationEntry[] = [];
  for (let i = 0; i < chunks.length; i += 1) {
    let chunk = chunks[i];
    const next = chunks[i + 1] || "";
    // Degree/dates line often followed by institution-only line.
    const nextLooksLikeInstitution = next
      && !/\b(19|20)\d{2}\b/.test(next)
      && !/[|]/.test(next)
      && next.length < 100
      && !/\b(bs|ba|bsc|msc|ms|phd|bachelor|master|diploma|intermediate|degree)\b/i.test(next);

    if (nextLooksLikeInstitution) {
      chunk = `${chunk} — ${next}`;
      i += 1;
    }

    const status = normalizeEducationStatus(chunk);
    const years = [...chunk.matchAll(/\b((?:19|20)\d{2})\b/g)].map((m) => m[1]);
    const startYear = years[0];
    const endYear = years[1] || years[0];
    const parts = chunk.split(/\s*[|—–-]\s*/).map((p) => p.trim()).filter(Boolean);
    let degree = parts[0] || chunk;
    let institution = "";
    let grade = "";

    for (const part of parts.slice(1)) {
      if (/\b(19|20)\d{2}\b/.test(part) || /completed|ongoing|present/i.test(part)) continue;
      if (/\b(\d+(?:\.\d+)?)\s*(cgpa|gpa|grade)\b/i.test(part) || /\bcgpa\b/i.test(part)) {
        grade = part;
        continue;
      }
      if (!institution && !/^\d/.test(part)) institution = part;
    }

    // Strip trailing status / years from degree label.
    degree = degree
      .replace(/\b(19|20)\d{2}\b.*$/i, "")
      .replace(/\b(completed|ongoing|present|in\s*progress)\b/gi, "")
      .replace(/\s*[|—–-]\s*$/g, "")
      .trim() || degree;

    if (!degree && !institution) continue;
    entries.push({
      degree: degree || undefined,
      institution: institution || undefined,
      startYear,
      endYear,
      status: status || (endYear && Number(endYear) > new Date().getFullYear() ? "Ongoing" : status),
      grade: grade || undefined,
    });
  }
  return entries;
}

export function formatEducationFlat(entries: EducationEntry[]): string {
  return entries
    .map((entry) => {
      const years = [entry.startYear, entry.endYear].filter(Boolean).join(" – ");
      const bits = [
        entry.degree,
        years ? `${years}${entry.status ? ` ${entry.status}` : ""}` : entry.status,
        entry.institution,
        entry.grade,
      ].filter(Boolean);
      return bits.join(" | ");
    })
    .filter(Boolean)
    .join("; ");
}

function parseDurationMonths(text: string): number | null {
  const normalized = text.toLowerCase().replace(/,/g, " ");
  let total = 0;
  let matched = false;
  const yearMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/);
  if (yearMatch) {
    total += Number(yearMatch[1]) * 12;
    matched = true;
  }
  const monthMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:months?|mos?)\b/);
  if (monthMatch) {
    total += Number(monthMatch[1]);
    matched = true;
  }
  const weekMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:weeks?|wks?)\b/);
  if (weekMatch) {
    total += Number(weekMatch[1]) / 4.345;
    matched = true;
  }
  return matched ? total : null;
}

type MonthInterval = { start: number; end: number; label: string; hasDates: boolean; months: number };

function parseDateToken(token: string): { year: number; month: number } | null {
  const cleaned = token.trim();
  const ym = cleaned.match(/\b((?:19|20)\d{2})(?:[-/.](\d{1,2}))?\b/);
  if (!ym) return null;
  const year = Number(ym[1]);
  const month = ym[2] ? Math.min(12, Math.max(1, Number(ym[2]))) : 1;
  if (!Number.isFinite(year)) return null;
  return { year, month };
}

function toMonthIndex(year: number, month: number): number {
  return year * 12 + (month - 1);
}

function parseDateRangeMonths(dates?: string): MonthInterval | null {
  if (!dates?.trim()) return null;
  const text = dates.trim();
  const durationOnly = parseDurationMonths(text);
  // Prefer spaced / en-dash / em-dash separators so "2024-01" is not split on the hyphen.
  const rangeMatch = text.match(
    /^(.+?)\s*(?:–|—|\s-\s|\sto\s|\suntil\s|\still\s)\s*(.+)$/i,
  );
  const rangeParts = rangeMatch
    ? [rangeMatch[1].trim(), rangeMatch[2].trim()]
    : [text];
  const start = parseDateToken(rangeParts[0] || text);
  const endRaw = rangeParts[1];
  const endIsPresent = endRaw
    ? /\b(present|current|ongoing|now)\b/i.test(endRaw)
    : false;
  const end = endRaw
    ? (endIsPresent
      ? { year: new Date().getFullYear(), month: new Date().getMonth() + 1 }
      : parseDateToken(endRaw))
    : null;

  if (start && end) {
    const startIdx = toMonthIndex(start.year, start.month);
    let endIdx = toMonthIndex(end.year, end.month);
    if (endIdx < startIdx) endIdx = startIdx;
    const months = endIdx - startIdx + 1;
    return { start: startIdx, end: endIdx, label: text, hasDates: true, months };
  }

  // Single year/month token without an end → treat as 1 month of dated tenure.
  if (start && !endRaw) {
    const startIdx = toMonthIndex(start.year, start.month);
    return { start: startIdx, end: startIdx, label: text, hasDates: true, months: 1 };
  }

  if (durationOnly != null) {
    return { start: 0, end: 0, label: text, hasDates: false, months: durationOnly };
  }
  return null;
}

/**
 * Prefer an explicit experienceYears value from the CV; otherwise sum internships,
 * projects, and dated work. Overlapping dated intervals are unioned; pure durations
 * are summed at face value.
 */
export function calculateExperienceYears(input: {
  explicitYears?: number | null;
  experience?: ExperienceEntry[];
}): { years: number; note: string; source: "explicit" | "calculated" | "none" } {
  const explicit = toNumber(input.explicitYears);
  if (explicit != null) {
    const clamped = clampExperienceYears(explicit);
    if (clamped.valid && clamped.value != null) {
      return {
        years: clamped.value,
        note: `From CV stated experience: ${clamped.value} year${clamped.value === 1 ? "" : "s"}`,
        source: "explicit",
      };
    }
  }

  const dated: MonthInterval[] = [];
  const durationOnly: MonthInterval[] = [];
  const parts: string[] = [];
  const counts = { internship: 0, project: 0, job: 0 };
  const durationLabels: Record<string, string[]> = { internship: [], project: [], job: [] };

  for (const entry of input.experience || []) {
    const type = entry.type || "job";
    const interval = parseDateRangeMonths(entry.dates)
      || parseDateRangeMonths(`${entry.description || ""} ${entry.title || ""}`);
    if (!interval) continue;
    counts[type] = (counts[type] || 0) + 1;
    const monthsLabel = interval.months >= 12
      ? `${(interval.months / 12).toFixed(1).replace(/\.0$/, "")}yr`
      : `${Math.max(1, Math.round(interval.months))}mo`;
    durationLabels[type].push(monthsLabel);
    if (interval.hasDates) dated.push(interval);
    else durationOnly.push(interval);
  }

  let totalMonths = durationOnly.reduce((sum, item) => sum + item.months, 0);
  if (dated.length) {
    const points = new Set<number>();
    for (const interval of dated) {
      for (let m = interval.start; m <= interval.end; m += 1) points.add(m);
    }
    totalMonths += points.size;
  }

  if (totalMonths <= 0) {
    return { years: 0, note: "", source: "none" };
  }

  const years = Math.round((totalMonths / 12) * 10) / 10;
  const clamped = clampExperienceYears(years);
  const value = clamped.value ?? 0;

  const segments: string[] = [];
  if (counts.internship) {
    segments.push(`${counts.internship} internship${counts.internship > 1 ? "s" : ""} (${durationLabels.internship.join(", ")})`);
  }
  if (counts.project) {
    segments.push(`${counts.project} project${counts.project > 1 ? "s" : ""} (${durationLabels.project.join(", ")})`);
  }
  if (counts.job) {
    segments.push(`${counts.job} job${counts.job > 1 ? "s" : ""} (${durationLabels.job.join(", ")})`);
  }
  const note = segments.length
    ? `Auto-calculated from: ${segments.join(" + ")}`
    : `Auto-calculated from dated experience (${value} years)`;

  return { years: value, note, source: "calculated" };
}

export function clampExperienceYears(value: unknown): {
  valid: boolean;
  value: number | null;
  message?: string;
} {
  if (value === null || value === undefined || value === "") {
    return { valid: true, value: 0 };
  }
  const number = typeof value === "number" ? value : Number.parseFloat(String(value).replace(/,/g, ""));
  if (!Number.isFinite(number)) {
    return { valid: false, value: null, message: EXPERIENCE_INVALID_MESSAGE };
  }
  if (number < EXPERIENCE_YEARS_MIN || number > EXPERIENCE_YEARS_MAX) {
    return { valid: false, value: null, message: EXPERIENCE_INVALID_MESSAGE };
  }
  // Keep one decimal for fractional years, integers otherwise.
  const rounded = Math.round(number * 10) / 10;
  return { valid: true, value: rounded };
}

/** Parse salary text/number; must be strictly greater than 10,000. Empty is allowed (optional field). */
export function validateSalary(value: unknown): {
  valid: boolean;
  value: number | null;
  raw: string | null;
  message?: string;
} {
  if (value === null || value === undefined || value === "") {
    return { valid: true, value: null, raw: null };
  }
  const raw = String(value).trim();
  if (!raw) return { valid: true, value: null, raw: null };
  const digits = raw.replace(/[^0-9.]/g, "");
  if (!digits) {
    return { valid: false, value: null, raw, message: SALARY_INVALID_MESSAGE };
  }
  const number = Number.parseFloat(digits);
  if (!Number.isFinite(number) || number <= SALARY_MIN_EXCLUSIVE) {
    return { valid: false, value: null, raw, message: SALARY_INVALID_MESSAGE };
  }
  return { valid: true, value: number, raw };
}

export function parseCredentialLine(line: string): CredentialEntry | null {
  const text = String(line || "").trim();
  if (!text) return null;
  const url = text.match(/https?:\/\/[^\s|]+/i)?.[0];
  const withoutUrl = text.replace(/\s*[|]\s*https?:\/\/[^\s|]+/i, "").trim();
  const fromMatch = withoutUrl.match(/^(?:internship|certificate|certification|award|credential)\s*[:\-–—]\s*(.+?)\s+from\s+(.+)$/i);
  const atMatch = withoutUrl.match(/^(.+?)\s+at\s+(.+)$/i);
  let title = withoutUrl;
  let issuer = "";
  if (fromMatch) {
    title = fromMatch[1].trim();
    issuer = fromMatch[2].replace(/\s*[|/].*$/, "").trim();
  } else if (atMatch && !/https?:\/\//i.test(atMatch[2])) {
    title = atMatch[1].trim();
    issuer = atMatch[2].replace(/\s*[|/].*$/, "").trim();
  } else {
    const parts = withoutUrl.split(/\s*[|—–]\s*/).map((p) => p.trim()).filter(Boolean);
    title = parts[0] || withoutUrl;
    issuer = parts[1] || "";
  }
  const type: CredentialType = /\baward|achievement\b/i.test(text)
    ? "award"
    : /\bpublication|paper|journal\b/i.test(text)
      ? "publication"
      : "certification";
  return {
    title: title || "Credential",
    issuer: issuer || undefined,
    date: null,
    verificationLink: url,
    type,
  };
}

/** Infer employer/org from internship experience or certification internship lines. */
export function inferCurrentCompany(input: {
  currentCompany?: string;
  experience?: ExperienceEntry[];
  certifications?: string[];
}): string | undefined {
  if (hasValue(input.currentCompany)) return input.currentCompany!.trim();

  const internship = (input.experience || []).find(
    (entry) => entry.type === "internship" && hasValue(entry.company),
  );
  if (internship?.company) return internship.company.trim();

  const withCompany = (input.experience || []).find((entry) => hasValue(entry.company));
  if (withCompany?.company) return withCompany.company.trim();

  for (const cert of input.certifications || []) {
    const text = String(cert || "");
    const fromMatch = text.match(/internship(?:\s*[:\-–—]\s*|\s+).{0,100}?\bfrom\s+([^|/]+)/i);
    const atMatch = text.match(/\b(?:intern(?:ship)?|trainee)\b.{0,60}?\bat\s+([^|/]+)/i);
    const company = (fromMatch?.[1] || atMatch?.[1] || "").replace(/\s+/g, " ").trim();
    if (company) return company;
  }

  return undefined;
}

function careerId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `career_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

function educationEntriesToCareer(entries: EducationEntry[]): Array<Record<string, unknown>> {
  return entries.map((entry) => ({
    id: careerId(),
    institution: entry.institution || "",
    degree: entry.degree || "",
    fieldOfStudy: entry.fieldOfStudy || "",
    location: "",
    startDate: entry.startYear || "",
    endDate: entry.endYear || "",
    grade: entry.grade || "",
    activities: "",
    status: entry.status || "",
    source: "cv",
  }));
}

function credentialsToCareer(entries: CredentialEntry[]): Array<Record<string, unknown>> {
  return dedupeCredentialEntries(entries).map((entry) => ({
    id: careerId(),
    type: entry.type || "certification",
    title: entry.title || "Credential",
    issuer: entry.issuer || "",
    date: entry.date || "",
    url: entry.verificationLink || "",
    description: entry.description || "",
    source: "cv",
  }));
}

/** Normalize credential titles for dedupe (strip prefixes, collapse whitespace). */
export function normalizeCredentialTitleKey(title: string): string {
  return String(title || "")
    .toLowerCase()
    .replace(/^(?:internship|certificate|certification|award|credential)\s*[:\-–—]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Internships belong in Work Experience, not Credentials & Recognition. */
export function isInternshipLikeCredential(entry: {
  title?: string;
  description?: string;
  type?: string;
}): boolean {
  const blob = `${entry.title || ""} ${entry.description || ""}`;
  return /\bintern(?:ship)?\b/i.test(blob);
}

function credentialCompleteness(entry: CredentialEntry): number {
  return [entry.issuer, entry.verificationLink, entry.date, entry.description]
    .filter((value) => hasValue(value))
    .length;
}

function mergeCredentialEntries(existing: CredentialEntry, incoming: CredentialEntry): CredentialEntry {
  const preferIncoming = credentialCompleteness(incoming) > credentialCompleteness(existing);
  const primary = preferIncoming ? incoming : existing;
  const secondary = preferIncoming ? existing : incoming;
  return {
    title: primary.title || secondary.title,
    issuer: primary.issuer || secondary.issuer,
    date: primary.date ?? secondary.date ?? null,
    verificationLink: primary.verificationLink || secondary.verificationLink,
    type: primary.type || secondary.type || "certification",
    description: primary.description || secondary.description,
  };
}

/**
 * Dedupe credentials by normalized title and/or shared verification URL,
 * merging into the richer record (issuer, URL, dates).
 */
export function dedupeCredentialEntries(entries: CredentialEntry[]): CredentialEntry[] {
  const byTitle = new Map<string, CredentialEntry>();
  const urlToTitle = new Map<string, string>();

  for (const entry of entries) {
    if (!entry?.title?.trim()) continue;
    if (isInternshipLikeCredential(entry)) continue;

    const titleKey = normalizeCredentialTitleKey(entry.title);
    if (!titleKey) continue;
    const url = String(entry.verificationLink || "").trim().toLowerCase();

    let key = titleKey;
    if (url && urlToTitle.has(url)) {
      key = urlToTitle.get(url)!;
    }

    const existing = byTitle.get(key);
    if (existing) {
      byTitle.set(key, mergeCredentialEntries(existing, entry));
    } else {
      byTitle.set(key, entry);
    }
    if (url) urlToTitle.set(url, key);
  }

  return [...byTitle.values()];
}

/**
 * Collect credentials from structured credentials + certification lines.
 * Internships (including verify-certificate links) stay in experience only —
 * they must not be re-added as Credentials & Recognition cards.
 */
export function collectCredentialsFromExtracted(extracted: ExtractedData): CredentialEntry[] {
  const collected: CredentialEntry[] = [];

  for (const entry of extracted.credentials || []) {
    if (entry?.title?.trim()) collected.push(entry);
  }
  for (const line of extracted.certifications || []) {
    const parsed = parseCredentialLine(line);
    if (parsed) collected.push(parsed);
  }
  // Non-internship experience rows that are clearly certs/awards with a URL.
  for (const exp of extracted.experience || []) {
    if (exp.type === "internship") continue;
    if (
      exp.url
      && /cert|credential|award|license|publication/i.test(`${exp.title || ""} ${exp.description || ""}`)
    ) {
      collected.push({
        title: exp.title || "Credential",
        issuer: exp.company,
        date: null,
        verificationLink: exp.url,
        type: "certification",
        description: exp.description,
      });
    }
  }

  return dedupeCredentialEntries(collected);
}

/** Map typed experience (+ education/credentials) into career_profile sections. */
export function buildCareerProfileFromExperience(
  experience: ExperienceEntry[] | undefined,
  options?: {
    educationEntries?: EducationEntry[];
    education?: string | null;
    credentials?: CredentialEntry[];
  },
): CareerProfileLike | null {
  const experiences: Array<Record<string, unknown>> = [];
  const projects: Array<Record<string, unknown>> = [];

  for (const entry of experience || []) {
    if (entry.type === "project") {
      projects.push({
        id: careerId(),
        name: entry.title || "Project",
        role: "",
        url: entry.url || "",
        startDate: "",
        endDate: "",
        description: entry.description || "",
        highlights: entry.description
          ? entry.description.split(/\n|•/).map((part) => part.trim()).filter(Boolean)
          : [],
        skills: [],
        source: "cv",
      });
      continue;
    }
    experiences.push({
      id: careerId(),
      company: entry.company || "",
      title: entry.title || (entry.type === "internship" ? "Intern" : ""),
      location: "",
      employmentType: entry.type === "internship" ? "Internship" : "Full-time",
      startDate: extractYearToken(entry.dates) || "",
      endDate: "",
      isCurrent: false,
      summary: entry.description || "",
      highlights: entry.description
        ? entry.description.split(/\n|•/).map((part) => part.trim()).filter(Boolean)
        : [],
      skills: [],
      source: "cv",
      ...(entry.url ? { url: entry.url } : {}),
    });
  }

  const educationSource = options?.educationEntries?.length
    ? options.educationEntries
    : parseEducationString(options?.education);
  const education = educationEntriesToCareer(educationSource);
  const achievements = credentialsToCareer(options?.credentials || []);

  if (!experiences.length && !projects.length && !education.length && !achievements.length) {
    return null;
  }
  return {
    version: 1,
    experiences,
    projects,
    education,
    achievements,
    references: [],
  };
}

function isCvSourced(entry: Record<string, unknown> | undefined): boolean {
  if (!entry) return false;
  const source = String(entry.source || "").toLowerCase();
  return source === "cv" || source === "cv_upload" || source === "ai";
}

/**
 * Replace CV-derived experiences/projects/education/achievements.
 * Manually user-added achievements (no CV source flag) are preserved.
 */
export function mergeCareerProfileSections(
  current: unknown,
  fromCv: CareerProfileLike,
): CareerProfileLike {
  const existing = (current && typeof current === "object" ? current : {}) as CareerProfileLike;
  const existingAchievements = (existing.achievements || []) as Array<Record<string, unknown>>;
  const manualAchievements = existingAchievements.filter((entry) => !isCvSourced(entry));
  const cvAchievements = (fromCv.achievements || []) as Array<Record<string, unknown>>;

  return {
    version: 1,
    experiences: fromCv.experiences?.length ? fromCv.experiences : (existing.experiences || []),
    projects: fromCv.projects?.length ? fromCv.projects : (existing.projects || []),
    education: fromCv.education?.length ? fromCv.education : (existing.education || []),
    achievements: [...cvAchievements, ...manualAchievements],
    references: existing.references || [],
  };
}

export function normalizeExtractedData(raw: Record<string, unknown>): ExtractedData {
  const experience = normalizeExperienceEntries(raw.experience ?? raw.experiences);
  const certifications = toStringArray(raw.certifications);
  const educationEntries = normalizeEducationEntries(
    raw.educationEntries ?? raw.education_entries ?? raw.educationList,
  );
  const educationFlat = pickString(raw, "education")
    || (educationEntries?.length ? formatEducationFlat(educationEntries) : undefined);
  const parsedEducation = educationEntries?.length
    ? educationEntries
    : parseEducationString(educationFlat);
  const credentials = normalizeCredentialEntries(
    raw.credentials ?? raw.achievements ?? raw.awards,
  );
  const currentCompany = inferCurrentCompany({
    currentCompany: pickString(raw, "currentCompany", "current_company"),
    experience,
    certifications,
  });
  const cvSummary = pickString(raw, "cvSummary", "cv_summary", "bio", "professionalSummary", "professional_summary");

  const experienceCalc = calculateExperienceYears({
    explicitYears: toNumber(raw.experienceYears ?? raw.experience_years),
    experience,
  });
  const experienceClamp = clampExperienceYears(experienceCalc.years);
  const fieldStatus = toFieldStatus(raw.fieldStatus ?? raw.field_status) || {};
  if (experienceCalc.source !== "none" && experienceClamp.valid && (experienceClamp.value ?? 0) > 0) {
    fieldStatus.experienceYears = "present";
  }

  return {
    fullName: pickString(raw, "fullName", "full_name"),
    email: pickString(raw, "email"),
    phone: pickString(raw, "phone"),
    location: pickString(raw, "location"),
    linkedinUrl: pickString(raw, "linkedinUrl", "linkedin_url"),
    githubUrl: pickString(raw, "githubUrl", "github_url"),
    portfolioUrl: pickString(raw, "portfolioUrl", "portfolio_url"),
    currentCompany,
    skills: toStringArray(raw.skills),
    suggestedRoles: toStringArray(raw.suggestedRoles ?? raw.suggested_roles ?? raw.desired_roles),
    experienceYears: experienceClamp.valid ? (experienceClamp.value ?? undefined) : undefined,
    experienceCalcNote: experienceCalc.note || undefined,
    // Keep education raw — never drop for date-logic inconsistencies upstream.
    education: educationFlat,
    educationEntries: parsedEducation.length ? parsedEducation : undefined,
    certifications,
    credentials: (() => {
      const collected = collectCredentialsFromExtracted({
        credentials,
        certifications,
        experience,
      });
      return collected.length ? collected : undefined;
    })(),
    languages: toStringArray(raw.languages),
    cvSummary,
    experience,
    fieldStatus: Object.keys(fieldStatus).length ? fieldStatus : undefined,
    fieldConfidence: toFieldConfidence(raw.fieldConfidence ?? raw.field_confidence),
  };
}

const CV_FIELD_MAPPINGS = [
  ["full_name", "fullName", null],
  ["email", "email", null],
  ["phone", "phone", null],
  ["linkedin_url", "linkedinUrl", null],
  ["github_url", "githubUrl", null],
  ["portfolio_url", "portfolioUrl", null],
  ["current_company", "currentCompany", null],
  ["skills", "skills", []],
  ["experience_years", "experienceYears", 0],
  ["education", "education", null],
  ["certifications", "certifications", []],
  ["languages", "languages", []],
  ["cv_summary", "cvSummary", null],
] as const;

function sourceIsCvDerived(profile: ProfileLike, key: string): boolean {
  // "ai" is the provenance used by the existing CV merge. It also makes this
  // migration safe for profiles created before automatic synchronization.
  return profile.data_sources?.[key] === "ai";
}

function statusFor(extracted: ExtractedData, extractionKey: string, value: unknown): "present" | "missing" | "uncertain" {
  const explicit = extracted.fieldStatus?.[extractionKey];
  if (explicit) return explicit;
  // A parser without an explicit confidence signal must never clear a value.
  return hasValue(value) ? "present" : "uncertain";
}

/**
 * Builds the replacement payload for facts derived from a CV. User preferences
 * (location, desired roles, work mode, salary and account settings) are
 * intentionally absent from this list.
 */
export function buildLatestCvProfileSync(profile: ProfileLike, extracted: ExtractedData): CvProfileSync {
  const updatePayload: Record<string, unknown> = {};
  const updatedKeys: string[] = [];
  const clearedKeys: string[] = [];
  const uncertainKeys: string[] = [];

  for (const [profileKey, extractionKey, emptyValue] of CV_FIELD_MAPPINGS) {
    let value = extracted[extractionKey as keyof ExtractedData];
    if (profileKey === "experience_years") {
      const clamped = clampExperienceYears(value);
      if (!clamped.valid) {
        uncertainKeys.push(profileKey);
        continue;
      }
      value = clamped.value ?? 0;
    }
    const status = statusFor(extracted, extractionKey, value);
    if (status === "present" && hasValue(value)) {
      updatePayload[profileKey] = value;
      updatedKeys.push(profileKey);
    } else if (status === "missing" && sourceIsCvDerived(profile, profileKey)) {
      updatePayload[profileKey] = emptyValue;
      clearedKeys.push(profileKey);
    } else if (status === "uncertain") {
      uncertainKeys.push(profileKey);
    }
  }

  const dataSources = { ...(profile.data_sources || {}) };
  for (const key of [...updatedKeys, ...clearedKeys]) dataSources[key] = "ai";
  if (updatedKeys.length || clearedKeys.length) updatePayload.data_sources = dataSources;

  return { updatePayload, updatedKeys, clearedKeys, uncertainKeys };
}

export function buildProfileUpdateFromExtracted(
  profile: ProfileLike | null | undefined,
  extracted: ExtractedData,
): { updatePayload: Record<string, unknown>; filledKeys: string[] } {
  const p = profile || {};
  const updatePayload: Record<string, unknown> = {};
  const filledKeys: string[] = [];

  const maybeFill = (key: string, profileVal: unknown, extractedVal: unknown) => {
    if (!hasValue(profileVal) && hasValue(extractedVal)) {
      updatePayload[key] = extractedVal;
      filledKeys.push(key);
    }
  };

  maybeFill("full_name", p.full_name, extracted.fullName);
  maybeFill("email", p.email, extracted.email);
  maybeFill("phone", p.phone, extracted.phone);
  maybeFill("location", p.location, extracted.location);
  maybeFill("linkedin_url", p.linkedin_url, extracted.linkedinUrl);
  maybeFill("github_url", p.github_url, extracted.githubUrl);
  maybeFill("portfolio_url", p.portfolio_url, extracted.portfolioUrl);
  const company = extracted.currentCompany || inferCurrentCompany(extracted);
  maybeFill("current_company", p.current_company, company);
  const experienceYears = clampExperienceYears(extracted.experienceYears);
  if (experienceYears.valid) {
    maybeFill("experience_years", p.experience_years, experienceYears.value);
  }
  maybeFill("skills", p.skills, extracted.skills);
  maybeFill("desired_roles", p.desired_roles, extracted.suggestedRoles);
  maybeFill("education", p.education, extracted.education);
  maybeFill("certifications", p.certifications, extracted.certifications);
  maybeFill("languages", p.languages, extracted.languages);
  maybeFill("cv_summary", p.cv_summary, extracted.cvSummary);

  // Bio mirrors Professional Summary / cvSummary when the profile bio is empty.
  if (!hasValue(p.bio) && hasValue(extracted.cvSummary)) {
    updatePayload.bio = extracted.cvSummary;
    filledKeys.push("bio");
  }

  return { updatePayload, filledKeys };
}

/** Build field_metadata patch for experience calculation note (no new DB column). */
export function buildExperienceFieldMetadata(
  existing: unknown,
  calcNote?: string | null,
): Record<string, unknown> {
  const current = (existing && typeof existing === "object" && !Array.isArray(existing))
    ? { ...(existing as Record<string, unknown>) }
    : {};
  const experienceMeta = (
    current.experience_years && typeof current.experience_years === "object" && !Array.isArray(current.experience_years)
  )
    ? { ...(current.experience_years as Record<string, unknown>) }
    : {};
  if (calcNote?.trim()) {
    experienceMeta.calcNote = calcNote.trim();
    experienceMeta.source = "cv_upload";
    experienceMeta.lastUpdated = new Date().toISOString();
  } else {
    delete experienceMeta.calcNote;
  }
  current.experience_years = experienceMeta;
  return current;
}

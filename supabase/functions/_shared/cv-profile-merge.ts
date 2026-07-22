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
  education?: string;
  certifications?: string[];
  languages?: string[];
  cvSummary?: string;
  fieldStatus?: Record<string, "present" | "missing" | "uncertain">;
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
  data_sources?: Record<string, unknown> | null;
};

export type CvProfileSync = {
  updatePayload: Record<string, unknown>;
  updatedKeys: string[];
  clearedKeys: string[];
  uncertainKeys: string[];
};

function hasValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "string") return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "number") return val > 0;
  return false;
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
  if (typeof val === "number" && val > 0) return val;
  if (typeof val === "string") {
    const n = Number.parseFloat(val);
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

export function normalizeExtractedData(raw: Record<string, unknown>): ExtractedData {
  return {
    fullName: pickString(raw, "fullName", "full_name"),
    email: pickString(raw, "email"),
    phone: pickString(raw, "phone"),
    location: pickString(raw, "location"),
    linkedinUrl: pickString(raw, "linkedinUrl", "linkedin_url"),
    githubUrl: pickString(raw, "githubUrl", "github_url"),
    portfolioUrl: pickString(raw, "portfolioUrl", "portfolio_url"),
    currentCompany: pickString(raw, "currentCompany", "current_company"),
    skills: toStringArray(raw.skills),
    suggestedRoles: toStringArray(raw.suggestedRoles ?? raw.suggested_roles ?? raw.desired_roles),
    experienceYears: toNumber(raw.experienceYears ?? raw.experience_years),
    education: pickString(raw, "education"),
    certifications: toStringArray(raw.certifications),
    languages: toStringArray(raw.languages),
    cvSummary: pickString(raw, "cvSummary", "cv_summary"),
    fieldStatus: toFieldStatus(raw.fieldStatus ?? raw.field_status),
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
    const value = extracted[extractionKey];
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
  maybeFill("current_company", p.current_company, extracted.currentCompany);
  maybeFill("experience_years", p.experience_years, extracted.experienceYears);
  maybeFill("skills", p.skills, extracted.skills);
  maybeFill("desired_roles", p.desired_roles, extracted.suggestedRoles);
  maybeFill("education", p.education, extracted.education);
  maybeFill("certifications", p.certifications, extracted.certifications);
  maybeFill("languages", p.languages, extracted.languages);
  maybeFill("cv_summary", p.cv_summary, extracted.cvSummary);

  if (!hasValue(p.bio) && hasValue(extracted.cvSummary)) {
    updatePayload.bio = extracted.cvSummary;
    filledKeys.push("bio");
  }

  return { updatePayload, filledKeys };
}

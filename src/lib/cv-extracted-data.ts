import { hasValue } from "@/lib/constants";

export type ExperienceType = "job" | "internship" | "project";

export type ExperienceEntry = {
  title?: string;
  company?: string;
  description?: string;
  dates?: string;
  type?: ExperienceType;
  url?: string;
};

export type EducationEntry = {
  degree?: string;
  institution?: string;
  startYear?: string;
  endYear?: string;
  status?: "Completed" | "Ongoing";
  fieldOfStudy?: string;
  grade?: string;
};

export type CredentialEntry = {
  title?: string;
  issuer?: string;
  date?: string | null;
  verificationLink?: string;
  type?: "certification" | "award" | "publication";
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
};

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

function normalizeExperienceType(value: unknown): ExperienceType | undefined {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "job" || normalized === "internship" || normalized === "project") return normalized;
  if (normalized.includes("intern")) return "internship";
  if (normalized.includes("project")) return "project";
  if (normalized.includes("job") || normalized.includes("employ") || normalized.includes("work")) return "job";
  return undefined;
}

function normalizeExperienceEntries(raw: unknown): ExperienceEntry[] | undefined {
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

function inferCurrentCompany(input: {
  currentCompany?: string;
  experience?: ExperienceEntry[];
  certifications?: string[];
}): string | undefined {
  if (hasValue(input.currentCompany)) return String(input.currentCompany).trim();

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

export function normalizeExtractedData(raw: Record<string, unknown>): ExtractedData {
  const experience = normalizeExperienceEntries(raw.experience ?? raw.experiences);
  const certifications = toStringArray(raw.certifications);
  const currentCompany = inferCurrentCompany({
    currentCompany: pickString(raw, "currentCompany", "current_company"),
    experience,
    certifications,
  });

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
    experienceYears: toNumber(raw.experienceYears ?? raw.experience_years),
    experienceCalcNote: pickString(raw, "experienceCalcNote", "experience_calc_note"),
    education: pickString(raw, "education"),
    educationEntries: Array.isArray(raw.educationEntries)
      ? (raw.educationEntries as EducationEntry[])
      : undefined,
    certifications,
    credentials: Array.isArray(raw.credentials)
      ? (raw.credentials as CredentialEntry[])
      : undefined,
    languages: toStringArray(raw.languages),
    cvSummary: pickString(raw, "cvSummary", "cv_summary", "bio", "professionalSummary", "professional_summary"),
    experience,
  };
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

export const CORE_PROFILE_KEYS = [
  "full_name",
  "email",
  "phone",
  "location",
  "linkedin_url",
  "github_url",
  "skills",
  "desired_roles",
  "experience_years",
] as const;

export async function applyProfileUpdate(
  userId: string,
  updatePayload: Record<string, unknown>,
  filledKeys: string[],
): Promise<{ error: string | null; savedKeys: string[] }> {
  if (!filledKeys.length) return { error: null, savedKeys: [] };

  const corePayload: Record<string, unknown> = {};
  for (const key of CORE_PROFILE_KEYS) {
    if (updatePayload[key] !== undefined) corePayload[key] = updatePayload[key];
  }

  const { supabase } = await import("@/integrations/supabase/client");
  // PostgREST treats an UPDATE that matches no rows as a success. Request the
  // updated row so we never tell the user their CV was saved when their profile
  // record is missing (or inaccessible under RLS).
  const { data: updatedProfile, error: fullError } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();

  if (!fullError && updatedProfile) {
    try {
      await supabase.rpc("update_profile_data_sources", {
        p_user_id: userId,
        p_field_names: filledKeys,
        p_source: "ai",
      });
    } catch {
      /* graceful degradation */
    }
    return { error: null, savedKeys: filledKeys };
  }

  if (!Object.keys(corePayload).length) {
    return { error: fullError?.message || "Your profile record could not be found.", savedKeys: [] };
  }

  const { data: coreProfile, error: coreError } = await supabase
    .from("profiles")
    .update(corePayload)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();
  if (coreError || !coreProfile) {
    return { error: coreError?.message || "Your profile record could not be found.", savedKeys: [] };
  }

  const coreFilled = filledKeys.filter((k) => (CORE_PROFILE_KEYS as readonly string[]).includes(k));
  if (coreFilled.length) {
    try {
      await supabase.rpc("update_profile_data_sources", {
        p_user_id: userId,
        p_field_names: coreFilled,
        p_source: "ai",
      });
    } catch {
      /* graceful degradation */
    }
  }

  return { error: null, savedKeys: coreFilled };
}

export function profileToExtractedData(profile: ProfileLike | null | undefined): ExtractedData | null {
  if (!profile) return null;
  return {
    fullName: profile.full_name || undefined,
    email: profile.email || undefined,
    phone: profile.phone || undefined,
    location: profile.location || undefined,
    linkedinUrl: profile.linkedin_url || undefined,
    githubUrl: profile.github_url || undefined,
    portfolioUrl: profile.portfolio_url || undefined,
    currentCompany: profile.current_company || undefined,
    skills: profile.skills?.length ? profile.skills : undefined,
    suggestedRoles: profile.desired_roles?.length ? profile.desired_roles : undefined,
    experienceYears: profile.experience_years && profile.experience_years > 0 ? profile.experience_years : undefined,
    education: profile.education || undefined,
    certifications: profile.certifications?.length ? profile.certifications : undefined,
    languages: profile.languages?.length ? profile.languages : undefined,
    cvSummary: profile.cv_summary || undefined,
  };
}

export function hasExtractedCvData(data: ExtractedData | null | undefined): boolean {
  if (!data) return false;
  return !!(
    data.fullName ||
    data.email ||
    data.phone ||
    data.location ||
    data.linkedinUrl ||
    data.githubUrl ||
    data.portfolioUrl ||
    data.currentCompany ||
    data.cvSummary ||
    data.education ||
    hasValue(data.skills) ||
    hasValue(data.suggestedRoles) ||
    hasValue(data.certifications) ||
    hasValue(data.languages) ||
    hasValue(data.experience) ||
    (data.experienceYears && data.experienceYears > 0)
  );
}

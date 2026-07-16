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

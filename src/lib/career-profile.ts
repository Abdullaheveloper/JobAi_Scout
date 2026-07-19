export type CareerExperience = {
  id: string;
  company: string;
  title: string;
  location: string;
  employmentType: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  summary: string;
  highlights: string[];
  skills: string[];
};

export type CareerEducation = {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  location: string;
  startDate: string;
  endDate: string;
  grade: string;
  activities: string;
};

export type CareerProject = {
  id: string;
  name: string;
  role: string;
  url: string;
  startDate: string;
  endDate: string;
  description: string;
  highlights: string[];
  skills: string[];
};

export type CareerAchievement = {
  id: string;
  type: "certification" | "award" | "publication";
  title: string;
  issuer: string;
  date: string;
  url: string;
  description: string;
};

export type CareerReference = {
  id: string;
  fullName: string;
  relationship: string;
  company: string;
  email: string;
  phone: string;
  permissionToContact: boolean;
};

export type CareerProfile = {
  version: 1;
  experiences: CareerExperience[];
  education: CareerEducation[];
  projects: CareerProject[];
  achievements: CareerAchievement[];
  references: CareerReference[];
};

export type AutofillPreferences = {
  version: 1;
  textAutofillConfidence: number;
  checkboxConfidence: number;
  reviewBeforeSensitiveAnswers: boolean;
};

const stringValue = (value: unknown) => typeof value === "string" ? value.trim() : "";
const stringList = (value: unknown): string[] => Array.isArray(value)
  ? value.map(stringValue).filter(Boolean)
  : typeof value === "string"
    ? value.split(/\n|,/).map((item) => item.trim()).filter(Boolean)
    : [];

export const createCareerId = () => globalThis.crypto?.randomUUID?.()
  || `career_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const emptyCareerProfile = (): CareerProfile => ({
  version: 1,
  experiences: [],
  education: [],
  projects: [],
  achievements: [],
  references: [],
});

export const defaultAutofillPreferences = (): AutofillPreferences => ({
  version: 1,
  textAutofillConfidence: 0.75,
  // 0.41 is the user's requested lower bound. The extension still blocks
  // legal, consent and diversity fields regardless of this value.
  checkboxConfidence: 0.41,
  reviewBeforeSensitiveAnswers: true,
});

function normalizeExperience(raw: unknown): CareerExperience | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const company = stringValue(value.company);
  const title = stringValue(value.title);
  if (!company && !title) return null;
  return {
    id: stringValue(value.id) || createCareerId(),
    company,
    title,
    location: stringValue(value.location),
    employmentType: stringValue(value.employmentType ?? value.employment_type),
    startDate: stringValue(value.startDate ?? value.start_date),
    endDate: stringValue(value.endDate ?? value.end_date),
    isCurrent: Boolean(value.isCurrent ?? value.is_current),
    summary: stringValue(value.summary ?? value.description),
    highlights: stringList(value.highlights),
    skills: stringList(value.skills),
  };
}

function normalizeEducation(raw: unknown): CareerEducation | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const institution = stringValue(value.institution ?? value.school);
  const degree = stringValue(value.degree);
  if (!institution && !degree) return null;
  return {
    id: stringValue(value.id) || createCareerId(),
    institution,
    degree,
    fieldOfStudy: stringValue(value.fieldOfStudy ?? value.field_of_study),
    location: stringValue(value.location),
    startDate: stringValue(value.startDate ?? value.start_date),
    endDate: stringValue(value.endDate ?? value.end_date),
    grade: stringValue(value.grade),
    activities: stringValue(value.activities ?? value.description),
  };
}

function normalizeProject(raw: unknown): CareerProject | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const name = stringValue(value.name);
  if (!name) return null;
  return {
    id: stringValue(value.id) || createCareerId(),
    name,
    role: stringValue(value.role),
    url: stringValue(value.url),
    startDate: stringValue(value.startDate ?? value.start_date),
    endDate: stringValue(value.endDate ?? value.end_date),
    description: stringValue(value.description ?? value.summary),
    highlights: stringList(value.highlights),
    skills: stringList(value.skills),
  };
}

function normalizeAchievement(raw: unknown): CareerAchievement | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const title = stringValue(value.title);
  if (!title) return null;
  const type = stringValue(value.type);
  return {
    id: stringValue(value.id) || createCareerId(),
    type: type === "award" || type === "publication" ? type : "certification",
    title,
    issuer: stringValue(value.issuer ?? value.publisher),
    date: stringValue(value.date),
    url: stringValue(value.url),
    description: stringValue(value.description),
  };
}

function normalizeReference(raw: unknown): CareerReference | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const fullName = stringValue(value.fullName ?? value.full_name ?? value.name);
  if (!fullName) return null;
  return {
    id: stringValue(value.id) || createCareerId(),
    fullName,
    relationship: stringValue(value.relationship),
    company: stringValue(value.company),
    email: stringValue(value.email),
    phone: stringValue(value.phone),
    permissionToContact: Boolean(value.permissionToContact ?? value.permission_to_contact),
  };
}

export function normalizeCareerProfile(raw: unknown): CareerProfile {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const asArray = (item: unknown) => Array.isArray(item) ? item : [];
  return {
    version: 1,
    experiences: asArray(value.experiences).map(normalizeExperience).filter((item): item is CareerExperience => Boolean(item)),
    education: asArray(value.education).map(normalizeEducation).filter((item): item is CareerEducation => Boolean(item)),
    projects: asArray(value.projects).map(normalizeProject).filter((item): item is CareerProject => Boolean(item)),
    achievements: asArray(value.achievements).map(normalizeAchievement).filter((item): item is CareerAchievement => Boolean(item)),
    references: asArray(value.references).map(normalizeReference).filter((item): item is CareerReference => Boolean(item)),
  };
}

export function normalizeAutofillPreferences(raw: unknown): AutofillPreferences {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const numberInRange = (input: unknown, fallback: number) => {
    const result = typeof input === "number" ? input : Number(input);
    return Number.isFinite(result) && result >= 0 && result <= 1 ? result : fallback;
  };
  return {
    version: 1,
    textAutofillConfidence: numberInRange(value.textAutofillConfidence ?? value.text_autofill_confidence, 0.75),
    checkboxConfidence: Math.max(0.41, numberInRange(value.checkboxConfidence ?? value.checkbox_confidence, 0.41)),
    reviewBeforeSensitiveAnswers: value.reviewBeforeSensitiveAnswers ?? value.review_before_sensitive_answers ?? true,
  };
}

export function careerEntryCount(profile: CareerProfile): number {
  return profile.experiences.length + profile.education.length + profile.projects.length + profile.achievements.length + profile.references.length;
}

export function mergeCareerProfileIfEmpty(current: unknown, incoming: unknown): CareerProfile | null {
  const existing = normalizeCareerProfile(current);
  const candidate = normalizeCareerProfile(incoming);
  if (!careerEntryCount(candidate)) return null;
  const merged: CareerProfile = {
    version: 1,
    experiences: existing.experiences.length ? existing.experiences : candidate.experiences,
    education: existing.education.length ? existing.education : candidate.education,
    projects: existing.projects.length ? existing.projects : candidate.projects,
    achievements: existing.achievements.length ? existing.achievements : candidate.achievements,
    references: existing.references.length ? existing.references : candidate.references,
  };
  return JSON.stringify(existing) === JSON.stringify(merged) ? null : merged;
}

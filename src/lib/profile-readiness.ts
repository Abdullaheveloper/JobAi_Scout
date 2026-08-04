import type { TFunction } from "i18next";

export type ProfileReadinessLike = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  bio?: string | null;
  skills?: string[] | string | null;
  desired_roles?: string[] | string | null;
  experience_years?: number | string | null;
  resume_url?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
  current_company?: string | null;
  education?: string | null;
  profile_completion?: number | null;
};

export type ProfileReadinessItem = {
  key: string;
  label: string;
  done: boolean;
};

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

/** Shared readiness checklist used by Upload CV and Profile Settings. */
export function buildProfileReadinessItems(
  profile: ProfileReadinessLike | null | undefined,
  t: TFunction,
): ProfileReadinessItem[] {
  if (!profile) return [];
  return [
    { key: "full_name", label: t("cv.fieldName"), done: hasValue(profile.full_name) },
    { key: "email", label: t("cv.fieldEmail"), done: hasValue(profile.email) },
    { key: "phone", label: t("cv.fieldPhone"), done: hasValue(profile.phone) },
    { key: "location", label: t("cv.fieldLocation"), done: hasValue(profile.location) },
    { key: "bio", label: t("cv.fieldBio"), done: hasValue(profile.bio) },
    { key: "skills", label: t("cv.fieldSkills"), done: hasValue(profile.skills) },
    { key: "desired_roles", label: t("cv.fieldRoles"), done: hasValue(profile.desired_roles) },
    { key: "experience_years", label: t("cv.fieldExperience"), done: hasValue(profile.experience_years) },
    { key: "resume_url", label: t("cv.fieldResume"), done: hasValue(profile.resume_url) },
    { key: "linkedin_url", label: t("cv.fieldLinkedIn"), done: hasValue(profile.linkedin_url) },
    { key: "github_url", label: t("cv.fieldGitHub"), done: hasValue(profile.github_url) },
    { key: "portfolio_url", label: t("cv.fieldPortfolio"), done: hasValue(profile.portfolio_url) },
    { key: "current_company", label: t("cv.fieldCompany"), done: hasValue(profile.current_company) },
    { key: "education", label: t("cv.fieldEducation"), done: hasValue(profile.education) },
  ];
}

export function profileReadinessPercent(items: ProfileReadinessItem[], canonical?: number | null): number {
  if (typeof canonical === "number" && Number.isFinite(canonical)) {
    return Math.round(Math.min(100, Math.max(0, canonical)));
  }
  if (!items.length) return 0;
  return Math.round((items.filter((item) => item.done).length / items.length) * 100);
}

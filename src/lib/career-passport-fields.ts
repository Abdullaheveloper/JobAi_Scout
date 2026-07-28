import type { TFunction } from "i18next";

export type CareerEditorKind = "experience" | "education" | "project" | "achievement" | "reference";

export type CareerFieldKind = "input" | "textarea" | "checkbox" | "select" | "currentEndDate";

export type CareerFieldDef = {
  key: string;
  labelKey: string;
  placeholderKey?: string;
  hintKey?: string;
  type?: string;
  kind?: CareerFieldKind;
  colSpan?: "full";
  options?: Array<{ value: string; labelKey: string }>;
  /** When true, hide this field while draft.isCurrent is true (experience end date). */
  hideWhenCurrent?: boolean;
};

export const CAREER_EDITOR_FIELDS: Record<CareerEditorKind, CareerFieldDef[]> = {
  experience: [
    { key: "title", labelKey: "careerPassport.fields.jobTitle", placeholderKey: "careerPassport.placeholders.jobTitle" },
    { key: "company", labelKey: "careerPassport.fields.company", placeholderKey: "careerPassport.placeholders.company" },
    { key: "location", labelKey: "careerPassport.fields.location", placeholderKey: "careerPassport.placeholders.cityCountry" },
    { key: "employmentType", labelKey: "careerPassport.fields.employmentType", placeholderKey: "careerPassport.placeholders.employmentType" },
    { key: "startDate", labelKey: "careerPassport.fields.startDate", type: "month" },
    { key: "endDate", labelKey: "careerPassport.fields.endDate", type: "month", kind: "currentEndDate", hideWhenCurrent: true },
    { key: "isCurrent", labelKey: "careerPassport.fields.currentlyWorkHere", kind: "checkbox", colSpan: "full" },
    { key: "summary", labelKey: "careerPassport.fields.roleSummary", placeholderKey: "careerPassport.placeholders.roleSummary", kind: "textarea", colSpan: "full" },
    { key: "highlights", labelKey: "careerPassport.fields.highlights", placeholderKey: "careerPassport.placeholders.highlights", hintKey: "careerPassport.hints.realOutcomes", kind: "textarea", colSpan: "full" },
    { key: "skills", labelKey: "careerPassport.fields.skillsUsed", placeholderKey: "careerPassport.placeholders.skillsList", hintKey: "careerPassport.hints.commaSkills", kind: "textarea", colSpan: "full" },
  ],
  education: [
    { key: "degree", labelKey: "careerPassport.fields.degree", placeholderKey: "careerPassport.placeholders.degree" },
    { key: "institution", labelKey: "careerPassport.fields.institution", placeholderKey: "careerPassport.placeholders.institution" },
    { key: "fieldOfStudy", labelKey: "careerPassport.fields.fieldOfStudy", placeholderKey: "careerPassport.placeholders.fieldOfStudy" },
    { key: "location", labelKey: "careerPassport.fields.location", placeholderKey: "careerPassport.placeholders.cityCountry" },
    { key: "startDate", labelKey: "careerPassport.fields.startYear", placeholderKey: "careerPassport.placeholders.startYear" },
    { key: "endDate", labelKey: "careerPassport.fields.endYear", placeholderKey: "careerPassport.placeholders.endYear" },
    {
      key: "status",
      labelKey: "careerPassport.fields.status",
      kind: "select",
      options: [
        { value: "", labelKey: "careerPassport.status.notSet" },
        { value: "Completed", labelKey: "careerPassport.status.completed" },
        { value: "Ongoing", labelKey: "careerPassport.status.ongoing" },
      ],
    },
    { key: "grade", labelKey: "careerPassport.fields.grade", placeholderKey: "careerPassport.placeholders.optional" },
    { key: "activities", labelKey: "careerPassport.fields.activities", placeholderKey: "careerPassport.placeholders.activities", kind: "textarea", colSpan: "full" },
  ],
  project: [
    { key: "name", labelKey: "careerPassport.fields.projectName", placeholderKey: "careerPassport.placeholders.projectName" },
    { key: "role", labelKey: "careerPassport.fields.yourRole", placeholderKey: "careerPassport.placeholders.yourRole" },
    { key: "url", labelKey: "careerPassport.fields.projectUrl", placeholderKey: "careerPassport.placeholders.url", type: "url" },
    { key: "startDate", labelKey: "careerPassport.fields.startDate", type: "month" },
    { key: "endDate", labelKey: "careerPassport.fields.endDate", type: "month" },
    { key: "description", labelKey: "careerPassport.fields.projectDescription", placeholderKey: "careerPassport.placeholders.projectDescription", kind: "textarea", colSpan: "full" },
    { key: "highlights", labelKey: "careerPassport.fields.highlights", placeholderKey: "careerPassport.placeholders.highlights", kind: "textarea", colSpan: "full" },
    { key: "skills", labelKey: "careerPassport.fields.toolsAndSkills", placeholderKey: "careerPassport.placeholders.toolsSkills", hintKey: "careerPassport.hints.commaSkills", kind: "textarea", colSpan: "full" },
  ],
  achievement: [
    {
      key: "type",
      labelKey: "careerPassport.fields.type",
      kind: "select",
      options: [
        { value: "certification", labelKey: "careerPassport.types.certification" },
        { value: "award", labelKey: "careerPassport.types.award" },
        { value: "publication", labelKey: "careerPassport.types.publication" },
      ],
    },
    { key: "title", labelKey: "careerPassport.fields.title", placeholderKey: "careerPassport.placeholders.credentialTitle" },
    { key: "issuer", labelKey: "careerPassport.fields.issuer", placeholderKey: "careerPassport.placeholders.organization" },
    { key: "date", labelKey: "careerPassport.fields.date", type: "month" },
    { key: "url", labelKey: "careerPassport.fields.credentialUrl", placeholderKey: "careerPassport.placeholders.url", type: "url" },
    { key: "description", labelKey: "careerPassport.fields.details", placeholderKey: "careerPassport.placeholders.optionalContext", kind: "textarea", colSpan: "full" },
  ],
  reference: [
    { key: "fullName", labelKey: "careerPassport.fields.fullName", placeholderKey: "careerPassport.placeholders.referenceName" },
    { key: "relationship", labelKey: "careerPassport.fields.relationship", placeholderKey: "careerPassport.placeholders.relationship" },
    { key: "company", labelKey: "careerPassport.fields.company", placeholderKey: "careerPassport.placeholders.organization" },
    { key: "email", labelKey: "careerPassport.fields.email", placeholderKey: "careerPassport.placeholders.email", type: "email" },
    { key: "phone", labelKey: "careerPassport.fields.phone", placeholderKey: "careerPassport.placeholders.phone", type: "tel" },
    { key: "permissionToContact", labelKey: "careerPassport.fields.permissionToContact", kind: "checkbox", colSpan: "full" },
  ],
};

export type ProfileCareerFieldDef = {
  key: string;
  labelKey: string;
  placeholderKey?: string;
  hintKey?: string;
  type?: string;
  kind?: "input" | "textarea";
  dataSourceKey?: string;
  icon?: "linkedin" | "github" | "globe" | "award" | "languages";
};

/** Professional links + matching essentials + credentials field schema for Profile Settings. */
export const PROFESSIONAL_LINK_FIELDS: ProfileCareerFieldDef[] = [
  { key: "linkedin_url", labelKey: "careerPassport.fields.linkedinUrl", placeholderKey: "settings.placeholderLinkedin", dataSourceKey: "linkedin_url", icon: "linkedin", type: "url" },
  { key: "github_url", labelKey: "careerPassport.fields.githubUrl", placeholderKey: "settings.placeholderGithub", dataSourceKey: "github_url", icon: "github", type: "url" },
  { key: "portfolio_url", labelKey: "careerPassport.fields.portfolioUrl", placeholderKey: "settings.placeholderPortfolio", dataSourceKey: "portfolio_url", icon: "globe", type: "url" },
];

export const MATCHING_ESSENTIAL_FIELDS: ProfileCareerFieldDef[] = [
  { key: "skills", labelKey: "careerPassport.fields.skills", placeholderKey: "settings.placeholderSkills", dataSourceKey: "skills", hintKey: "careerPassport.hints.skillsSuggest", kind: "input" },
  { key: "desired_roles", labelKey: "settings.desiredRoles", placeholderKey: "settings.placeholderRoles", dataSourceKey: "desired_roles", kind: "textarea" },
];

export const CREDENTIAL_PROFILE_FIELDS: ProfileCareerFieldDef[] = [
  { key: "certifications", labelKey: "careerPassport.fields.certifications", placeholderKey: "settings.placeholderCerts", dataSourceKey: "certifications", icon: "award", kind: "textarea", hintKey: "careerPassport.hints.certsComma" },
  { key: "languages", labelKey: "careerPassport.fields.languages", placeholderKey: "settings.placeholderLanguages", dataSourceKey: "languages", icon: "languages", kind: "input", hintKey: "careerPassport.hints.languagesComma" },
];

export const WORK_PREFERENCE_OPTIONS = [
  { value: "", labelKey: "settings.choosePreference" },
  { value: "onsite", labelKey: "settings.onsite" },
  { value: "hybrid", labelKey: "settings.hybrid" },
  { value: "remote", labelKey: "settings.remote" },
] as const;

export const AVAILABILITY_OPTIONS = [
  { value: "", labelKey: "settings.chooseAnswer" },
  { value: "Immediately", labelKey: "careerPassport.availability.immediately" },
  { value: "1 week", labelKey: "careerPassport.availability.oneWeek" },
  { value: "2 weeks", labelKey: "careerPassport.availability.twoWeeks" },
  { value: "4 weeks", labelKey: "careerPassport.availability.fourWeeks" },
] as const;

const EDITOR_KIND_LABEL: Record<CareerEditorKind, string> = {
  experience: "careerPassport.kinds.experience",
  education: "careerPassport.kinds.education",
  project: "careerPassport.kinds.project",
  achievement: "careerPassport.kinds.achievement",
  reference: "careerPassport.kinds.reference",
};

export function careerEditorTitleKey(kind: CareerEditorKind, isNew: boolean): string {
  return isNew ? "careerPassport.dialog.addTitle" : "careerPassport.dialog.editTitle";
}

export function careerEditorKindLabelKey(kind: CareerEditorKind): string {
  return EDITOR_KIND_LABEL[kind];
}

/** Translate stored English experience calc notes for display. */
export function translateExperienceCalcNote(note: string, t: TFunction): string {
  if (!note) return "";

  const fromMatch = note.match(/^Auto-calculated from:\s*(.+)$/i);
  if (fromMatch) {
    const detail = fromMatch[1]
      .replace(
        /(\d+)\s+internship(s)?(\s*\([^)]*\))?/gi,
        (_m, count: string, _s: string, duration = "") =>
          `${t("careerPassport.calc.internship", { count: Number(count) })}${duration || ""}`,
      )
      .replace(
        /(\d+)\s+project(s)?(\s*\([^)]*\))?/gi,
        (_m, count: string, _s: string, duration = "") =>
          `${t("careerPassport.calc.project", { count: Number(count) })}${duration || ""}`,
      )
      .replace(
        /(\d+)\s+job(s)?(\s*\([^)]*\))?/gi,
        (_m, count: string, _s: string, duration = "") =>
          `${t("careerPassport.calc.job", { count: Number(count) })}${duration || ""}`,
      );
    return t("careerPassport.calc.from", { detail });
  }

  const datedMatch = note.match(/^Auto-calculated from dated experience \((.+)\s+years?\)$/i);
  if (datedMatch) {
    return t("careerPassport.calc.fromDated", { years: datedMatch[1] });
  }

  const statedMatch = note.match(/^From CV stated experience:\s*(.+)\s+years?$/i);
  if (statedMatch) {
    return t("careerPassport.calc.fromStated", { years: statedMatch[1] });
  }

  return note;
}

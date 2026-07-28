import type { LucideIcon } from "lucide-react";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Building2,
  DollarSign,
  GraduationCap,
  FileText,
} from "lucide-react";

/** Form keys for the Profile Settings contact / background card. */
export type ProfileContactFormKey =
  | "full_name"
  | "email"
  | "phone"
  | "location"
  | "experience_years"
  | "current_company"
  | "expected_salary"
  | "education"
  | "bio";

export type ProfileContactInputKind =
  | "text"
  | "email-locked"
  | "phone"
  | "location"
  | "number"
  | "textarea";

/**
 * Shared contact-form field schema. Labels, placeholders, helpers, and
 * validation copy all resolve through these i18n keys so no field can
 * drift to a hardcoded English path.
 */
export type ProfileContactFieldSchema = {
  id: ProfileContactFormKey;
  /** `data_sources` / field_metadata key when present. */
  sourceKey?: ProfileContactFormKey;
  labelKey: string;
  placeholderKey?: string;
  helperKey?: string;
  invalidKey?: string;
  icon: LucideIcon;
  input: ProfileContactInputKind;
  /** When true, field spans the full card width (bio). */
  fullWidth?: boolean;
};

export const PROFILE_CONTACT_FIELDS: readonly ProfileContactFieldSchema[] = [
  {
    id: "full_name",
    sourceKey: "full_name",
    labelKey: "settings.fullName",
    placeholderKey: "settings.placeholderName",
    icon: User,
    input: "text",
  },
  {
    id: "email",
    labelKey: "settings.email",
    helperKey: "settings.emailLocked",
    icon: Mail,
    input: "email-locked",
  },
  {
    id: "phone",
    sourceKey: "phone",
    labelKey: "settings.phone",
    placeholderKey: "settings.placeholderPhone",
    invalidKey: "settings.phoneInvalid",
    icon: Phone,
    input: "phone",
  },
  {
    id: "location",
    sourceKey: "location",
    labelKey: "settings.location",
    placeholderKey: "settings.placeholderLocation",
    helperKey: "settings.locationHint",
    icon: MapPin,
    input: "location",
  },
  {
    id: "experience_years",
    sourceKey: "experience_years",
    labelKey: "settings.experienceYears",
    invalidKey: "settings.experienceInvalid",
    icon: Briefcase,
    input: "number",
  },
  {
    id: "current_company",
    sourceKey: "current_company",
    labelKey: "settings.currentCompany",
    placeholderKey: "settings.placeholderCompany",
    icon: Building2,
    input: "text",
  },
  {
    id: "expected_salary",
    sourceKey: "expected_salary",
    labelKey: "settings.expectedSalary",
    placeholderKey: "settings.placeholderSalary",
    helperKey: "settings.salaryHint",
    invalidKey: "settings.salaryInvalid",
    icon: DollarSign,
    input: "text",
  },
  {
    id: "education",
    sourceKey: "education",
    labelKey: "settings.education",
    placeholderKey: "settings.placeholderEducation",
    helperKey: "settings.educationHint",
    icon: GraduationCap,
    input: "text",
  },
  {
    id: "bio",
    labelKey: "settings.bio",
    placeholderKey: "settings.placeholderBio",
    icon: FileText,
    input: "textarea",
    fullWidth: true,
  },
] as const;

const BY_ID = Object.fromEntries(
  PROFILE_CONTACT_FIELDS.map((field) => [field.id, field]),
) as Record<ProfileContactFormKey, ProfileContactFieldSchema>;

export function getContactField(id: ProfileContactFormKey): ProfileContactFieldSchema {
  return BY_ID[id];
}

/** Pair fields into responsive two-column rows; fullWidth fields get their own row. */
export function groupContactFields(
  fields: readonly ProfileContactFieldSchema[] = PROFILE_CONTACT_FIELDS,
): ProfileContactFieldSchema[][] {
  const rows: ProfileContactFieldSchema[][] = [];
  let pair: ProfileContactFieldSchema[] = [];

  for (const field of fields) {
    if (field.fullWidth) {
      if (pair.length) {
        rows.push(pair);
        pair = [];
      }
      rows.push([field]);
      continue;
    }
    pair.push(field);
    if (pair.length === 2) {
      rows.push(pair);
      pair = [];
    }
  }
  if (pair.length) rows.push(pair);
  return rows;
}

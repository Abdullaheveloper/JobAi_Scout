import { z } from "zod";

// ── Profile ──
export const EducationEntrySchema = z.object({
  institution: z.string(),
  degree: z.string(),
  field: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
export type EducationEntry = z.infer<typeof EducationEntrySchema>;

export const ProjectEntrySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  url: z.string().optional(),
});
export type ProjectEntry = z.infer<typeof ProjectEntrySchema>;

export const UserProfileSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string(),
  address: z.string(),
  country: z.string(),
  city: z.string(),
  postalCode: z.string(),
  linkedin: z.string().url().optional().or(z.literal("")),
  github: z.string().url().optional().or(z.literal("")),
  portfolio: z.string().url().optional().or(z.literal("")),
  experienceYears: z.number(),
  currentCompany: z.string().optional(),
  currentRole: z.string().optional(),
  noticePeriod: z.string().optional(),
  expectedSalary: z.string().optional(),
  skills: z.array(z.string()),
  education: z.array(EducationEntrySchema),
  projects: z.array(ProjectEntrySchema),
  resumeFileName: z.string().optional(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

// ── Field Classification ──
export interface FieldMeta {
  element: HTMLElement;
  tagName: string;
  inputType?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  ariaLabel?: string;
  title?: string;
  autocomplete?: string;
  labelText: string;
  nearbyText: string;
  required: boolean;
  visible: boolean;
  disabled: boolean;
  readonly: boolean;
  xpath: string;
  role?: string;
}

export type FieldCategory =
  | "FULL_NAME"
  | "FIRST_NAME"
  | "LAST_NAME"
  | "EMAIL"
  | "PHONE"
  | "ADDRESS"
  | "CITY"
  | "COUNTRY"
  | "POSTAL_CODE"
  | "LINKEDIN"
  | "GITHUB"
  | "PORTFOLIO"
  | "EXPERIENCE_YEARS"
  | "CURRENT_COMPANY"
  | "CURRENT_ROLE"
  | "NOTICE_PERIOD"
  | "SALARY"
  | "SKILLS"
  | "COVER_LETTER"
  | "RESUME_UPLOAD"
  | "UNKNOWN";

export interface ClassifiedField extends FieldMeta {
  category: FieldCategory;
  confidence: number;
}

export interface FillResult {
  field: ClassifiedField;
  status: "filled" | "skipped_no_data" | "skipped_unknown" | "error";
  reason?: string;
}

// ── Auth ──
export interface AuthSession {
  token: string;
  refreshToken: string;
  userId: string;
  expiresAt: number;
}

// ── Messages ──
export type ContentMessage =
  | { type: "FILL_FORM"; profile: UserProfile }
  | { type: "SCAN_FIELDS" }
  | { type: "GET_UNFILLED" };

export type ContentResponse =
  | { type: "FILL_RESULT"; results: FillResult[] }
  | { type: "SCANNED_FIELDS"; fields: ClassifiedField[] }
  | { type: "UNFILLED_FIELDS"; fields: ClassifiedField[] };

// ── API Response ──
export const LoginResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
  userId: z.string(),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const ProfileResponseSchema = UserProfileSchema.partial().extend({
  id: z.string().optional(),
});
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;

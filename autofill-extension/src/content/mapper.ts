import type { FieldCategory, UserProfile } from "../lib/types";
import { COUNTRY_ALIASES } from "../lib/constants";

function normalizeCountry(input: string): string {
  const lower = input.toLowerCase().trim();
  return COUNTRY_ALIASES[lower] || input;
}

function findSelectOption(
  select: HTMLSelectElement,
  value: string
): HTMLOptionElement | null {
  const normalized = value.toLowerCase().trim();
  const countryValue = normalizeCountry(value).toLowerCase();

  for (const opt of Array.from(select.options)) {
    const optText = opt.textContent?.toLowerCase().trim() || "";
    const optVal = opt.value.toLowerCase().trim();

    // Exact match
    if (optText === normalized || optVal === normalized) return opt;
    if (optText === countryValue || optVal === countryValue) return opt;

    // Contains match
    if (optText.includes(normalized) || normalized.includes(optText)) return opt;
    if (optText.includes(countryValue) || countryValue.includes(optText)) return opt;
  }

  return null;
}

export function mapToProfile(
  category: FieldCategory,
  profile: UserProfile
): string | string[] | null {
  const skills = Array.isArray(profile.skills) ? profile.skills.join(", ") : "";

  const map: Record<FieldCategory, string | string[] | null> = {
    FULL_NAME: profile.name || null,
    FIRST_NAME: profile.name?.split(" ")[0] || null,
    LAST_NAME: profile.name?.split(" ").slice(1).join(" ") || null,
    EMAIL: profile.email || null,
    PHONE: profile.phone || null,
    ADDRESS: profile.address || null,
    CITY: profile.city || null,
    COUNTRY: profile.country || null,
    POSTAL_CODE: profile.postalCode || null,
    LINKEDIN: profile.linkedin || null,
    GITHUB: profile.github || null,
    PORTFOLIO: profile.portfolio || profile.linkedin || profile.github || null,
    EXPERIENCE_YEARS: profile.experienceYears ? String(profile.experienceYears) : null,
    CURRENT_COMPANY: profile.currentCompany || null,
    CURRENT_ROLE: profile.currentRole || null,
    NOTICE_PERIOD: profile.noticePeriod || null,
    SALARY: profile.expectedSalary || null,
    SKILLS: skills || null,
    COVER_LETTER: null, // No auto-fill for cover letters
    RESUME_UPLOAD: null, // No programmatic file upload
    UNKNOWN: null,
  };

  return map[category] || null;
}

export { findSelectOption };

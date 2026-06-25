const INVALID_PLACEHOLDERS = new Set([
  "",
  "0",
  "00",
  "no",
  "n/a",
  "none",
  "-",
  "--",
  "null",
  "undefined",
]);

export function cleanProfileValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value > 0 ? value : null;
  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => cleanProfileValue(item))
      .filter((item): item is string => typeof item === "string" && item.length > 0);
    return cleaned.length ? cleaned : [];
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return INVALID_PLACEHOLDERS.has(trimmed.toLowerCase()) ? null : trimmed;
  }
  return value;
}

export function hasProfileValue(value: unknown): boolean {
  const cleaned = cleanProfileValue(value);
  if (cleaned === null || cleaned === undefined) return false;
  if (Array.isArray(cleaned)) return cleaned.length > 0;
  if (typeof cleaned === "number") return cleaned > 0;
  if (typeof cleaned === "string") return cleaned.length > 0;
  return true;
}

export function cleanCsvList(value: string): string[] {
  const cleaned = cleanProfileValue(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  return Array.isArray(cleaned) ? cleaned : [];
}

export const PROFILE_COMPLETION_WEIGHTS = [
  { key: "full_name", label: "Full Name", weight: 10, get: (p: any) => p?.full_name },
  { key: "email", label: "Email", weight: 10, get: (p: any) => p?.email },
  { key: "phone", label: "Phone", weight: 10, get: (p: any) => p?.phone },
  { key: "skills", label: "Skills", weight: 10, get: (p: any) => p?.skills },
  { key: "education", label: "Education", weight: 10, get: (p: any) => p?.education },
  { key: "experience_years", label: "Experience", weight: 15, get: (p: any) => p?.experience_years },
  { key: "linkedin_url", label: "LinkedIn", weight: 5, get: (p: any) => p?.linkedin_url },
  { key: "github_url", label: "GitHub", weight: 5, get: (p: any) => p?.github_url },
  { key: "portfolio_url", label: "Portfolio", weight: 5, get: (p: any) => p?.portfolio_url },
  { key: "profile_picture_url", label: "Profile Picture", weight: 5, get: (p: any) => p?.profile_picture_url },
  { key: "languages", label: "Languages", weight: 5, get: (p: any) => p?.languages },
  { key: "certifications", label: "Certifications", weight: 5, get: (p: any) => p?.certifications },
];

export function getProfileCompletion(profile: any) {
  const total = PROFILE_COMPLETION_WEIGHTS.reduce((sum, item) => sum + item.weight, 0);
  const fields = PROFILE_COMPLETION_WEIGHTS.map((item) => ({
    key: item.key,
    label: item.label,
    weight: item.weight,
    done: hasProfileValue(item.get(profile)),
  }));
  const completed = fields.filter((item) => item.done).reduce((sum, item) => sum + item.weight, 0);
  return {
    percent: total ? Math.round((completed / total) * 100) : 0,
    fields,
    missing: fields.filter((item) => !item.done),
  };
}

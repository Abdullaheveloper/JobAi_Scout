/** Supported UI locales. */
export type AppLocale = "en" | "fr" | "de" | "hi" | "ur" | "ar";

export interface LanguageOption {
  code: AppLocale;
  label: string;
  /** Native / short label shown in the switcher */
  nativeLabel: string;
  /** Right-to-left writing system */
  dir?: "ltr" | "rtl";
}

export const DEFAULT_LOCALE: AppLocale = "en";

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English", dir: "ltr" },
  { code: "fr", label: "French", nativeLabel: "Français", dir: "ltr" },
  { code: "de", label: "German", nativeLabel: "Deutsch", dir: "ltr" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी", dir: "ltr" },
  { code: "ur", label: "Urdu", nativeLabel: "اردو", dir: "rtl" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", dir: "rtl" },
];

export const RTL_LOCALES: ReadonlySet<AppLocale> = new Set(
  SUPPORTED_LANGUAGES.filter((l) => l.dir === "rtl").map((l) => l.code),
);

export const LOCALE_STORAGE_KEY = "jobai_preferred_locale";

export function isSupportedLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && SUPPORTED_LANGUAGES.some((lang) => lang.code === value);
}

export function isRtlLocale(value: unknown): boolean {
  return isSupportedLocale(value) && RTL_LOCALES.has(value);
}

export function resolveLocale(...candidates: Array<string | null | undefined>): AppLocale {
  for (const candidate of candidates) {
    if (!candidate) continue;
    // Accept BCP-47 tags like ur-PK / ar-SA
    const base = candidate.toLowerCase().split("-")[0];
    if (isSupportedLocale(base)) return base;
    if (isSupportedLocale(candidate)) return candidate;
  }
  return DEFAULT_LOCALE;
}

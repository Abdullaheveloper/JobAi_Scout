/** Supported UI locales. */
export type AppLocale = "en" | "fr" | "de" | "hi";

export interface LanguageOption {
  code: AppLocale;
  label: string;
  /** Native / short label shown in the switcher */
  nativeLabel: string;
}

export const DEFAULT_LOCALE: AppLocale = "en";

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "fr", label: "French", nativeLabel: "Français" },
  { code: "de", label: "German", nativeLabel: "Deutsch" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
];

export const LOCALE_STORAGE_KEY = "jobai_preferred_locale";

export function isSupportedLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && SUPPORTED_LANGUAGES.some((lang) => lang.code === value);
}

export function resolveLocale(...candidates: Array<string | null | undefined>): AppLocale {
  for (const candidate of candidates) {
    if (isSupportedLocale(candidate)) return candidate;
  }
  return DEFAULT_LOCALE;
}

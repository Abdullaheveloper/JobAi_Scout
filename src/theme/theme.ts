export type AppTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "jobai_theme";
export const DEFAULT_THEME: AppTheme = "dark";

export function isAppTheme(value: unknown): value is AppTheme {
  return value === "light" || value === "dark";
}

/** OS preference; returns null if matchMedia is unavailable. */
export function getSystemTheme(): AppTheme | null {
  try {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return null;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return null;
  }
}

export function readStoredTheme(): AppTheme | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return isAppTheme(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredTheme(theme: AppTheme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore private-mode / quota failures.
  }
}

/**
 * Resolution order: explicit candidates (profile, storage, …) → OS → default dark.
 */
export function resolveTheme(...candidates: Array<string | null | undefined>): AppTheme {
  for (const candidate of candidates) {
    if (isAppTheme(candidate)) return candidate;
  }
  return getSystemTheme() ?? DEFAULT_THEME;
}

/** Apply theme class on <html> for Tailwind `dark:` + CSS variable scopes. */
export function applyThemeClass(theme: AppTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
  root.dataset.theme = theme;
}

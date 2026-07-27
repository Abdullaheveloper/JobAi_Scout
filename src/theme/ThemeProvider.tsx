import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  AppTheme,
  applyThemeClass,
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
} from "@/theme/theme";

type ThemeContextValue = {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function persistThemeToProfile(userId: string, theme: AppTheme) {
  void supabase
    .from("profiles")
    .update({ preferred_theme: theme })
    .eq("user_id", userId)
    .then(({ error }) => {
      if (error && import.meta.env.DEV) {
        console.warn("[theme] Failed to persist preferred_theme:", error.message);
      }
    });
}

/**
 * Applies theme preference priority:
 * logged-in profile.preferred_theme → localStorage → OS prefers-color-scheme → dark.
 * Persists to localStorage always and profiles.preferred_theme when logged in.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const userIdRef = useRef<string | undefined>(user?.id);
  userIdRef.current = user?.id;

  const [theme, setThemeState] = useState<AppTheme>(() =>
    resolveTheme(readStoredTheme()),
  );

  const commitTheme = useCallback((next: AppTheme, persistRemote: boolean) => {
    setThemeState(next);
    applyThemeClass(next);
    writeStoredTheme(next);
    if (persistRemote && userIdRef.current) {
      persistThemeToProfile(userIdRef.current, next);
    }
  }, []);

  const setTheme = useCallback(
    (next: AppTheme) => commitTheme(next, true),
    [commitTheme],
  );

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyThemeClass(next);
      writeStoredTheme(next);
      if (userIdRef.current) {
        persistThemeToProfile(userIdRef.current, next);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  const profileTheme = profile?.preferred_theme ?? null;

  // Profile / guest resolution — same pattern as LocaleProvider.
  useEffect(() => {
    const next = resolveTheme(
      user ? profileTheme : null,
      readStoredTheme(),
    );

    setThemeState((prev) => (prev === next ? prev : next));
    applyThemeClass(next);
    writeStoredTheme(next);
  }, [user, profileTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  AppLocale,
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  resolveLocale,
} from "@/i18n/languages";
import { useDirection } from "@/hooks/useDirection";
import { useVoiceStore } from "@/stores/voice-store";

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function writeLocalLocale(locale: AppLocale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore private-mode / quota failures; in-memory i18n state still works.
  }
}

function readLocalLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Applies locale preference priority:
 * logged-in profile.preferred_locale → localStorage → English default.
 * Also persists switcher changes to localStorage (always) and profile (when logged in).
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const { user, profile } = useAuth();
  const appliedProfileRef = useRef<string | null>(null);
  const hydratedUserRef = useRef<string | null>(null);
  const [locale, setLocaleState] = useState<AppLocale>(() => resolveLocale(i18n.resolvedLanguage || i18n.language));

  // Sync html[dir] for RTL locales (ur/ar) on load and every language change.
  useDirection();

  const setLocale = useCallback((nextLocale: AppLocale) => {
    const next = resolveLocale(nextLocale);
    writeLocalLocale(next);
    setLocaleState(next);
    useVoiceStore.getState().updateSettings({ language: next });
    if (resolveLocale(i18n.resolvedLanguage || i18n.language) !== next) void i18n.changeLanguage(next);
  }, [i18n]);

  useEffect(() => {
    document.documentElement.lang = resolveLocale(i18n.resolvedLanguage || i18n.language);
  }, [i18n.language, i18n.resolvedLanguage]);

  useEffect(() => {
    useVoiceStore.getState().updateSettings({ language: locale });
  }, [locale]);

  useEffect(() => {
    if (!user) {
      hydratedUserRef.current = null;
      return;
    }
    if (!profile || hydratedUserRef.current === user.id) return;
    hydratedUserRef.current = user.id;
    const profileLocale = profile.preferred_locale ?? null;
    const next = resolveLocale(
      profileLocale,
      readLocalLocale(),
      DEFAULT_LOCALE,
    );

    setLocale(next);

    if (profileLocale) {
      appliedProfileRef.current = profileLocale;
    }
  }, [user, profile, setLocale]);

  useEffect(() => {
    const onLanguageChanged = (lng: string) => {
      const locale = resolveLocale(lng, DEFAULT_LOCALE);
      writeLocalLocale(locale);
      setLocaleState(locale);
      useVoiceStore.getState().updateSettings({ language: locale });

      if (!user) return;
      if (appliedProfileRef.current === locale) return;

      appliedProfileRef.current = locale;
      void supabase
        .from("profiles")
        .update({ preferred_locale: locale })
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error && import.meta.env.DEV) {
            console.warn("[i18n] Failed to persist preferred_locale:", error.message);
          }
        });
    };

    i18n.on("languageChanged", onLanguageChanged);
    return () => {
      i18n.off("languageChanged", onLanguageChanged);
    };
  }, [i18n, user]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== LOCALE_STORAGE_KEY || !event.newValue) return;
      setLocale(resolveLocale(event.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [setLocale]);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider");
  return context;
}

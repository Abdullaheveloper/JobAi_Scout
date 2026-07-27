import { ReactNode, useEffect, useRef } from "react";
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

  // Sync html[dir] for RTL locales (ur/ar) on load and every language change.
  useDirection();

  useEffect(() => {
    document.documentElement.lang = resolveLocale(i18n.resolvedLanguage || i18n.language);
  }, [i18n.language, i18n.resolvedLanguage]);

  useEffect(() => {
    const profileLocale = profile?.preferred_locale ?? null;
    const next = resolveLocale(
      user ? profileLocale : null,
      readLocalLocale(),
      DEFAULT_LOCALE,
    );

    if (i18n.language !== next) {
      void i18n.changeLanguage(next);
    }
    writeLocalLocale(next);

    if (user && profileLocale) {
      appliedProfileRef.current = profileLocale;
    }
  }, [user?.id, profile?.preferred_locale, i18n]);

  useEffect(() => {
    const onLanguageChanged = (lng: string) => {
      const locale = resolveLocale(lng, DEFAULT_LOCALE);
      writeLocalLocale(locale);

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

  return <>{children}</>;
}

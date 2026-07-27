import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { isRtlLocale, resolveLocale } from "@/i18n/languages";

/**
 * Keeps <html dir> in sync with the active locale.
 * RTL for Urdu (ur) and Arabic (ar); LTR otherwise.
 * Mount once via LocaleProvider — pages should not call this manually.
 */
export function useDirection() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const apply = (lng?: string) => {
      const locale = resolveLocale(lng || i18n.resolvedLanguage || i18n.language);
      document.documentElement.dir = isRtlLocale(locale) ? "rtl" : "ltr";
    };

    apply(i18n.language);
    const onLanguageChanged = (lng: string) => apply(lng);
    i18n.on("languageChanged", onLanguageChanged);
    return () => {
      i18n.off("languageChanged", onLanguageChanged);
    };
  }, [i18n]);
}

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import de from "@/locales/de.json";
import hi from "@/locales/hi.json";
import ur from "@/locales/ur.json";
import ar from "@/locales/ar.json";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, resolveLocale } from "@/i18n/languages";

const missingKeysLogged = new Set<string>();

function readStoredLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

const initialLocale = resolveLocale(readStoredLocale(), DEFAULT_LOCALE);

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    de: { translation: de },
    hi: { translation: hi },
    ur: { translation: ur },
    ar: { translation: ar },
  },
  lng: initialLocale,
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: "translation",
  ns: ["translation"],
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
  returnEmptyString: false,
  parseMissingKeyHandler: (key) => {
    if (import.meta.env.DEV && !missingKeysLogged.has(key)) {
      missingKeysLogged.add(key);
      console.warn(`[i18n] Missing translation key: ${key}`);
    }
    return key;
  },
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: (_lngs, _ns, key) => {
    if (import.meta.env.DEV && !missingKeysLogged.has(key)) {
      missingKeysLogged.add(key);
      console.warn(`[i18n] Missing translation key: ${key}`);
    }
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;

import { useCallback, useEffect, useState } from "react";

export const COOKIE_CONSENT_KEY = "jobai_cookie_consent";
const OPEN_SETTINGS_EVENT = "jobai:open-cookie-settings";

export type CookieConsent = {
  accepted: boolean;
  timestamp: number;
};

function isConsent(value: unknown): value is CookieConsent {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.accepted === "boolean" && typeof record.timestamp === "number";
}

export function getCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isConsent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** True only when the user has explicitly accepted non-essential cookies. */
export function hasAnalyticsConsent(): boolean {
  return getCookieConsent()?.accepted === true;
}

/** Re-open the consent banner (e.g. from a footer "Cookie Settings" link). */
export function openCookieSettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}

function persistConsent(accepted: boolean): CookieConsent {
  const consent: CookieConsent = { accepted, timestamp: Date.now() };
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
  return consent;
}

export function useCookieConsent() {
  const [ready, setReady] = useState(false);
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [forceShow, setForceShow] = useState(false);

  useEffect(() => {
    setConsent(getCookieConsent());
    setReady(true);

    const onOpenSettings = () => setForceShow(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
  }, []);

  const accept = useCallback(() => {
    setConsent(persistConsent(true));
    setForceShow(false);
  }, []);

  const reject = useCallback(() => {
    setConsent(persistConsent(false));
    setForceShow(false);
  }, []);

  return {
    ready,
    consent,
    /** Banner visible on first visit, or when Cookie Settings reopens it. */
    showBanner: ready && (forceShow || consent === null),
    accept,
    reject,
    openSettings: openCookieSettings,
    hasAnalyticsConsent: consent?.accepted === true,
  };
}

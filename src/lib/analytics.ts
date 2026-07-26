import { hasAnalyticsConsent } from "@/hooks/useCookieConsent";

let initialized = false;

/**
 * Initialize non-essential analytics/tracking only after Accept.
 * Wire gtag / Plausible / etc. here when added — always gated by consent.
 */
export function initAnalytics(): void {
  if (initialized || !hasAnalyticsConsent()) return;
  initialized = true;

  // Placeholder: add analytics SDK/script init here when introduced.
  // Example:
  // loadGtag(import.meta.env.VITE_GA_MEASUREMENT_ID);
}

function teardownAnalytics(): void {
  if (!initialized) return;
  initialized = false;
  // Placeholder: remove scripts / disable collectors when added.
}

/** Keep analytics in sync with the latest consent choice. */
export function syncAnalyticsWithConsent(): void {
  if (hasAnalyticsConsent()) initAnalytics();
  else teardownAnalytics();
}

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (!hasAnalyticsConsent()) return;
  if (!initialized) initAnalytics();

  // Placeholder for future event tracking.
  void name;
  void params;
}

/** Call on app boot; no-ops unless the user previously accepted. */
export function bootstrapAnalytics(): void {
  syncAnalyticsWithConsent();
}

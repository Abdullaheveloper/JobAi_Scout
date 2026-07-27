import { useEffect } from "react";
import { Cookie } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { openCookieSettings, useCookieConsent } from "@/hooks/useCookieConsent";
import { bootstrapAnalytics, syncAnalyticsWithConsent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const buttonClass = cn(
  "inline-flex h-9 flex-1 items-center justify-center rounded-lg px-4 text-sm font-semibold transition",
  "border border-violet-400/30 bg-violet-500/10 text-violet-700 dark:text-violet-100",
  "hover:bg-violet-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50",
);

export function CookieConsentBanner() {
  const { t } = useTranslation();
  const { showBanner, accept, reject, consent } = useCookieConsent();

  useEffect(() => {
    bootstrapAnalytics();
  }, []);

  useEffect(() => {
    if (consent !== null) syncAnalyticsWithConsent();
  }, [consent]);

  if (!showBanner) return null;

  return (
    <div
      role="region"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-end p-4 sm:p-5"
    >
      <div
        className={cn(
          "pointer-events-auto w-full max-w-md rounded-2xl border p-4 shadow-2xl backdrop-blur-md sm:p-5",
        )}
        style={{
          background: "var(--cookie-bg)",
          borderColor: "var(--cookie-border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-200">
            <Cookie className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p id="cookie-consent-title" className="text-sm font-semibold text-foreground">
              {t("cookies.title")}
            </p>
            <p id="cookie-consent-desc" className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("cookies.description")}{" "}
              <Link to="/privacy" className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
                {t("common.privacyPolicy")}
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button type="button" className={buttonClass} onClick={reject}>
            {t("cookies.reject")}
          </button>
          <button type="button" className={buttonClass} onClick={accept}>
            {t("cookies.accept")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Footer control that reopens the consent banner. */
export function CookieSettingsLink({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={openCookieSettings} className={className}>
      {t("cookies.settings")}
    </button>
  );
}

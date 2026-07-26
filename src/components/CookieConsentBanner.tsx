import { useEffect } from "react";
import { Cookie } from "lucide-react";
import { Link } from "react-router-dom";
import { openCookieSettings, useCookieConsent } from "@/hooks/useCookieConsent";
import { bootstrapAnalytics, syncAnalyticsWithConsent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const buttonClass = cn(
  "inline-flex h-9 flex-1 items-center justify-center rounded-lg px-4 text-sm font-semibold transition",
  "border border-violet-400/30 bg-violet-500/10 text-violet-100",
  "hover:bg-violet-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50",
);

export function CookieConsentBanner() {
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
          "pointer-events-auto w-full max-w-md rounded-2xl border border-white/10",
          "bg-[#111936]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-5",
        )}
      >
        <div className="flex gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-200">
            <Cookie className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p id="cookie-consent-title" className="text-sm font-semibold text-white">
              Cookie preferences
            </p>
            <p id="cookie-consent-desc" className="mt-1 text-xs leading-5 text-slate-300">
              We use essential cookies for sign-in and core features. Non-essential cookies help with
              analytics only if you accept.{" "}
              <Link to="/privacy" className="text-violet-300 underline-offset-2 hover:underline">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button type="button" className={buttonClass} onClick={reject}>
            Reject
          </button>
          <button type="button" className={buttonClass} onClick={accept}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

/** Footer control that reopens the consent banner. */
export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openCookieSettings} className={className}>
      Cookie Settings
    </button>
  );
}

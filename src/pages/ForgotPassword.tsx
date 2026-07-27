import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { JobAILogo } from "@/components/brand/JobAILogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!emailPattern.test(email.trim())) return setError(t("forgotPassword.errorEmail"));
    setError("");
    setLoading(true);
    const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (requestError) return setError(requestError.message);
    setSent(true);
  };

  return (
    <main className="min-h-screen bg-[#f6f6f2] text-[#1c1c1c]">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to="/" aria-label={t("brand.homeAria")}><JobAILogo markClassName="h-9 w-9" /></Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>
      </header>
      <section className="mx-auto flex max-w-6xl justify-center px-5 py-12 sm:py-20">
        <div className="w-full max-w-[440px] rounded-xl border border-black/15 bg-white p-6 shadow-[0_3px_12px_rgba(0,0,0,0.1)] sm:p-8">
          {!sent ? (
            <>
              <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#087332] hover:underline">
                <ArrowLeft className="h-4 w-4" /> {t("forgotPassword.backToSignIn")}
              </Link>
              <h1 className="mt-7 text-2xl font-bold tracking-tight">{t("forgotPassword.title")}</h1>
              <p className="mt-2 text-sm leading-6 text-[#5c5c5c]">{t("forgotPassword.copy")}</p>
              {error && <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}
              <form onSubmit={submit} className="mt-6">
                <label className="block text-sm font-semibold">
                  {t("forgotPassword.emailLabel")}
                  <span className="relative mt-2 block">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
                    <input
                      className="auth-light-input"
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      placeholder={t("forgotPassword.emailPlaceholder")}
                      autoComplete="email"
                    />
                  </span>
                </label>
                <button disabled={loading} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0caa41] text-sm font-bold text-white transition hover:bg-[#087d30] disabled:opacity-60">
                  {loading ? t("forgotPassword.submitting") : <>{t("forgotPassword.submit")} <ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#d9f7e5] text-[#087332]">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h1 className="mt-5 text-2xl font-bold tracking-tight">{t("forgotPassword.sentTitle")}</h1>
              <p className="mt-3 text-sm leading-6 text-[#5c5c5c]">
                {t("forgotPassword.sentCopy", { email })}
              </p>
              <button onClick={() => setSent(false)} className="mt-6 text-sm font-semibold text-[#087332] hover:underline">
                {t("forgotPassword.useDifferent")}
              </button>
              <div className="mt-6 border-t border-black/10 pt-5">
                <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#087332] hover:underline">
                  <ArrowLeft className="h-4 w-4" /> {t("forgotPassword.backToSignIn")}
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

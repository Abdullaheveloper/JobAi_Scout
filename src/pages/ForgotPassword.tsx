import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { JobAILogo } from "@/components/brand/JobAILogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MixedDir } from "@/components/MixedDir";
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
    <main className="auth-page">
      <header className="auth-header border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link to="/" aria-label={t("brand.homeAria")} className="auth-logo-link shrink-0">
            <JobAILogo markClassName="h-9 w-9" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
            <Link to="/login" className="auth-link text-sm font-semibold sm:hidden">
              {t("common.signIn")}
            </Link>
          </div>
        </div>
      </header>
      <section className="mx-auto flex max-w-6xl justify-center px-5 py-10 sm:py-20">
        <div data-auth-card className="auth-card w-full max-w-[440px] p-6 sm:p-8">
          {!sent ? (
            <>
              <Link to="/login" className="auth-link inline-flex items-center gap-1.5 text-sm font-semibold hover:underline">
                <ArrowLeft className="h-4 w-4 rtl-flip" /> {t("forgotPassword.backToSignIn")}
              </Link>
              <h1 className="mt-7 text-2xl font-bold tracking-tight text-foreground">{t("forgotPassword.title")}</h1>
              <p className="auth-muted mt-2 text-sm leading-6">
                <MixedDir>{t("forgotPassword.copy")}</MixedDir>
              </p>
              {error && <div className="auth-alert mt-5 px-3 py-2.5 text-sm">{error}</div>}
              <form onSubmit={submit} className="mt-6">
                <label className="block text-sm font-semibold text-foreground">
                  {t("forgotPassword.emailLabel")}
                  <span className="relative mt-2 block">
                    <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      className="auth-light-input"
                      type="email"
                      dir="ltr"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      placeholder={t("forgotPassword.emailPlaceholder")}
                      autoComplete="email"
                    />
                  </span>
                </label>
                <button
                  disabled={loading}
                  type="submit"
                  className="auth-primary mt-6 flex h-12 w-full items-center justify-center gap-2 text-sm font-bold text-white transition disabled:opacity-60"
                >
                  {loading ? t("forgotPassword.submitting") : <>{t("forgotPassword.submit")} <ArrowRight className="h-4 w-4 rtl-flip" /></>}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">{t("forgotPassword.sentTitle")}</h1>
              <p className="auth-muted mt-3 text-sm leading-6">
                <MixedDir>{t("forgotPassword.sentCopy", { email })}</MixedDir>
              </p>
              <button type="button" onClick={() => setSent(false)} className="auth-link mt-6 text-sm font-semibold hover:underline">
                {t("forgotPassword.useDifferent")}
              </button>
              <div className="mt-6 border-t border-border pt-5">
                <Link to="/login" className="auth-link inline-flex items-center gap-1.5 text-sm font-semibold hover:underline">
                  <ArrowLeft className="h-4 w-4 rtl-flip" /> {t("forgotPassword.backToSignIn")}
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

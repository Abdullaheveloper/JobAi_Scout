import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { JobAILogo } from "@/components/brand/JobAILogo";
import { supabase } from "@/integrations/supabase/client";
import { NavAppearanceControls } from "@/components/NavAppearanceControls";
import { MixedDir } from "@/components/MixedDir";
import { useTranslation } from "react-i18next";

export default function ResetPassword() {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const fail = (message: string) => active && setError(message);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && active) setReady(true);
    });
    const verify = async () => {
      const search = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const problem = search.get("error_description") || hash.get("error_description");
      if (problem) return fail(problem.replace(/\+/g, " "));
      const code = search.get("code");
      if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError || !data.session) {
          return fail(exchangeError?.message || t("resetPassword.invalidCopy"));
        }
        if (active) setReady(true);
        return;
      }
      if (hash.get("type") !== "recovery") {
        return fail(t("resetPassword.invalidCopy"));
      }
      const { data } = await supabase.auth.getSession();
      if (data.session && active) setReady(true);
    };
    void verify();
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [t]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setError(t("resetPassword.tooShort"));
    if (password !== confirmPassword) return setError(t("resetPassword.mismatch"));
    setError("");
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) return setError(updateError.message);
    await supabase.auth.signOut();
    setComplete(true);
  };

  return (
    <main className="auth-page">
      <header className="auth-header border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link to="/" aria-label={t("brand.homeAria")} className="auth-logo-link shrink-0">
            <JobAILogo markClassName="h-9 w-9" />
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <NavAppearanceControls />
            <Link to="/login" className="auth-link shrink-0 text-sm font-semibold sm:hidden">
              {t("common.signIn")}
            </Link>
          </div>
        </div>
      </header>
      <section className="mx-auto flex max-w-6xl justify-center px-5 py-10 sm:py-20">
        <div data-auth-card className="auth-card w-full max-w-[440px] p-6 sm:p-8">
          {error && !ready ? (
            <InvalidLink message={error} />
          ) : complete ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h1 className="mt-5 text-2xl font-bold text-foreground">{t("resetPassword.successTitle")}</h1>
              <p className="auth-muted mt-3 text-sm leading-6">
                <MixedDir>{t("resetPassword.successCopy")}</MixedDir>
              </p>
              <button
                type="button"
                onClick={() => navigate("/login", { replace: true })}
                className="auth-primary mt-6 flex h-12 w-full items-center justify-center gap-2 text-sm font-bold text-white"
              >
                {t("resetPassword.goToSignIn")} <ArrowRight className="h-4 w-4 rtl-flip" />
              </button>
            </div>
          ) : !ready ? (
            <div className="py-10 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="auth-muted mt-4 text-sm">{t("resetPassword.verifyingLink")}</p>
            </div>
          ) : (
            <>
              <Link to="/login" className="auth-link inline-flex items-center gap-1.5 text-sm font-semibold hover:underline">
                <ArrowLeft className="h-4 w-4 rtl-flip" /> {t("forgotPassword.backToSignIn")}
              </Link>
              <h1 className="mt-7 text-2xl font-bold tracking-tight text-foreground">{t("resetPassword.title")}</h1>
              <p className="auth-muted mt-2 text-sm leading-6">
                <MixedDir>{t("resetPassword.copy")}</MixedDir>
              </p>
              {error && <div className="auth-alert mt-5 px-3 py-2.5 text-sm">{error}</div>}
              <form onSubmit={submit} className="mt-6 space-y-5">
                <PasswordField
                  label={t("resetPassword.passwordLabel")}
                  value={password}
                  onChange={setPassword}
                  visible={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                  placeholder={t("signup.passwordPlaceholder")}
                  hideLabel={t("common.hidePassword")}
                  showLabel={t("common.showPassword")}
                />
                <PasswordField
                  label={t("resetPassword.confirmLabel")}
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  visible={showConfirm}
                  onToggle={() => setShowConfirm((v) => !v)}
                  placeholder={t("signup.passwordPlaceholder")}
                  hideLabel={t("common.hidePassword")}
                  showLabel={t("common.showPassword")}
                />
                <button
                  disabled={loading}
                  type="submit"
                  className="auth-primary flex h-12 w-full items-center justify-center gap-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {loading ? t("resetPassword.submitting") : <>{t("resetPassword.submit")} <ArrowRight className="h-4 w-4 rtl-flip" /></>}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  placeholder,
  hideLabel,
  showLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  placeholder: string;
  hideLabel: string;
  showLabel: string;
}) {
  return (
    <label className="block text-sm font-semibold text-foreground">
      {label}
      <span className="relative mt-2 block">
        <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className="auth-light-input pe-10"
          dir="auto"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={visible ? hideLabel : showLabel}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  );
}

function InvalidLink({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Lock className="h-5 w-5" />
      </div>
      <h1 className="mt-5 text-2xl font-bold text-foreground">{t("resetPassword.invalidTitle")}</h1>
      <p className="auth-muted mt-3 text-sm leading-6">
        <MixedDir>{message}</MixedDir>
      </p>
      <Link
        to="/forgot-password"
        className="auth-primary mt-6 inline-flex h-12 w-full items-center justify-center rounded-md text-sm font-bold text-white"
      >
        {t("resetPassword.requestNewLink")}
      </Link>
    </div>
  );
}

import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Building2, Check, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { JobAILogo } from "@/components/brand/JobAILogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

type Role = "user" | "recruiter";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const { t } = useTranslation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [searchParams] = useSearchParams();
  const [role, setRole] = useState<Role>(() => searchParams.get("role") === "recruiter" ? "recruiter" : "user");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    if (!fullName.trim()) return setError(t("signup.errorFullName"));
    if (!emailPattern.test(email.trim())) return setError(t("signup.errorEmail"));
    if (password.length < 8) return setError(t("signup.errorPassword"));
    if (role === "recruiter" && !companyName.trim()) return setError(t("signup.errorCompany"));

    setError("");
    setLoading(true);
    const metadata: Record<string, string> = { full_name: fullName.trim(), role };
    if (role === "recruiter") metadata.company_name = companyName.trim();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(), password,
      options: { data: metadata, emailRedirectTo: `${window.location.origin}/login` },
    });
    setLoading(false);
    if (signUpError) {
      const msg = signUpError.message || "";
      if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("already been registered")) {
        return setError(t("signup.errorAlreadyRegistered"));
      }
      return setError(msg);
    }
    if (data.session) {
      toast({
        title: t("signup.toastCreatedTitle"),
        description: t("signup.toastCreatedBody"),
      });
      navigate("/waiting-approval", { replace: true, state: { approvalStatus: "pending" } });
    } else {
      navigate("/login", { state: { emailConfirmationPending: true, email: email.trim() }, replace: true });
    }
  };

  const strengthKey =
    password.length >= 12 ? "signup.strengthStrong" : password.length >= 8 ? "signup.strengthGood" : password ? "signup.strengthTooShort" : "";
  const strength = strengthKey ? t(strengthKey) : "";

  return (
    <main className="min-h-screen bg-[#f6f6f2] text-[#1c1c1c]">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link to="/" aria-label={t("brand.homeAria")}><JobAILogo markClassName="h-9 w-9" /></Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LanguageSwitcher />
            <p className="hidden text-sm text-[#5c5c5c] sm:block">{t("signup.alreadyHave")} <Link to="/login" className="font-semibold text-[#0c7a35] hover:underline">{t("common.signIn")}</Link></p>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-12 lg:grid-cols-[1fr_500px] lg:items-start lg:px-8 lg:py-16">
        <div className="hidden pt-10 lg:block">
          <span className="rounded-full bg-[#d9f7e5] px-3 py-1 text-xs font-semibold text-[#087332]">{t("signup.eyebrow")}</span>
          <h1 className="mt-5 max-w-xl text-5xl font-bold leading-[1.05] tracking-tight">{t("signup.sideTitle")}</h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-[#595959]">{t("signup.sideCopy")}</p>
          <ul className="mt-9 space-y-4 text-sm text-[#404040]">
            {[t("signup.benefit1"), t("signup.benefit2"), t("signup.benefit3")].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d9f7e5] text-[#087332]"><Check className="h-3.5 w-3.5" /></span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-black/15 bg-white p-6 shadow-[0_3px_12px_rgba(0,0,0,0.1)] sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight">{t("signup.title")}</h2>
          <p className="mt-1 text-sm text-[#5c5c5c]">{t("signup.subtitle")}</p>
          {error && <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">{error}</div>}

          <div className="mt-6 grid grid-cols-2 gap-3" role="group" aria-label={t("signup.accountType")}>
            {(["user", "recruiter"] as Role[]).map((option) => {
              const selected = role === option;
              const Icon = option === "user" ? User : Building2;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRole(option)}
                  className={`rounded-lg border p-3 text-left transition ${selected ? "border-[#0caa41] bg-[#edfff3] ring-1 ring-[#0caa41]" : "border-black/15 hover:border-[#0caa41]/60"}`}
                >
                  <Icon className={`h-4 w-4 ${selected ? "text-[#087332]" : "text-[#5c5c5c]"}`} />
                  <p className="mt-2 text-sm font-bold">{option === "user" ? t("signup.jobSeeker") : t("signup.recruiter")}</p>
                  <p className="mt-0.5 text-xs text-[#5c5c5c]">{option === "user" ? t("signup.jobSeekerHint") : t("signup.recruiterHint")}</p>
                </button>
              );
            })}
          </div>

          {role === "recruiter" && (
            <div className="mt-4">
              <Field label={t("signup.companyName")} icon={Building2}>
                <input
                  className="auth-light-input"
                  value={companyName}
                  onChange={(e) => { setCompanyName(e.target.value); setError(""); }}
                  placeholder={t("signup.companyPlaceholder")}
                  autoComplete="organization"
                />
              </Field>
            </div>
          )}

          <form onSubmit={handleRegister} className="mt-5 space-y-4" noValidate>
            <Field label={t("signup.fullName")} icon={User}>
              <input className="auth-light-input" value={fullName} onChange={(e) => { setFullName(e.target.value); setError(""); }} placeholder={t("signup.fullNamePlaceholder")} autoComplete="name" />
            </Field>
            <Field label={t("signup.emailLabel")} icon={Mail}>
              <input className="auth-light-input" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder={t("signup.emailPlaceholder")} autoComplete="email" />
            </Field>
            <Field
              label={t("signup.passwordLabel")}
              icon={Lock}
              action={
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? t("common.hidePassword") : t("common.showPassword")} className="text-[#667085] hover:text-[#1c1c1c]">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            >
              <input className="auth-light-input pr-10" type={showPassword ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} placeholder={t("signup.passwordPlaceholder")} autoComplete="new-password" />
            </Field>
            {strength && (
              <p className={`text-xs ${strengthKey === "signup.strengthTooShort" ? "text-red-600" : "text-[#087332]"}`}>
                {t("signup.passwordStrength", { strength })}
              </p>
            )}
            <button type="submit" disabled={loading} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0caa41] text-sm font-bold text-white transition hover:bg-[#087d30] disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? t("signup.submitting") : <>{t("signup.submit")} <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
          <p className="mt-5 text-center text-xs leading-5 text-[#5c5c5c]">
            {t("signup.agreePrefix")}{" "}
            <Link to="/privacy" className="font-semibold text-[#087332] hover:underline">{t("common.privacyPolicy")}</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}

function Field({ label, icon: Icon, action, children }: { label: string; icon: typeof User; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <span className="relative mt-2 block">
        <span className="pointer-events-none absolute left-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md bg-[#eef8f1] text-[#087332]">
          <Icon className="h-3.5 w-3.5" />
        </span>
        {children}
        {action && <span className="absolute right-3 top-1/2 -translate-y-1/2">{action}</span>}
      </span>
    </label>
  );
}

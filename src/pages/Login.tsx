import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { JobAILogo } from "@/components/brand/JobAILogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MixedDir } from "@/components/MixedDir";
import { useToast } from "@/hooks/use-toast";
import type { ApprovalStatus } from "@/contexts/AuthContext";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function destinationForRole(role: string | undefined) {
  if (role === "admin") return "/admin";
  if (role === "recruiter") return "/recruiter/jobs";
  return "/dashboard";
}

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const confirmationPending = Boolean((location.state as { emailConfirmationPending?: boolean } | null)?.emailConfirmationPending);
  const waitingApproval = Boolean((location.state as { waitingApproval?: boolean } | null)?.waitingApproval);

  useEffect(() => {
    if (waitingApproval) {
      setError(t("signin.errorWaitingApproval"));
    }
  }, [waitingApproval, t]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!emailPattern.test(email.trim())) return setError(t("signin.errorInvalidEmail"));
    if (!password) return setError(t("signin.errorEmptyPassword"));

    setError("");
    setLoading(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError || !data.user) {
      setLoading(false);
      return setError(t("signin.errorCredentials"));
    }

    try {
      const userId = data.user.id;
      const [profileRes, roleRes] = await Promise.all([
        supabase.from("profiles").select("approval_status, approval_notice").eq("user_id", userId).single(),
        supabase.from("user_roles").select("role").eq("user_id", userId).single(),
      ]);

      const role = roleRes.data?.role as string | undefined;
      let approvalStatus = (profileRes.data?.approval_status as ApprovalStatus | undefined) || "approved";

      if (role !== "admin" && (approvalStatus === "expired" || approvalStatus === "rejected")) {
        const { data: renewed } = await supabase.rpc("renew_approval_request");
        approvalStatus = (renewed?.approval_status as ApprovalStatus) || "pending";
        toast({
          title: t("signin.toastApprovalRequestedTitle"),
          description: t("signin.toastApprovalRequestedBody"),
        });
      }

      if (role !== "admin" && approvalStatus !== "approved") {
        setLoading(false);
        if (approvalStatus === "pending") {
          setError(t("signin.errorWaitingApproval"));
        } else if (approvalStatus === "rejected") {
          setError(t("signin.errorRejected"));
        } else {
          setError(t("signin.errorExpired"));
        }
        navigate("/waiting-approval", { replace: true, state: { approvalStatus } });
        return;
      }

      const notice = profileRes.data?.approval_notice;
      if (notice && approvalStatus === "approved") {
        toast({ title: t("signin.toastApprovedTitle"), description: notice });
        await supabase.rpc("clear_approval_notice");
      }

      setLoading(false);
      navigate(destinationForRole(role || data.user.user_metadata?.role), { replace: true });
    } catch {
      setLoading(false);
      navigate(destinationForRole(data.user.user_metadata?.role), { replace: true });
    }
  };

  return (
    <main className="auth-page">
      <header className="auth-header border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link to="/" aria-label={t("brand.homeAria")} className="auth-logo-link shrink-0">
            <JobAILogo markClassName="h-9 w-9" />
          </Link>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <LanguageSwitcher />
            <Link to="/register" className="auth-link shrink-0 text-sm font-semibold sm:hidden">
              {t("signin.createAccount")}
            </Link>
            <p className="auth-muted hidden text-sm sm:block">
              <MixedDir>{t("signin.newHere")}</MixedDir>{" "}
              <Link to="/register" className="auth-link font-semibold hover:underline">{t("signin.createAccount")}</Link>
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-10 lg:grid-cols-[1fr_440px] lg:items-center lg:px-8 lg:py-20">
        <div className="auth-hero hidden max-w-xl lg:block" dir="auto">
          <span className="auth-kicker inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" /> {t("signin.eyebrow")}
          </span>
          <h1 className="mt-5 text-5xl font-bold leading-[1.05] tracking-tight text-foreground">{t("signin.sideTitle")}</h1>
          <p className="auth-muted mt-5 max-w-lg text-lg leading-8">
            <MixedDir>{t("signin.sideCopy")}</MixedDir>
          </p>
          <div className="auth-muted mt-9 border-s-4 border-primary ps-4 text-sm leading-6">
            <MixedDir>{t("signin.sideNote")}</MixedDir>
          </div>
        </div>

        <div data-auth-card className="auth-card p-6 sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground"><MixedDir>{t("signin.title")}</MixedDir></h2>
          <p className="auth-muted mt-1 text-sm"><MixedDir>{t("signin.welcomeBack")}</MixedDir></p>
          {confirmationPending && (
            <div className="auth-success mt-5 px-3 py-2.5 text-sm">{t("signin.confirmEmail")}</div>
          )}
          {error && (
            <div className="auth-alert mt-5 px-3 py-2.5 text-sm" role="alert">{error}</div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-5" noValidate>
            <label className="block text-sm font-semibold text-foreground">
              {t("signin.emailLabel")}
              <span className="relative mt-2 block">
                <Mail className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="auth-light-input"
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("signin.emailPlaceholder")}
                  autoComplete="email"
                />
              </span>
            </label>
            <label className="block text-sm font-semibold text-foreground">
              {t("signin.passwordLabel")}
              <span className="relative mt-2 block">
                <Lock className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="auth-light-input pe-11"
                  dir="auto"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("signin.passwordPlaceholder")}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? t("common.hidePassword") : t("common.showPassword")}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>
            <div className="flex justify-end">
              <Link to="/forgot-password" className="auth-link text-sm font-semibold hover:underline">
                <MixedDir>{t("signin.forgotPassword")}</MixedDir>
              </Link>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="auth-primary flex h-12 w-full items-center justify-center gap-2 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? t("signin.submitting") : <>{t("signin.submit")} <ArrowRight className="h-4 w-4 rtl-flip" /></>}
            </button>
          </form>
          <p className="auth-muted mt-7 border-t border-border pt-5 text-center text-sm">
            <MixedDir>{t("signin.noAccount")}</MixedDir>{" "}
            <Link to="/register" className="auth-link font-semibold hover:underline">{t("signin.createFree")}</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

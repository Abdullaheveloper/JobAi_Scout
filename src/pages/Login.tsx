import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { JobAILogo } from "@/components/brand/JobAILogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
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
    <main className="min-h-screen bg-[#f6f6f2] text-[#1c1c1c]">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link to="/" aria-label={t("brand.homeAria")}><JobAILogo markClassName="h-9 w-9" /></Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LanguageSwitcher />
            <p className="hidden text-sm text-[#5c5c5c] sm:block">{t("signin.newHere")} <Link to="/register" className="font-semibold text-[#0c7a35] hover:underline">{t("signin.createAccount")}</Link></p>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-12 lg:grid-cols-[1fr_440px] lg:items-center lg:px-8 lg:py-20">
        <div className="hidden max-w-xl lg:block">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#d9f7e5] px-3 py-1 text-xs font-semibold text-[#087332]"><ShieldCheck className="h-3.5 w-3.5" /> {t("signin.eyebrow")}</span>
          <h1 className="mt-5 text-5xl font-bold leading-[1.05] tracking-tight">{t("signin.sideTitle")}</h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-[#595959]">{t("signin.sideCopy")}</p>
          <div className="mt-9 border-l-4 border-[#0caa41] pl-4 text-sm leading-6 text-[#4d4d4d]">{t("signin.sideNote")}</div>
        </div>

        <div className="rounded-xl border border-black/15 bg-white p-6 shadow-[0_3px_12px_rgba(0,0,0,0.1)] sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight">{t("signin.title")}</h2>
          <p className="mt-1 text-sm text-[#5c5c5c]">{t("signin.welcomeBack")}</p>
          {confirmationPending && <div className="mt-5 rounded-md border border-[#8bd5a7] bg-[#edfff3] px-3 py-2.5 text-sm text-[#176c37]">{t("signin.confirmEmail")}</div>}
          {error && <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">{error}</div>}

          <form onSubmit={handleLogin} className="mt-6 space-y-5" noValidate>
            <label className="block text-sm font-semibold">{t("signin.emailLabel")}
              <span className="relative mt-2 block"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" /><input className="h-12 w-full rounded-md border border-[#767676] bg-white pl-10 pr-3 text-[#1c1c1c] outline-none transition focus:border-[#0caa41] focus:ring-2 focus:ring-[#0caa41]/25" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("signin.emailPlaceholder")} autoComplete="email" /></span>
            </label>
            <label className="block text-sm font-semibold">{t("signin.passwordLabel")}
              <span className="relative mt-2 block"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" /><input className="h-12 w-full rounded-md border border-[#767676] bg-white pl-10 pr-11 text-[#1c1c1c] outline-none transition focus:border-[#0caa41] focus:ring-2 focus:ring-[#0caa41]/25" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("signin.passwordPlaceholder")} autoComplete="current-password" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#1c1c1c]" aria-label={showPassword ? t("common.hidePassword") : t("common.showPassword")}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
            </label>
            <div className="flex justify-end"><Link to="/forgot-password" className="text-sm font-semibold text-[#087332] hover:underline">{t("signin.forgotPassword")}</Link></div>
            <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0caa41] text-sm font-bold text-white transition hover:bg-[#087d30] disabled:cursor-not-allowed disabled:opacity-60">{loading ? t("signin.submitting") : <>{t("signin.submit")} <ArrowRight className="h-4 w-4" /></>}</button>
          </form>
          <p className="mt-7 border-t border-black/10 pt-5 text-center text-sm text-[#5c5c5c]">{t("signin.noAccount")} <Link to="/register" className="font-semibold text-[#087332] hover:underline">{t("signin.createFree")}</Link></p>
        </div>
      </section>
    </main>
  );
}

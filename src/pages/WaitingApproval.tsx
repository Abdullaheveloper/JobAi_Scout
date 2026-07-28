import { useEffect } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Clock, LogOut, ShieldX, TimerOff } from "lucide-react";
import { useAuth, ApprovalStatus } from "@/contexts/AuthContext";
import { JobAILogo } from "@/components/brand/JobAILogo";
import { NavAppearanceControls } from "@/components/NavAppearanceControls";
import { MixedDir } from "@/components/MixedDir";
import { Button } from "@/components/ui/button";

export default function WaitingApproval() {
  const { t } = useTranslation();
  const { user, loading, role, approvalStatus, isAccountApproved, signOut, profile } = useAuth();
  const location = useLocation();
  const stateStatus = (location.state as { approvalStatus?: ApprovalStatus } | null)?.approvalStatus;
  const status: ApprovalStatus = approvalStatus || stateStatus || "pending";

  useEffect(() => {
    // If somehow approved while on this page, nothing else to do — Navigate handles it
  }, [isAccountApproved]);

  if (loading) {
    return (
      <div className="auth-page flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (role === "admin" || isAccountApproved) {
    const dest = role === "admin" ? "/admin" : role === "recruiter" ? "/recruiter/jobs" : "/dashboard";
    return <Navigate to={dest} replace />;
  }

  const messageMap: Record<ApprovalStatus, { title: string; body: string; icon: typeof Clock }> = {
    pending: { title: t("waitingApproval.pendingTitle"), body: t("waitingApproval.pendingBody"), icon: Clock },
    rejected: { title: t("waitingApproval.rejectedTitle"), body: t("waitingApproval.rejectedBody"), icon: ShieldX },
    expired: { title: t("waitingApproval.expiredTitle"), body: t("waitingApproval.expiredBody"), icon: TimerOff },
    approved: { title: t("waitingApproval.approvedTitle"), body: t("waitingApproval.approvedBody"), icon: Clock },
  };

  const msg = messageMap[status] || messageMap.pending;
  const Icon = msg.icon;
  const notice = profile?.approval_notice;

  return (
    <main className="auth-page">
      <header className="auth-header border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link to="/" aria-label={t("brand.homeAria")} className="auth-logo-link shrink-0">
            <JobAILogo markClassName="h-9 w-9" />
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <NavAppearanceControls />
            <Button
              variant="ghost"
              className="shrink-0 gap-2 text-muted-foreground"
              onClick={() => signOut()}
              aria-label={t("waitingApproval.signOut")}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t("waitingApproval.signOut")}</span>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto flex max-w-lg flex-col items-center px-5 py-16 text-center sm:py-20">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300">
          <Icon className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">{msg.title}</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          <MixedDir>{notice || msg.body}</MixedDir>
        </p>
        {profile?.email && (
          <p className="mt-3 text-sm text-muted-foreground">
            <MixedDir>{profile.email}</MixedDir>
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button className="auth-primary text-white" onClick={() => signOut()}>
            {t("forgotPassword.backToSignIn")}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">{t("waitingApproval.backHome")}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

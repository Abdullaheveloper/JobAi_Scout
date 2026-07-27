import { useEffect } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Clock, LogOut, ShieldX, TimerOff } from "lucide-react";
import { useAuth, ApprovalStatus } from "@/contexts/AuthContext";
import { JobAILogo } from "@/components/brand/JobAILogo";
import { Button } from "@/components/ui/button";

const MESSAGES: Record<ApprovalStatus, { title: string; body: string; icon: typeof Clock }> = {
  pending: {
    title: "Waiting for approval",
    body: "Your account is waiting for admin approval. Please wait.",
    icon: Clock,
  },
  rejected: {
    title: "Account not approved",
    body: "Your account approval request was rejected. Please try logging in again later to submit a new request, or contact support.",
    icon: ShieldX,
  },
  expired: {
    title: "Approval request expired",
    body: "Your approval request expired. Please try logging in again.",
    icon: TimerOff,
  },
  approved: {
    title: "Account approved",
    body: "Your account has been approved. You can now log in.",
    icon: Clock,
  },
};

export default function WaitingApproval() {
  const { user, loading, role, approvalStatus, isAccountApproved, signOut, profile } = useAuth();
  const location = useLocation();
  const stateStatus = (location.state as { approvalStatus?: ApprovalStatus } | null)?.approvalStatus;
  const status: ApprovalStatus = approvalStatus || stateStatus || "pending";

  useEffect(() => {
    // If somehow approved while on this page, nothing else to do — Navigate handles it
  }, [isAccountApproved]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f6f2]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0caa41] border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (role === "admin" || isAccountApproved) {
    const dest = role === "admin" ? "/admin" : role === "recruiter" ? "/recruiter/jobs" : "/dashboard";
    return <Navigate to={dest} replace />;
  }

  const msg = MESSAGES[status] || MESSAGES.pending;
  const Icon = msg.icon;
  const notice = (profile as { approval_notice?: string | null } | null)?.approval_notice;

  return (
    <main className="min-h-screen bg-[#f6f6f2] text-[#1c1c1c]">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to="/" aria-label="JobAI Scout home">
            <JobAILogo markClassName="h-9 w-9" />
          </Link>
          <Button
            variant="ghost"
            className="gap-2 text-[#5c5c5c]"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      <section className="mx-auto flex max-w-lg flex-col items-center px-5 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Icon className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">{msg.title}</h1>
        <p className="mt-4 text-base leading-7 text-[#595959]">{notice || msg.body}</p>
        {profile?.email && (
          <p className="mt-3 text-sm text-[#7a7a7a]">Signed in as {profile.email}</p>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            className="bg-[#0caa41] hover:bg-[#087d30]"
            onClick={() => signOut()}
          >
            Back to sign in
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">Home</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

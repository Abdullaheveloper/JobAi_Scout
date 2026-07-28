import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";

function JobSeekerRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRole="user">
      <RouteErrorBoundary>{children}</RouteErrorBoundary>
    </ProtectedRoute>
  );
}

/* ─── Lazy-loaded Pages (code-split per route) ──────────── */
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CVUpload = lazy(() => import("./pages/CVUpload"));
const JobBoard = lazy(() => import("./pages/JobBoard"));
const SavedJobs = lazy(() => import("./pages/SavedJobs"));
const Applications = lazy(() => import("./pages/Applications"));
const AutoFormFill = lazy(() => import("./pages/AutoFormFill"));
const Automation = lazy(() => import("./pages/Automation"));
const VoiceAssistant = lazy(() => import("./pages/VoiceAssistant"));
const VoiceAgent = lazy(() => import("./pages/VoiceAgent"));
const ProfileSettings = lazy(() => import("./pages/ProfileSettings"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminJobs = lazy(() => import("./pages/AdminJobs"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const AdminUsageLimits = lazy(() => import("./pages/AdminUsageLimits"));
const AdminVoice = lazy(() => import("./pages/AdminVoice"));
const WaitingApproval = lazy(() => import("./pages/WaitingApproval"));
const RecruiterJobs = lazy(() => import("./pages/recruiter/RecruiterJobs"));
const RecruiterCandidates = lazy(() => import("./pages/recruiter/RecruiterCandidates"));
const RecruiterProfile = lazy(() => import("./pages/recruiter/RecruiterProfile"));
const RecruiterApplicationStatus = lazy(() => import("./pages/recruiter/RecruiterApplicationStatus"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

/* ─── Page Loader (shown while chunk downloads) ─────────── */
const PageLoader = () => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground animate-pulse">{t("common.loading")}</p>
      </div>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
          <LocaleProvider>
          <CookieConsentBanner />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/waiting-approval" element={<WaitingApproval />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/privacy" element={<Privacy />} />
              {/* Job Seeker routes */}
              <Route path="/dashboard" element={<JobSeekerRoute><Dashboard /></JobSeekerRoute>} />
              <Route path="/dashboard/cv" element={<JobSeekerRoute><CVUpload /></JobSeekerRoute>} />
              <Route path="/dashboard/jobs" element={<JobSeekerRoute><JobBoard /></JobSeekerRoute>} />
              <Route path="/dashboard/automation" element={<JobSeekerRoute><Automation /></JobSeekerRoute>} />
              <Route path="/dashboard/saved" element={<JobSeekerRoute><SavedJobs /></JobSeekerRoute>} />
              <Route path="/dashboard/applications" element={<JobSeekerRoute><Applications /></JobSeekerRoute>} />
              <Route path="/dashboard/auto-fill" element={<JobSeekerRoute><AutoFormFill /></JobSeekerRoute>} />
              <Route path="/dashboard/assistant" element={<JobSeekerRoute><VoiceAssistant /></JobSeekerRoute>} />
              <Route path="/dashboard/voice-agent" element={<JobSeekerRoute><VoiceAgent /></JobSeekerRoute>} />
              <Route path="/dashboard/settings" element={<JobSeekerRoute><ProfileSettings /></JobSeekerRoute>} />
              <Route path="/dashboard/extension" element={<Navigate to="/dashboard/auto-fill" replace />} />
              {/* Recruiter routes */}
              <Route path="/recruiter" element={<Navigate to="/recruiter/jobs" replace />} />
              <Route path="/recruiter/profile" element={<ProtectedRoute requiredRole="recruiter"><RecruiterProfile /></ProtectedRoute>} />
              <Route path="/recruiter/jobs" element={<ProtectedRoute requiredRole="recruiter"><RecruiterJobs /></ProtectedRoute>} />
              <Route path="/recruiter/candidates" element={<ProtectedRoute requiredRole="recruiter"><RecruiterCandidates /></ProtectedRoute>} />
              <Route path="/recruiter/application-status" element={<ProtectedRoute requiredRole="recruiter"><RecruiterApplicationStatus /></ProtectedRoute>} />
              {/* Admin routes */}
              <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsers /></ProtectedRoute>} />
              <Route path="/admin/jobs" element={<ProtectedRoute requiredRole="admin"><AdminJobs /></ProtectedRoute>} />
              <Route path="/admin/analytics" element={<ProtectedRoute requiredRole="admin"><AdminAnalytics /></ProtectedRoute>} />
              <Route path="/admin/usage-limits" element={<ProtectedRoute requiredRole="admin"><AdminUsageLimits /></ProtectedRoute>} />
              <Route path="/admin/voice" element={<ProtectedRoute requiredRole="admin"><AdminVoice /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </LocaleProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

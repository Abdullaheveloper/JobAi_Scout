import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

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
const AdminVoice = lazy(() => import("./pages/AdminVoice"));
const RecruiterJobs = lazy(() => import("./pages/recruiter/RecruiterJobs"));
const RecruiterCandidates = lazy(() => import("./pages/recruiter/RecruiterCandidates"));
const RecruiterProfile = lazy(() => import("./pages/recruiter/RecruiterProfile"));
const RecruiterApplicationStatus = lazy(() => import("./pages/recruiter/RecruiterApplicationStatus"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

/* ─── Page Loader (shown while chunk downloads) ─────────── */
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#020817]">
    <div className="flex flex-col items-center gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      <p className="text-sm text-gray-500 animate-pulse">Loading…</p>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/privacy" element={<Privacy />} />
              {/* Job Seeker routes */}
              <Route path="/dashboard" element={<ProtectedRoute requiredRole="user"><Dashboard /></ProtectedRoute>} />
              <Route path="/dashboard/cv" element={<ProtectedRoute requiredRole="user"><CVUpload /></ProtectedRoute>} />
              <Route path="/dashboard/jobs" element={<ProtectedRoute requiredRole="user"><JobBoard /></ProtectedRoute>} />
              <Route path="/dashboard/automation" element={<ProtectedRoute requiredRole="user"><Automation /></ProtectedRoute>} />
              <Route path="/dashboard/saved" element={<ProtectedRoute requiredRole="user"><SavedJobs /></ProtectedRoute>} />
              <Route path="/dashboard/applications" element={<ProtectedRoute requiredRole="user"><Applications /></ProtectedRoute>} />
              <Route path="/dashboard/auto-fill" element={<ProtectedRoute requiredRole="user"><AutoFormFill /></ProtectedRoute>} />
              <Route path="/dashboard/assistant" element={<ProtectedRoute requiredRole="user"><VoiceAssistant /></ProtectedRoute>} />
              <Route path="/dashboard/voice-agent" element={<ProtectedRoute requiredRole="user"><VoiceAgent /></ProtectedRoute>} />
              <Route path="/dashboard/settings" element={<ProtectedRoute requiredRole="user"><ProfileSettings /></ProtectedRoute>} />
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
              <Route path="/admin/voice" element={<ProtectedRoute requiredRole="admin"><AdminVoice /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

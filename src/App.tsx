import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import CVUpload from "./pages/CVUpload";
import JobBoard from "./pages/JobBoard";
import SavedJobs from "./pages/SavedJobs";
import Applications from "./pages/Applications";
import Analytics from "./pages/Analytics";
import AdminDashboard from "./pages/AdminDashboard";
import VoiceAssistant from "./pages/VoiceAssistant";
import AdminUsers from "./pages/AdminUsers";
import AdminJobs from "./pages/AdminJobs";
import AdminAnalytics from "./pages/AdminAnalytics";
import ProfileSettings from "./pages/ProfileSettings";
import Extension from "./pages/Extension";
import RecruiterJobs from "./pages/recruiter/RecruiterJobs";
import RecruiterCandidates from "./pages/recruiter/RecruiterCandidates";
import NotFound from "./pages/NotFound";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Privacy from "./pages/Privacy";
import AdminVoice from "./pages/AdminVoice";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/cv" element={<ProtectedRoute><CVUpload /></ProtectedRoute>} />
            <Route path="/dashboard/jobs" element={<ProtectedRoute><JobBoard /></ProtectedRoute>} />
            <Route path="/dashboard/saved" element={<ProtectedRoute><SavedJobs /></ProtectedRoute>} />
            <Route path="/dashboard/applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
            <Route path="/dashboard/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/dashboard/assistant" element={<ProtectedRoute><VoiceAssistant /></ProtectedRoute>} />
            <Route path="/dashboard/settings" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />
            <Route path="/dashboard/extension" element={<ProtectedRoute><Extension /></ProtectedRoute>} />
            {/* Recruiter routes */}
            <Route path="/recruiter" element={<Navigate to="/recruiter/jobs" replace />} />
            <Route path="/recruiter/jobs" element={<ProtectedRoute requiredRole="recruiter"><RecruiterJobs /></ProtectedRoute>} />
            <Route path="/recruiter/candidates" element={<ProtectedRoute requiredRole="recruiter"><RecruiterCandidates /></ProtectedRoute>} />
            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/jobs" element={<ProtectedRoute requiredRole="admin"><AdminJobs /></ProtectedRoute>} />
            <Route path="/admin/analytics" element={<ProtectedRoute requiredRole="admin"><AdminAnalytics /></ProtectedRoute>} />
            <Route path="/admin/voice" element={<ProtectedRoute requiredRole="admin"><AdminVoice /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

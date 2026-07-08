import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle, AlertCircle, Sparkles, Shield, Users, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { lazy, Suspense } from "react";
const ParticleSystem3D = lazy(() => import("@/components/3d/ParticleSystem3D"));

const highlights = [
  { icon: TrendingUp, text: "94% AI Match Accuracy", sub: "Industry-leading precision" },
  { icon: Users, text: "10,000+ Job Seekers", sub: "Trusted globally" },
  { icon: Shield, text: "SOC 2 Compliant", sub: "Enterprise-grade security" },
];

function InputField({
  id, label, type = "text", placeholder, value, onChange, icon: Icon,
  required = false, error, success, rightElement, autoComplete,
}: {
  id: string; label: string; type?: string; placeholder: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: any; required?: boolean; error?: string; success?: string;
  rightElement?: React.ReactNode; autoComplete?: string;
}) {
  return (
    <div className="input-wrapper space-y-1.5">
      <label htmlFor={id} className="input-label">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none z-10" />
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          autoComplete={autoComplete}
          className={`input-premium w-full pl-10 ${rightElement ? "pr-12" : "pr-4"} py-3 ${error ? "input-error" : success ? "input-success" : ""}`}
          style={{ color: "#f1f5f9", caretColor: "#a5b4fc" }}
        />
        {rightElement && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{rightElement}</div>
        )}
      </div>
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="field-error"
          >
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {error}
          </motion.div>
        )}
        {success && !error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="field-success"
          >
            <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {success}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const validateEmail = (val: string) => {
    if (!val) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "Please enter a valid email";
    return "";
  };

  const validatePassword = (val: string) => {
    if (!val) return "Password is required";
    if (val.length < 6) return "Password must be at least 6 characters";
    return "";
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setEmailError(eErr);
    setPasswordError(pErr);
    if (eErr || pErr) return;

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("password")) {
        setPasswordError("Incorrect password. Please try again.");
      } else if (error.message.toLowerCase().includes("email")) {
        setEmailError("No account found with this email.");
      } else {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      }
    } else {
      navigate("/dashboard");
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Google login failed", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex min-h-screen bg-[#020817] text-white">

      {/* ── Left Panel ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        {/* 3D BG */}
        <div className="absolute inset-0">
          <Suspense fallback={null}>
            <ParticleSystem3D particleCount={500} />
          </Suspense>
        </div>
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#020817]/70 via-[#0a0f2e]/50 to-indigo-950/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020817]/80 via-transparent to-transparent" />

        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-indigo-600/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
        <div className="absolute bottom-1/3 right-1/4 w-56 h-56 bg-violet-600/12 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-lg shadow-indigo-500/40">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              JobAI <span className="text-gradient">Scout</span>
            </span>
          </Link>

          {/* Hero Text */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-md"
          >
            <span className="badge-premium mb-5 inline-flex">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              AI Career Intelligence
            </span>
            <h1 className="text-4xl font-bold text-white mb-4 leading-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
              Your next great<br />
              <span className="text-gradient">opportunity awaits</span>
            </h1>
            <p className="text-gray-400 text-base leading-relaxed mb-8">
              Upload your CV once and let our AI match you to jobs that perfectly align with your skills, experience, and career goals.
            </p>

            <div className="space-y-3">
              {highlights.map(({ icon: Icon, text, sub }) => (
                <motion.div
                  key={text}
                  className="flex items-center gap-3 glass-card-sm px-4 py-3 rounded-xl"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary flex-shrink-0">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{text}</p>
                    <p className="text-xs text-gray-500">{sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Bottom */}
          <p className="text-xs text-gray-600">
            © 2026 JobAI Scout · Built at IIU Islamabad
          </p>
        </div>
      </div>

      {/* ── Right Panel ────────────────────────────────────────── */}
      <div className="flex w-full lg:w-[45%] items-center justify-center p-6 lg:p-12 relative">
        {/* Background */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #060d24 0%, #020817 60%, #030b1f 100%)" }} />
        <div className="absolute inset-0 dot-bg opacity-15" />
        {/* Edge glow */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-3/4 bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent hidden lg:block" />

        <motion.div
          className="w-full max-w-[420px] relative z-10"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Mobile logo */}
          <Link to="/" className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl" style={{ fontFamily: 'Syne, sans-serif' }}>JobAI Scout</span>
          </Link>

          <div className="auth-card p-8">
            {/* Header */}
            <div className="mb-8">
              <div className="hidden lg:flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary shadow-xl shadow-indigo-500/30 mb-5">
                <Lock className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-1.5" style={{ fontFamily: 'Syne, sans-serif' }}>
                Welcome back
              </h2>
              <p className="text-gray-500 text-sm">
                Sign in to continue your AI-powered job search.
              </p>
            </div>

            {/* Google Sign-In */}
            <motion.button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-white/10 text-gray-300 hover:text-white text-sm font-medium transition-all mb-6 disabled:opacity-50 group"
              style={{ background: "rgba(255,255,255,0.04)" }}
              whileHover={{ background: "rgba(255,255,255,0.07)", borderColor: "rgba(99,102,241,0.3)", y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin" />
              ) : (
                <svg className="h-4.5 w-4.5 flex-shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              Continue with Google
            </motion.button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08))" }} />
              <span className="text-xs text-gray-600 font-medium">or sign in with email</span>
              <div className="h-px flex-1" style={{ background: "linear-gradient(270deg, transparent, rgba(255,255,255,0.08))" }} />
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              <InputField
                id="login-email"
                label="Email address"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
                icon={Mail}
                required
                error={emailError}
                autoComplete="email"
              />

              <InputField
                id="login-password"
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(""); }}
                icon={Lock}
                required
                error={passwordError}
                autoComplete="current-password"
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-500 hover:text-gray-300 transition-colors p-0.5 rounded"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword
                      ? <EyeOff className="h-4 w-4" />
                      : <Eye className="h-4 w-4" />
                    }
                  </button>
                }
              />

              <div className="flex justify-end -mt-1">
                <Link
                  to="/forgot-password"
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
                >
                  Forgot password?
                </Link>
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                className="w-full btn-premium py-3.5 text-sm font-semibold flex items-center justify-center gap-2 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                whileHover={{ scale: loading ? 1 : 1.02, y: loading ? 0 : -1 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in to your account
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Footer link */}
            <p className="text-center text-sm text-gray-600 mt-6">
              New to JobAI Scout?{" "}
              <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                Create a free account
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-gray-700 mt-5 px-4">
            By continuing, you agree to our{" "}
            <Link to="/privacy" className="text-gray-500 hover:text-gray-400 underline underline-offset-2">Privacy Policy</Link>
            {" "}and{" "}
            <span className="text-gray-500">Terms of Service</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

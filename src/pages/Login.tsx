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
          style={{ color: "#f1f5f9", caretColor: "#6ee7b7" }}
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

  return (
    <div className="flex min-h-screen bg-[#020a08] text-white relative overflow-hidden">
      {/* Global Particle Background — visible on desktop and mobile behind form */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <Suspense fallback={null}>
          <ParticleSystem3D particleCount={500} />
        </Suspense>
      </div>

      {/* ── Left Panel ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden z-10">
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#020a08]/60 via-[#03140e]/40 to-emerald-950/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020a08]/80 via-transparent to-transparent" />

        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-emerald-600/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
        <div className="absolute bottom-1/3 right-1/4 w-56 h-56 bg-teal-600/12 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-lg shadow-emerald-500/40">
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
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
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
      <div className="flex w-full lg:w-[45%] items-center justify-center p-6 lg:p-12 relative z-10">
        {/* Background Overlay */}
        <div className="absolute inset-0 bg-[#020a08]/40 lg:bg-[#020a08]/10 pointer-events-none" />
        {/* Edge glow */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-3/4 bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent hidden lg:block" />

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
              <div className="hidden lg:flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary shadow-xl shadow-emerald-500/30 mb-5">
                <Lock className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-1.5" style={{ fontFamily: 'Syne, sans-serif' }}>
                Welcome back
              </h2>
              <p className="text-gray-500 text-sm">
                Sign in to continue your AI-powered job search.
              </p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08))" }} />
              <span className="text-xs text-gray-600 font-medium">sign in with email</span>
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

              <div className="flex items-center justify-between -mt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-white/10 bg-white/5 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 focus:ring-0"
                    style={{ accentColor: "#10b981" }}
                  />
                  <span className="text-xs text-gray-400">Remember me</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
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
              <Link to="/register" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
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

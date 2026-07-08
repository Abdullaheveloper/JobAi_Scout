import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Briefcase, Mail, Lock, User, Building2, Eye, EyeOff, ArrowRight,
  CheckCircle, AlertCircle, Sparkles, Shield, Zap, Brain, Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { lazy, Suspense } from "react";
const InteractiveHero3D = lazy(() => import("@/components/3d/InteractiveHero3D"));

/* ─── Reusable Input Component ─────────────────────────── */
function InputField({
  id, label, type = "text", placeholder, value, onChange, icon: Icon,
  required = false, error, rightElement, autoComplete, minLength,
}: {
  id: string; label: string; type?: string; placeholder: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: any; required?: boolean; error?: string;
  rightElement?: React.ReactNode; autoComplete?: string; minLength?: number;
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
          minLength={minLength}
          className={`input-premium w-full pl-10 ${rightElement ? "pr-12" : "pr-4"} py-3 ${error ? "input-error" : ""}`}
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
      </AnimatePresence>
    </div>
  );
}

/* ─── Password Strength Meter ──────────────────────────── */
function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "At least 8 characters", pass: password.length >= 8 },
    { label: "Uppercase letter", pass: /[A-Z]/.test(password) },
    { label: "Number", pass: /[0-9]/.test(password) },
  ];
  const strength = checks.filter((c) => c.pass).length;
  const colors = ["bg-rose-500", "bg-amber-500", "bg-emerald-500"];
  const labels = ["Weak", "Fair", "Strong"];

  if (!password) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-2 mt-2"
    >
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-500 ${i < strength ? colors[strength - 1] : "bg-white/10"}`}
          />
        ))}
      </div>
      {strength > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            {checks.map((c) => (
              <span key={c.label} className={`flex items-center gap-1 text-xs transition-colors ${c.pass ? "text-emerald-400" : "text-gray-600"}`}>
                <Check className={`h-3 w-3 ${c.pass ? "text-emerald-400" : "text-gray-700"}`} />
                {c.label}
              </span>
            ))}
          </div>
          <span className={`text-xs font-medium ${strength === 3 ? "text-emerald-400" : strength === 2 ? "text-amber-400" : "text-rose-400"}`}>
            {labels[strength - 1]}
          </span>
        </div>
      )}
    </motion.div>
  );
}

const roleOptions = [
  {
    value: "user" as const,
    label: "Job Seeker",
    icon: User,
    desc: "Find your dream job with AI",
    perks: ["AI CV Parsing", "Smart Job Matching", "Voice Assistant"],
    gradient: "from-indigo-500 to-violet-600",
  },
  {
    value: "recruiter" as const,
    label: "Recruiter",
    icon: Building2,
    desc: "Hire top talent faster",
    perks: ["Post Unlimited Jobs", "AI Candidate Ranking", "Pipeline CRM"],
    gradient: "from-cyan-500 to-blue-600",
  },
];

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"user" | "recruiter">("user");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = "Full name is required";
    if (!email) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Invalid email address";
    if (!password) errs.password = "Password is required";
    else if (password.length < 6) errs.password = "Password must be at least 6 characters";
    if (role === "recruiter" && !companyName.trim()) errs.companyName = "Company name is required";
    return errs;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    const metadata: Record<string, string> = { full_name: fullName.trim(), role };
    if (role === "recruiter") metadata.company_name = companyName.trim();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata, emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("email")) {
        setErrors((prev) => ({ ...prev, email: "This email is already registered." }));
      } else {
        toast({ title: "Registration failed", description: error.message, variant: "destructive" });
      }
    } else {
      toast({
        title: "Account created! 🎉",
        description: "Check your email to confirm your account, then sign in.",
      });
      navigate("/login");
    }
  };

  const handleGoogleRegister = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Google signup failed", description: error.message, variant: "destructive" });
    }
  };

  const clearError = (field: string) => {
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  const selectedRole = roleOptions.find((r) => r.value === role)!;

  return (
    <div className="flex min-h-screen bg-[#020817] text-white">

      {/* ── Left Panel — 3D Hero ─────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[50%] relative overflow-hidden">
        <div className="absolute inset-0">
          <Suspense fallback={null}>
            <InteractiveHero3D />
          </Suspense>
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-[#020817]/75 via-[#0a0f2e]/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020817]/80 via-transparent to-transparent" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-lg">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              JobAI <span className="text-gradient">Scout</span>
            </span>
          </Link>

          {/* Dynamic role-based content */}
          <motion.div
            key={role}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-md"
          >
            <span className="badge-premium mb-5 inline-flex">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              {role === "recruiter" ? "Recruiter Platform" : "For Job Seekers"}
            </span>
            <h1 className="text-4xl font-bold text-white mb-4 leading-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
              {role === "recruiter" ? (
                <>Find top talent<br /><span className="text-gradient">10x faster</span></>
              ) : (
                <>Land your dream job<br /><span className="text-gradient">with AI precision</span></>
              )}
            </h1>
            <p className="text-gray-400 text-base leading-relaxed mb-8">
              {role === "recruiter"
                ? "Post jobs, get AI-ranked candidates, and manage your entire hiring pipeline from one powerful dashboard."
                : "Upload your CV, get instant skill extraction, and discover opportunities perfectly matched to your expertise."}
            </p>

            <div className="space-y-3">
              {selectedRole.perks.map((perk, i) => (
                <motion.div
                  key={perk}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3 glass-card-sm px-4 py-3 rounded-xl"
                >
                  <div className={`flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br ${selectedRole.gradient} flex-shrink-0`}>
                    <Check className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-sm text-gray-300">{perk}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <p className="text-xs text-gray-600">© 2026 JobAI Scout · Built at IIU Islamabad</p>
        </div>
      </div>

      {/* ── Right Panel — Form ────────────────────────────────── */}
      <div className="flex w-full lg:w-[50%] items-start justify-center p-6 lg:p-10 relative overflow-y-auto">
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #060d24 0%, #020817 60%, #030b1f 100%)" }} />
        <div className="absolute inset-0 dot-bg opacity-15" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-3/4 bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent hidden lg:block" />

        <motion.div
          className="w-full max-w-[420px] relative z-10 py-8"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
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
            <div className="mb-7">
              <div className="hidden lg:flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary shadow-xl shadow-indigo-500/30 mb-5">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-1.5" style={{ fontFamily: 'Syne, sans-serif' }}>
                Create your account
              </h2>
              <p className="text-gray-500 text-sm">Free forever. No credit card required.</p>
            </div>

            {/* Role Selector */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {roleOptions.map(({ value, label, icon: Icon, desc, gradient }) => {
                const active = role === value;
                return (
                  <motion.button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    className="relative flex flex-col items-start gap-2 rounded-xl p-4 border-2 transition-all text-left"
                    style={{
                      borderColor: active ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.08)",
                      background: active ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.03)",
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {active && (
                      <div className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-indigo-400" />
                    )}
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${gradient}`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${active ? "text-white" : "text-gray-400"}`}>{label}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{desc}</p>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Google */}
            <motion.button
              onClick={handleGoogleRegister}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-white/10 text-gray-300 hover:text-white text-sm font-medium transition-all mb-5 disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.04)" }}
              whileHover={{ background: "rgba(255,255,255,0.07)", borderColor: "rgba(99,102,241,0.3)", y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Sign up with Google
            </motion.button>

            <div className="flex items-center gap-3 mb-5">
              <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08))" }} />
              <span className="text-xs text-gray-600 font-medium">or register with email</span>
              <div className="h-px flex-1" style={{ background: "linear-gradient(270deg, transparent, rgba(255,255,255,0.08))" }} />
            </div>

            {/* Form */}
            <form onSubmit={handleRegister} className="space-y-4" noValidate>
              <InputField
                id="reg-name"
                label="Full Name"
                placeholder="Abdullah Waheed"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); clearError("fullName"); }}
                icon={User}
                required
                error={errors.fullName}
                autoComplete="name"
              />

              <AnimatePresence>
                {role === "recruiter" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <InputField
                      id="reg-company"
                      label="Company Name"
                      placeholder="Acme Corp"
                      value={companyName}
                      onChange={(e) => { setCompanyName(e.target.value); clearError("companyName"); }}
                      icon={Building2}
                      required
                      error={errors.companyName}
                      autoComplete="organization"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <InputField
                id="reg-email"
                label="Work Email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
                icon={Mail}
                required
                error={errors.email}
                autoComplete="email"
              />

              <div className="space-y-1.5">
                <InputField
                  id="reg-password"
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
                  icon={Lock}
                  required
                  minLength={6}
                  error={errors.password}
                  autoComplete="new-password"
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
                <AnimatePresence>
                  {password && <PasswordStrength password={password} />}
                </AnimatePresence>
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
                    Creating account…
                  </>
                ) : (
                  <>
                    Create {role === "recruiter" ? "Recruiter" : "Free"} Account
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </motion.button>
            </form>

            <p className="text-center text-sm text-gray-600 mt-6">
              Already have an account?{" "}
              <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                Sign in
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-gray-700 mt-5 px-4">
            By registering, you agree to our{" "}
            <Link to="/privacy" className="text-gray-500 hover:text-gray-400 underline underline-offset-2">Privacy Policy</Link>
            {" "}and{" "}
            <span className="text-gray-500">Terms of Service</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

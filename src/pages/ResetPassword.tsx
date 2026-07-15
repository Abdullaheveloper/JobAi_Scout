import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Lock, Eye, EyeOff, ArrowRight, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { lazy, Suspense } from "react";
const ParticleSystem3D = lazy(() => import("@/components/3d/ParticleSystem3D"));

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Handle the PKCE flow: Supabase redirects with tokens in hash or search params
    const handleAuth = async () => {
      const hash = window.location.hash;
      const search = window.location.search;

      // Check for error in URL
      const urlParams = new URLSearchParams(search);
      const hashParams = new URLSearchParams(hash.substring(1));
      const errorDesc = urlParams.get("error_description") || hashParams.get("error_description");
      if (errorDesc) {
        setError(errorDesc);
        return;
      }

      // Check for recovery tokens in hash (PKCE flow)
      if (hash && hash.includes("access_token")) {
        // Supabase has already set the session via the hash fragment
        // The onAuthStateChange listener will pick it up
        return;
      }

      // Check for type=recovery in hash
      if (hash && hash.includes("type=recovery")) {
        return;
      }

      // Check for code in search params (PKCE authorization code flow)
      const code = urlParams.get("code");
      if (code) {
        // Exchange the code for a session
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setError(error.message);
        }
        return;
      }
    };

    handleAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && !ready)) {
        setReady(true);
      }
    });

    // Also check hash immediately
    const hash = window.location.hash;
    if (hash && (hash.includes("type=recovery") || hash.includes("access_token"))) {
      setReady(true);
    }

    // Check search params for code
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("code")) {
      setReady(true);
    }

    // Fallback: if nothing happens in 3 seconds, show the form anyway
    // (the session might already be established from a previous step)
    const fallback = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setReady(true);
        }
      });
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setConfirmError("");

    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setConfirmError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({ title: "Error resetting password", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated successfully!", description: "Please sign in with your new password." });
      navigate("/login");
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020817] text-white p-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none z-0">
          <Suspense fallback={null}>
            <ParticleSystem3D particleCount={300} />
          </Suspense>
        </div>
        <motion.div
          className="w-full max-w-[420px] relative z-10"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="auth-card p-8 text-center space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400 mx-auto">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
              Reset link invalid
            </h2>
            <p className="text-gray-400 text-sm">{error}</p>
            <a
              href="/forgot-password"
              className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
            >
              Request a new reset link
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020817] text-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none z-0">
          <Suspense fallback={null}>
            <ParticleSystem3D particleCount={300} />
          </Suspense>
        </div>
        <div className="text-center space-y-4 relative z-10">
          <div className="h-10 w-10 mx-auto animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-gray-400 text-sm animate-pulse">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020817] text-white p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none z-0">
        <Suspense fallback={null}>
          <ParticleSystem3D particleCount={400} />
        </Suspense>
      </div>

      <div className="absolute inset-0 bg-gradient-to-br from-[#020817]/70 via-transparent to-indigo-950/20 pointer-events-none" />

      <motion.div
        className="w-full max-w-[420px] relative z-10"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-lg shadow-indigo-500/40">
            <Briefcase className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            JobAI <span className="text-gradient">Scout</span>
          </span>
        </div>

        <div className="auth-card p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary shadow-xl shadow-indigo-500/30">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
              Set New Password
            </h2>
            <p className="text-gray-400 text-sm">
              Please enter your new password below.
            </p>
          </div>

          <form onSubmit={handleUpdate} className="space-y-4" noValidate>
            <div className="input-wrapper space-y-1.5">
              <label htmlFor="new-password" className="input-label">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none z-10" />
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(""); }}
                  required
                  minLength={6}
                  className={`input-premium w-full pl-10 pr-12 py-3 ${passwordError ? "input-error" : ""}`}
                  style={{ color: "#f1f5f9", caretColor: "#a5b4fc" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-0.5 rounded"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="field-error"
                >
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {passwordError}
                </motion.div>
              )}
            </div>

            <div className="input-wrapper space-y-1.5">
              <label htmlFor="confirm-password" className="input-label">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none z-10" />
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); if (confirmError) setConfirmError(""); }}
                  required
                  className={`input-premium w-full pl-10 pr-12 py-3 ${confirmError ? "input-error" : ""}`}
                  style={{ color: "#f1f5f9", caretColor: "#a5b4fc" }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-0.5 rounded"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="field-error"
                >
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {confirmError}
                </motion.div>
              )}
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              className="w-full btn-premium py-3.5 text-sm font-semibold flex items-center justify-center gap-2 mt-4 disabled:opacity-60 disabled:cursor-not-allowed"
              whileHover={{ scale: loading ? 1 : 1.02, y: loading ? 0 : -1 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Updating password…
                </>
              ) : (
                <>
                  Update password
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

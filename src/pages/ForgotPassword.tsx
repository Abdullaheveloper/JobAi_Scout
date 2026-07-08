import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Mail, ArrowLeft, ArrowRight, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { lazy, Suspense } from "react";
const ParticleSystem3D = lazy(() => import("@/components/3d/ParticleSystem3D"));

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const { toast } = useToast();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg("Email address is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setErrorMsg("");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setErrorMsg(error.message);
      toast({ title: "Error sending link", description: error.message, variant: "destructive" });
    } else {
      setSent(true);
      toast({ title: "Reset Link Sent", description: "Please check your inbox for the password reset instructions." });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020817] text-white p-6 relative overflow-hidden">
      {/* Global Particle Background */}
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
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-lg shadow-indigo-500/40">
            <Briefcase className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            JobAI <span className="text-gradient">Scout</span>
          </span>
        </Link>

        <div className="auth-card p-8">
          {/* Header */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary shadow-xl shadow-indigo-500/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
              Reset Password
            </h2>
            <p className="text-gray-400 text-sm">
              {sent
                ? "Check your inbox for a secure recovery link."
                : "Enter your email address and we'll send you a password reset link."}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {!sent ? (
              <motion.form
                key="form"
                onSubmit={handleReset}
                className="space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                noValidate
              >
                <div className="input-wrapper space-y-1.5">
                  <label htmlFor="reset-email" className="input-label">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none z-10" />
                    <input
                      id="reset-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (errorMsg) setErrorMsg(""); }}
                      required
                      className={`input-premium w-full pl-10 pr-4 py-3 ${errorMsg ? "input-error" : ""}`}
                      style={{ color: "#f1f5f9", caretColor: "#a5b4fc" }}
                    />
                  </div>
                  {errorMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="field-error"
                    >
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                      {errorMsg}
                    </motion.div>
                  )}
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
                      Sending link…
                    </>
                  ) : (
                    <>
                      Send recovery link
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </motion.button>
              </motion.form>
            ) : (
              <motion.div
                key="success"
                className="text-center space-y-5 py-4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="flex justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-300">
                    We sent a secure link to <strong className="text-white">{email}</strong>.
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Click the link in the email to set a new password. If you don't receive it in a few minutes, check your spam folder.
                  </p>
                </div>
                <motion.button
                  onClick={() => setSent(false)}
                  className="w-full btn-outline-premium py-3"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Resend recovery email
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Back link */}
          <div className="mt-8 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

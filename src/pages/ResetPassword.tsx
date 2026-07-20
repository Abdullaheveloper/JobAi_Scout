import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Briefcase, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { JobAILogo } from "@/components/brand/JobAILogo";
import { supabase } from "@/integrations/supabase/client";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const fail = (message: string) => active && setError(message);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY" && active) setReady(true); });
    const verify = async () => {
      const search = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const problem = search.get("error_description") || hash.get("error_description");
      if (problem) return fail(problem.replace(/\+/g, " "));
      const code = search.get("code");
      if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError || !data.session) return fail(exchangeError?.message || "This reset link is no longer valid.");
        if (active) setReady(true);
        return;
      }
      if (hash.get("type") !== "recovery") return fail("This password reset link is missing or invalid. Please request a new one.");
      const { data } = await supabase.auth.getSession();
      if (data.session && active) setReady(true);
    };
    verify();
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    if (password !== confirmPassword) return setError("The passwords do not match.");
    setError(""); setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) return setError(updateError.message);
    await supabase.auth.signOut();
    setComplete(true);
  };

  return <main className="min-h-screen bg-[#f6f6f2] text-[#1c1c1c]">
    <header className="border-b border-black/10 bg-white"><div className="mx-auto flex h-16 max-w-6xl items-center px-5 sm:px-8"><Link to="/" aria-label="JobAI Scout home"><JobAILogo markClassName="h-9 w-9" /></Link></div></header>
    <section className="mx-auto flex max-w-6xl justify-center px-5 py-12 sm:py-20"><div className="w-full max-w-[440px] rounded-xl border border-black/15 bg-white p-6 shadow-[0_3px_12px_rgba(0,0,0,0.1)] sm:p-8">
      {error && !ready ? <InvalidLink message={error} /> : complete ? <div className="text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#d9f7e5] text-[#087332]"><CheckCircle2 className="h-6 w-6" /></div><h1 className="mt-5 text-2xl font-bold">Password updated</h1><p className="mt-3 text-sm leading-6 text-[#5c5c5c]">Your password has been changed. You can now sign in securely.</p><button onClick={() => navigate("/login", { replace: true })} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0caa41] text-sm font-bold text-white hover:bg-[#087d30]">Continue to sign in <ArrowRight className="h-4 w-4" /></button></div> : !ready ? <div className="py-10 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#0caa41] border-t-transparent" /><p className="mt-4 text-sm text-[#5c5c5c]">Verifying your reset link...</p></div> : <><Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#087332] hover:underline"><ArrowLeft className="h-4 w-4" /> Back to sign in</Link><h1 className="mt-7 text-2xl font-bold tracking-tight">Set a new password</h1><p className="mt-2 text-sm leading-6 text-[#5c5c5c]">Choose a secure password with at least 8 characters.</p>{error && <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}<form onSubmit={submit} className="mt-6 space-y-5"><PasswordField label="New password" value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((v) => !v)} placeholder="At least 8 characters" /><PasswordField label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} visible={showConfirm} onToggle={() => setShowConfirm((v) => !v)} placeholder="Re-enter your password" /><button disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0caa41] text-sm font-bold text-white hover:bg-[#087d30] disabled:opacity-60">{loading ? "Updating password..." : <>Update password <ArrowRight className="h-4 w-4" /></>}</button></form></>}
    </div></section>
  </main>;
}

function PasswordField({ label, value, onChange, visible, onToggle, placeholder }: { label: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void; placeholder: string }) {
  return <label className="block text-sm font-semibold">{label}<span className="relative mt-2 block"><Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" /><input className="auth-light-input pr-10" type={visible ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="new-password" /><button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#1c1c1c]" aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>;
}

function InvalidLink({ message }: { message: string }) {
  return <div className="text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-700"><Lock className="h-5 w-5" /></div><h1 className="mt-5 text-2xl font-bold">This link can’t be used</h1><p className="mt-3 text-sm leading-6 text-[#5c5c5c]">{message}</p><Link to="/forgot-password" className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-md bg-[#0caa41] text-sm font-bold text-white hover:bg-[#087d30]">Request a new link</Link></div>;
}

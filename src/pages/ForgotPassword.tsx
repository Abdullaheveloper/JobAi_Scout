import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Briefcase, CheckCircle2, Mail } from "lucide-react";
import { JobAILogo } from "@/components/brand/JobAILogo";
import { supabase } from "@/integrations/supabase/client";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!emailPattern.test(email.trim())) return setError("Enter a valid email address.");
    setError(""); setLoading(true);
    const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    if (requestError) return setError(requestError.message);
    setSent(true);
  };

  return <main className="min-h-screen bg-[#f6f6f2] text-[#1c1c1c]">
    <header className="border-b border-black/10 bg-white"><div className="mx-auto flex h-16 max-w-6xl items-center px-5 sm:px-8"><Link to="/" aria-label="JobAI Scout home"><JobAILogo markClassName="h-9 w-9" /></Link></div></header>
    <section className="mx-auto flex max-w-6xl justify-center px-5 py-12 sm:py-20">
      <div className="w-full max-w-[440px] rounded-xl border border-black/15 bg-white p-6 shadow-[0_3px_12px_rgba(0,0,0,0.1)] sm:p-8">
        {!sent ? <><Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#087332] hover:underline"><ArrowLeft className="h-4 w-4" /> Back to sign in</Link><h1 className="mt-7 text-2xl font-bold tracking-tight">Forgot your password?</h1><p className="mt-2 text-sm leading-6 text-[#5c5c5c]">Enter the email address you use to sign in. We’ll send a secure link to reset your password.</p>{error && <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}<form onSubmit={submit} className="mt-6"><label className="block text-sm font-semibold">Email address<span className="relative mt-2 block"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" /><input className="auth-light-input" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="name@example.com" autoComplete="email" /></span></label><button disabled={loading} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0caa41] text-sm font-bold text-white transition hover:bg-[#087d30] disabled:opacity-60">{loading ? "Sending link..." : <>Email reset link <ArrowRight className="h-4 w-4" /></>}</button></form></> : <div className="text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#d9f7e5] text-[#087332]"><CheckCircle2 className="h-6 w-6" /></div><h1 className="mt-5 text-2xl font-bold tracking-tight">Check your inbox</h1><p className="mt-3 text-sm leading-6 text-[#5c5c5c]">If an account exists for <strong className="text-[#1c1c1c]">{email}</strong>, we sent a secure password-reset link. Check your spam folder too.</p><button onClick={() => setSent(false)} className="mt-6 text-sm font-semibold text-[#087332] hover:underline">Use a different email</button><div className="mt-6 border-t border-black/10 pt-5"><Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#087332] hover:underline"><ArrowLeft className="h-4 w-4" /> Back to sign in</Link></div></div>}
      </div>
    </section>
  </main>;
}

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Building2, Globe, Loader2, Save } from "lucide-react";

export default function RecruiterProfile() {
  const { user, recruiterProfile } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ company_name: "", website: "", industry: "", description: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (recruiterProfile) setForm({ company_name: recruiterProfile.company_name || "", website: recruiterProfile.website || "", industry: recruiterProfile.industry || "", description: recruiterProfile.description || "" });
  }, [recruiterProfile]);

  const save = async () => {
    if (!user || !form.company_name.trim()) return toast({ title: "Company name is required", variant: "destructive" });
    setSaving(true);
    const payload = { user_id: user.id, company_name: form.company_name.trim(), website: form.website.trim() || null, industry: form.industry.trim() || null, description: form.description.trim() || null };
    const { error } = await supabase.from("recruiter_profiles").upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast({ title: "Profile was not saved", description: error.message, variant: "destructive" });
    toast({ title: "Company profile saved", description: "Your company details will be used for new job postings." });
  };

  return <DashboardLayout><div className="mx-auto max-w-3xl space-y-6"><section className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8"><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Recruiter workspace</p><h1 className="mt-2 font-display text-3xl font-bold">Company profile</h1><p className="mt-1 text-muted-foreground">These details appear with jobs you post on JobAI Scout.</p></section><Card className="border-border bg-card shadow-card"><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Company details</CardTitle><CardDescription>Keep this short and accurate for candidates.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="space-y-2"><Label>Company name *</Label><Input value={form.company_name} onChange={event => setForm(current => ({ ...current, company_name: event.target.value }))} placeholder="Your company" /></div><div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label>Website</Label><div className="relative"><Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={form.website} onChange={event => setForm(current => ({ ...current, website: event.target.value }))} placeholder="https://company.com" /></div></div><div className="space-y-2"><Label>Industry</Label><Input value={form.industry} onChange={event => setForm(current => ({ ...current, industry: event.target.value }))} placeholder="Technology, Finance…" /></div></div><div className="space-y-2"><Label>About your company</Label><Textarea value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="A short description candidates will see with your postings." rows={5} /></div><Button onClick={() => void save()} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save company profile"}</Button></CardContent></Card></div></DashboardLayout>;
}

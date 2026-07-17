import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BriefcaseBusiness, ChevronDown, Clock3, FileText, Loader2, LockKeyhole, Mail, MessageSquarePlus, UserRound } from "lucide-react";

type PipelineStatus = "new" | "shortlisted" | "rejected" | "hired";
const statusLabel: Record<PipelineStatus, string> = { new: "New", shortlisted: "Shortlisted", rejected: "Rejected", hired: "Hired" };
const statusStyle: Record<PipelineStatus, string> = {
  new: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  shortlisted: "border-violet-500/25 bg-violet-500/10 text-violet-300",
  rejected: "border-rose-500/25 bg-rose-500/10 text-rose-300",
  hired: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
};

export default function RecruiterCandidates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [applications, setApplications] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, any[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadApplications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("job_applications")
      .select("id, user_id, job_id, status, applied_at, jobs!inner(title, company, recruiter_id)")
      .order("applied_at", { ascending: false });
    if (error) {
      toast({ title: "Could not load applicants", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const owned = (data || []).filter((application: any) => application.jobs?.recruiter_id === user.id);
    const candidateIds = [...new Set(owned.map((application: any) => application.user_id))];
    if (candidateIds.length) {
      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, skills, experience_years, location, resume_url")
        .in("user_id", candidateIds);
      if (profilesError) {
        toast({ title: "Could not load candidate details", description: profilesError.message, variant: "destructive" });
      }
      const profilesByUser = new Map((profileRows || []).map((profile: any) => [profile.user_id, profile]));
      setApplications(owned.map((application: any) => ({ ...application, profiles: profilesByUser.get(application.user_id) || null })));
    } else {
      setApplications([]);
    }
    if (candidateIds.length) {
      const { data: noteRows } = await supabase.from("candidate_notes").select("id, candidate_id, job_id, note_text, created_at").eq("recruiter_id", user.id).eq("is_private", true).in("candidate_id", candidateIds).order("created_at", { ascending: false });
      const grouped: Record<string, any[]> = {};
      (noteRows || []).forEach((note: any) => {
        const key = `${note.candidate_id}:${note.job_id || ""}`;
        (grouped[key] ||= []).push(note);
      });
      setNotes(grouped);
    } else setNotes({});
    setLoading(false);
  }, [toast, user]);

  useEffect(() => { void loadApplications(); }, [loadApplications]);

  const updateStatus = async (application: any, status: PipelineStatus) => {
    setSavingId(application.id);
    const { error } = await supabase.from("job_applications").update({ status }).eq("id", application.id);
    setSavingId(null);
    if (error) return toast({ title: "Status was not updated", description: error.message, variant: "destructive" });
    setApplications(current => current.map(item => item.id === application.id ? { ...item, status } : item));
    toast({ title: `Moved to ${statusLabel[status]}`, description: "The applicant pipeline has been updated." });
  };

  const addPrivateNote = async (application: any) => {
    const noteText = drafts[application.id]?.trim();
    if (!user || !noteText) return;
    setSavingId(application.id);
    const { data, error } = await supabase.from("candidate_notes").insert({ recruiter_id: user.id, candidate_id: application.user_id, job_id: application.job_id, note_text: noteText, is_private: true }).select("id, candidate_id, job_id, note_text, created_at").single();
    setSavingId(null);
    if (error) return toast({ title: "Note was not saved", description: error.message, variant: "destructive" });
    const key = `${application.user_id}:${application.job_id}`;
    setNotes(current => ({ ...current, [key]: [data, ...(current[key] || [])] }));
    setDrafts(current => ({ ...current, [application.id]: "" }));
    toast({ title: "Private note saved", description: "Only your recruiter account can see this note." });
  };

  const counts = useMemo(() => applications.reduce<Record<PipelineStatus, number>>((total, application) => {
    const status = (application.status || "new") as PipelineStatus;
    total[status] = (total[status] || 0) + 1;
    return total;
  }, { new: 0, shortlisted: 0, rejected: 0, hired: 0 }), [applications]);

  return <DashboardLayout><div className="mx-auto max-w-5xl space-y-6">
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8"><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Recruiter workspace</p><div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="font-display text-3xl font-bold tracking-tight">Applicant pipeline</h1><p className="mt-1 text-muted-foreground">Review applicants for your jobs and keep each decision organised.</p></div><Badge variant="outline" className="w-fit border-primary/25 bg-primary/10 px-3 py-1 text-primary">{applications.length} application{applications.length === 1 ? "" : "s"}</Badge></div><div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">{(Object.keys(statusLabel) as PipelineStatus[]).map(status => <div key={status} className="rounded-xl border border-border bg-muted/25 px-3 py-3"><p className="text-xl font-display font-semibold">{counts[status]}</p><p className="mt-0.5 text-xs text-muted-foreground">{statusLabel[status]}</p></div>)}</div></section>

    {loading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : applications.length === 0 ? <Card className="border-dashed"><CardContent className="py-16 text-center"><UserRound className="mx-auto mb-3 h-9 w-9 text-muted-foreground" /><h2 className="font-display text-xl font-semibold">No applicants yet</h2><p className="mt-2 text-sm text-muted-foreground">Applications to jobs you post will appear here.</p></CardContent></Card> : <div className="space-y-3">{applications.map(application => {
      const profile = application.profiles || {}; const job = application.jobs || {}; const status = (application.status || "new") as PipelineStatus; const key = `${application.user_id}:${application.job_id}`; const isExpanded = expandedId === application.id;
      return <Card key={application.id} className="border-border bg-card shadow-card"><CardContent className="p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><button type="button" className="min-w-0 flex-1 text-left" onClick={() => setExpandedId(isExpanded ? null : application.id)}><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-display font-semibold text-primary">{(profile.full_name || "A").charAt(0).toUpperCase()}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-lg font-semibold">{profile.full_name || "Applicant"}</h2><Badge variant="outline" className={statusStyle[status]}>{statusLabel[status]}</Badge></div><p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><BriefcaseBusiness className="h-3.5 w-3.5" />{job.title || "Job"}{job.company ? ` · ${job.company}` : ""}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />Applied {new Date(application.applied_at).toLocaleDateString()}</p></div></div></button><div className="flex items-center gap-2"><select aria-label={`Update status for ${profile.full_name || "applicant"}`} value={status} disabled={savingId === application.id} onChange={event => void updateStatus(application, event.target.value as PipelineStatus)} className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">{(Object.keys(statusLabel) as PipelineStatus[]).map(option => <option key={option} value={option}>{statusLabel[option]}</option>)}</select><Button variant="ghost" size="icon" aria-label={isExpanded ? "Hide applicant details" : "Show applicant details"} onClick={() => setExpandedId(isExpanded ? null : application.id)}><ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} /></Button></div></div>
        {isExpanded && <div className="mt-5 grid gap-5 border-t border-border pt-5 lg:grid-cols-[1fr_.9fr]"><div><h3 className="text-sm font-semibold">Candidate details</h3><div className="mt-3 space-y-2 text-sm text-muted-foreground"><p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{profile.email || "Email not available"}</p><p>{profile.experience_years || 0} year{Number(profile.experience_years) === 1 ? "" : "s"} experience{profile.location ? ` · ${profile.location}` : ""}</p><div className="flex flex-wrap gap-1.5">{(profile.skills || []).slice(0, 8).map((skill: string) => <Badge key={skill} variant="secondary" className="font-normal">{skill}</Badge>)}</div>{profile.resume_url && <p className="flex items-center gap-2 text-primary"><FileText className="h-3.5 w-3.5" />Resume attached to profile</p>}</div></div><div className="rounded-xl border border-border bg-muted/20 p-4"><div className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Private recruiter notes</h3></div><p className="mt-1 text-xs text-muted-foreground">Visible only to you. The applicant never sees these notes.</p><Textarea className="mt-3 bg-background" value={drafts[application.id] || ""} onChange={event => setDrafts(current => ({ ...current, [application.id]: event.target.value }))} placeholder="Add an interview or review note…" rows={3} /><Button size="sm" className="mt-2" disabled={savingId === application.id || !drafts[application.id]?.trim()} onClick={() => void addPrivateNote(application)}><MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" />Save private note</Button>{(notes[key] || []).length > 0 && <div className="mt-4 space-y-2">{notes[key].map(note => <div key={note.id} className="rounded-lg border border-border bg-background px-3 py-2.5"><p className="text-sm">{note.note_text}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(note.created_at).toLocaleDateString()}</p></div>)}</div>}</div></div>}
      </CardContent></Card>;
    })}</div>}
  </div></DashboardLayout>;
}

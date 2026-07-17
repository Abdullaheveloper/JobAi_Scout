import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BriefcaseBusiness, Clock3, Loader2, UserRound } from "lucide-react";

type Status = "new" | "shortlisted" | "rejected" | "hired";
const labels: Record<Status, string> = { new: "New", shortlisted: "Shortlisted", rejected: "Rejected", hired: "Hired" };
const styles: Record<Status, string> = { new: "border-sky-500/25 bg-sky-500/10 text-sky-300", shortlisted: "border-violet-500/25 bg-violet-500/10 text-violet-300", rejected: "border-rose-500/25 bg-rose-500/10 text-rose-300", hired: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" };

export default function RecruiterApplicationStatus() {
  const { user } = useAuth(); const { toast } = useToast();
  const [applications, setApplications] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!user) return; setLoading(true);
    const { data, error } = await supabase.from("job_applications").select("id, status, applied_at, jobs!inner(title, company, recruiter_id)").order("applied_at", { ascending: false });
    if (error) toast({ title: "Could not load application status", description: error.message, variant: "destructive" });
    else setApplications((data || []).filter((application: any) => application.jobs?.recruiter_id === user.id));
    setLoading(false);
  }, [toast, user]);
  useEffect(() => { void load(); }, [load]);
  const totals = useMemo(() => applications.reduce<Record<Status, number>>((result, application) => { const status = (application.status || "new") as Status; result[status] = (result[status] || 0) + 1; return result; }, { new: 0, shortlisted: 0, rejected: 0, hired: 0 }), [applications]);
  return <DashboardLayout><div className="mx-auto max-w-5xl space-y-6"><section className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8"><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Recruiter workspace</p><h1 className="mt-2 font-display text-3xl font-bold">Application status</h1><p className="mt-1 text-muted-foreground">A simple overview of every application to your jobs.</p><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{(Object.keys(labels) as Status[]).map(status => <div key={status} className="rounded-xl border border-border bg-muted/25 p-4"><p className="font-display text-2xl font-semibold">{totals[status]}</p><p className="mt-1 text-xs text-muted-foreground">{labels[status]}</p></div>)}</div></section>{loading ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : applications.length === 0 ? <Card className="border-dashed"><CardContent className="py-16 text-center"><UserRound className="mx-auto mb-3 h-9 w-9 text-muted-foreground" /><h2 className="font-display text-xl font-semibold">No application activity</h2><p className="mt-2 text-sm text-muted-foreground">Status changes will appear here once candidates apply.</p></CardContent></Card> : <Card className="border-border bg-card shadow-card"><CardContent className="divide-y divide-border p-0">{applications.map(application => { const status = (application.status || "new") as Status; return <div key={application.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="flex items-center gap-2 font-medium"><BriefcaseBusiness className="h-4 w-4 text-primary" />{application.jobs?.title || "Job"}</p><p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />Applied {new Date(application.applied_at).toLocaleDateString()}{application.jobs?.company ? ` · ${application.jobs.company}` : ""}</p></div><Badge variant="outline" className={`w-fit ${styles[status]}`}>{labels[status]}</Badge></div>; })}</CardContent></Card>}</div></DashboardLayout>;
}

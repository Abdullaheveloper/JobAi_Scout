import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, MapPin, DollarSign } from "lucide-react";

interface JobForm {
  title: string;
  company: string;
  location: string;
  job_type: string;
  experience_level: string;
  salary_min: string;
  salary_max: string;
  description: string;
  skills: string;
  requirements: string;
  job_url: string;
}

const emptyForm: JobForm = {
  title: "", company: "", location: "", job_type: "full-time",
  experience_level: "", salary_min: "", salary_max: "",
  description: "", skills: "", requirements: "", job_url: "",
};

export default function RecruiterJobs() {
  const { user, recruiterProfile } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [form, setForm] = useState<JobForm>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const fetchJobs = async () => {
    if (!user) return;
    const { data } = await supabase.from("jobs").select("*").eq("recruiter_id", user.id).order("created_at", { ascending: false });
    setJobs(data || []);
  };

  useEffect(() => { fetchJobs(); }, [user]);
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const payload = {
      title: form.title,
      company: form.company || recruiterProfile?.company_name || "",
      location: form.location || null,
      job_type: form.job_type,
      experience_level: form.experience_level || null,
      salary_min: form.salary_min ? Number(form.salary_min) : null,
      salary_max: form.salary_max ? Number(form.salary_max) : null,
      description: form.description || null,
      skills: form.skills ? form.skills.split(",").map(s => s.trim()).filter(Boolean) : [],
      requirements: form.requirements ? form.requirements.split(",").map(s => s.trim()).filter(Boolean) : [],
      job_url: form.job_url || null,
      recruiter_id: user.id,
      source: "recruiter",
    };

    if (editId) {
      const { error } = await supabase.from("jobs").update(payload).eq("id", editId);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Job updated" });
    } else {
      const { error } = await supabase.from("jobs").insert(payload);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Job posted!" });
    }
    setLoading(false);
    setOpen(false);
    setForm(emptyForm);
    setEditId(null);
    fetchJobs();
  };

  const handleEdit = (job: any) => {
    setForm({
      title: job.title, company: job.company, location: job.location || "",
      job_type: job.job_type || "full-time", experience_level: job.experience_level || "",
      salary_min: job.salary_min?.toString() || "", salary_max: job.salary_max?.toString() || "",
      description: job.description || "", skills: (job.skills || []).join(", "),
      requirements: (job.requirements || []).join(", "), job_url: job.job_url || "",
    });
    setEditId(job.id);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("jobs").delete().eq("id", id);
    toast({ title: "Job deleted" });
    fetchJobs();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">My Job Postings</h1>
            <p className="text-muted-foreground">Create and manage job listings</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyForm); setEditId(null); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Post Job</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editId ? "Edit Job" : "Post New Job"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Job Title *</Label>
                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Senior React Developer" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Company</Label>
                    <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder={recruiterProfile?.company_name || "Company"} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Remote / City" />
                  </div>
                  <div className="space-y-2">
                    <Label>Job Type</Label>
                    <Select value={form.job_type} onValueChange={(v) => setForm({ ...form, job_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full-time">Full-time</SelectItem>
                        <SelectItem value="part-time">Part-time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="internship">Internship</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Min Salary</Label>
                    <Input type="number" value={form.salary_min} onChange={(e) => setForm({ ...form, salary_min: e.target.value })} placeholder="50000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Salary</Label>
                    <Input type="number" value={form.salary_max} onChange={(e) => setForm({ ...form, salary_max: e.target.value })} placeholder="100000" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Experience Level</Label>
                  <Select value={form.experience_level} onValueChange={(v) => setForm({ ...form, experience_level: v })}>
                    <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry">Entry Level</SelectItem>
                      <SelectItem value="mid">Mid Level</SelectItem>
                      <SelectItem value="senior">Senior</SelectItem>
                      <SelectItem value="lead">Lead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Job description..." />
                </div>
                <div className="space-y-2">
                  <Label>Skills (comma-separated)</Label>
                  <Input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="React, TypeScript, Node.js" />
                </div>
                <div className="space-y-2">
                  <Label>Requirements (comma-separated)</Label>
                  <Input value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} placeholder="3+ years experience, CS degree" />
                </div>
                <div className="space-y-2">
                  <Label>Application URL</Label>
                  <Input value={form.job_url} onChange={(e) => setForm({ ...form, job_url: e.target.value })} placeholder="https://..." />
                </div>
                <Button onClick={handleSave} disabled={loading || !form.title} className="w-full">
                  {loading ? "Saving..." : editId ? "Update Job" : "Post Job"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {jobs.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No jobs posted yet. Click "Post Job" to get started.</CardContent></Card>
        ) : (
          <div className="grid gap-4">
            {jobs.map((job) => (
              <Card key={job.id}>
                <CardContent className="flex items-center justify-between p-6">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg">{job.title}</h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{job.company}</span>
                      {job.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>}
                      {(job.salary_min || job.salary_max) && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {job.salary_min && `${(job.salary_min / 1000).toFixed(0)}k`}
                          {job.salary_min && job.salary_max && " - "}
                          {job.salary_max && `${(job.salary_max / 1000).toFixed(0)}k`}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">{job.job_type}</Badge>
                      {job.is_active ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => handleEdit(job)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" onClick={() => handleDelete(job.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

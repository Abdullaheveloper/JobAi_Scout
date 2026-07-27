import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { MixedDir } from "@/components/MixedDir";
import { Card, CardContent } from "@/components/ui/card";
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

const JOB_TYPE_KEYS: Record<string, string> = {
  "full-time": "recruiter.fullTime",
  "part-time": "recruiter.partTime",
  contract: "recruiter.contract",
  internship: "recruiter.internship",
};

export default function RecruiterJobs() {
  const { t } = useTranslation();
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
      if (error) toast({ title: t("recruiter.toastError"), description: error.message, variant: "destructive" });
      else toast({ title: t("recruiter.toastJobUpdated") });
    } else {
      const { error } = await supabase.from("jobs").insert(payload);
      if (error) toast({ title: t("recruiter.toastError"), description: error.message, variant: "destructive" });
      else toast({ title: t("recruiter.toastJobPosted") });
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
    toast({ title: t("recruiter.toastJobDeleted") });
    fetchJobs();
  };

  const jobTypeLabel = (value?: string | null) => {
    if (!value) return "";
    const key = JOB_TYPE_KEYS[value];
    return key ? t(key) : value;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">{t("recruiter.myJobs")}</h1>
            <p className="text-muted-foreground">{t("recruiter.myJobsCopy")}</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyForm); setEditId(null); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="me-2 h-4 w-4" /> {t("recruiter.postJob")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editId ? t("common.edit") : t("recruiter.postJob")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("recruiter.jobTitle")}</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder={t("recruiter.titlePlaceholder")}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("recruiter.jobCompany")}</Label>
                    <Input
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                      placeholder={recruiterProfile?.company_name || t("common.company")}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("recruiter.jobLocation")}</Label>
                    <Input
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder={t("recruiter.locationPlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("recruiter.jobType")}</Label>
                    <Select value={form.job_type} onValueChange={(v) => setForm({ ...form, job_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full-time">{t("recruiter.fullTime")}</SelectItem>
                        <SelectItem value="part-time">{t("recruiter.partTime")}</SelectItem>
                        <SelectItem value="contract">{t("recruiter.contract")}</SelectItem>
                        <SelectItem value="internship">{t("recruiter.internship")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("recruiter.minSalary")}</Label>
                    <Input
                      type="number"
                      dir="ltr"
                      value={form.salary_min}
                      onChange={(e) => setForm({ ...form, salary_min: e.target.value })}
                      placeholder={t("recruiter.salaryMinPlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("recruiter.maxSalary")}</Label>
                    <Input
                      type="number"
                      dir="ltr"
                      value={form.salary_max}
                      onChange={(e) => setForm({ ...form, salary_max: e.target.value })}
                      placeholder={t("recruiter.salaryMaxPlaceholder")}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("recruiter.experienceLevel")}</Label>
                  <Select value={form.experience_level} onValueChange={(v) => setForm({ ...form, experience_level: v })}>
                    <SelectTrigger><SelectValue placeholder={t("recruiter.selectLevel")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry">{t("recruiter.entryLevel")}</SelectItem>
                      <SelectItem value="mid">{t("recruiter.midLevel")}</SelectItem>
                      <SelectItem value="senior">{t("recruiter.senior")}</SelectItem>
                      <SelectItem value="lead">{t("recruiter.lead")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("recruiter.jobDescription")}</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={4}
                    placeholder={t("recruiter.descriptionPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("recruiter.jobSkills")}</Label>
                  <Input
                    value={form.skills}
                    onChange={(e) => setForm({ ...form, skills: e.target.value })}
                    placeholder={t("recruiter.skillsPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("recruiter.jobRequirements")}</Label>
                  <Input
                    value={form.requirements}
                    onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                    placeholder={t("recruiter.requirementsPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("recruiter.applicationUrl")}</Label>
                  <Input
                    value={form.job_url}
                    onChange={(e) => setForm({ ...form, job_url: e.target.value })}
                    placeholder={t("recruiter.applicationUrlPlaceholder")}
                    dir="ltr"
                  />
                </div>
                <Button onClick={handleSave} disabled={loading || !form.title} className="w-full">
                  {loading ? t("recruiter.saving") : editId ? t("recruiter.updateJob") : t("recruiter.postJobBtn")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {jobs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {t("recruiter.noJobsYet")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {jobs.map((job) => (
              <Card key={job.id}>
                <CardContent className="flex items-center justify-between p-6">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg">
                      <MixedDir>{job.title}</MixedDir>
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span><MixedDir>{job.company}</MixedDir></span>
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <MixedDir>{job.location}</MixedDir>
                        </span>
                      )}
                      {(job.salary_min || job.salary_max) && (
                        <span className="flex items-center gap-1" dir="ltr">
                          <DollarSign className="h-3 w-3" />
                          {job.salary_min && `${(job.salary_min / 1000).toFixed(0)}k`}
                          {job.salary_min && job.salary_max && " - "}
                          {job.salary_max && `${(job.salary_max / 1000).toFixed(0)}k`}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">{jobTypeLabel(job.job_type)}</Badge>
                      {job.is_active
                        ? <Badge>{t("common.active")}</Badge>
                        : <Badge variant="outline">{t("common.inactive")}</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => handleEdit(job)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleDelete(job.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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

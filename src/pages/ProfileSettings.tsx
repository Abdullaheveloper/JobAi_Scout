import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { hasValue } from "@/lib/constants";
import {
  Loader2, Save, User, Phone, Linkedin, Github, Mail, Briefcase, Sparkles,
  MapPin, Globe, Building2, GraduationCap, Award,
  Languages, DollarSign, AlertCircle, ShieldCheck, Bot,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ── Color-coded section themes ─────────────────────────────────
const SECTION_THEMES = {
  personal: {
    gradient: "from-cyan-500/15 via-cyan-500/5 to-transparent",
    border: "border-cyan-400/30 hover:border-cyan-400/50",
    titleColor: "text-cyan-400",
    iconColor: "text-cyan-400",
    inputFocus: "focus-visible:ring-cyan-400/60 focus-visible:border-cyan-400/50",
    glow: "shadow-cyan/20",
  },
  social: {
    gradient: "from-violet-500/15 via-violet-500/5 to-transparent",
    border: "border-violet-400/30 hover:border-violet-400/50",
    titleColor: "text-violet-400",
    iconColor: "text-violet-400",
    inputFocus: "focus-visible:ring-violet-400/60 focus-visible:border-violet-400/50",
    glow: "shadow-cyan/20",
  },
  skills: {
    gradient: "from-emerald-500/15 via-emerald-500/5 to-transparent",
    border: "border-emerald-400/30 hover:border-emerald-400/50",
    titleColor: "text-emerald-400",
    iconColor: "text-emerald-400",
    inputFocus: "focus-visible:ring-emerald-400/60 focus-visible:border-emerald-400/50",
    glow: "shadow-cyan/20",
  },
  additional: {
    gradient: "from-amber-500/15 via-amber-500/5 to-transparent",
    border: "border-amber-400/30 hover:border-amber-400/50",
    titleColor: "text-amber-400",
    iconColor: "text-amber-400",
    inputFocus: "focus-visible:ring-amber-400/60 focus-visible:border-amber-400/50",
    glow: "shadow-cyan/20",
  },
};

// ── Color-coded input wrapper ──────────────────────────────────
function ColorInput({
  id, value, onChange, placeholder, className = "", iconColor = "", inputFocus = "", ...props
}: {
  id: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; className?: string; iconColor?: string; inputFocus?: string;
  [key: string]: any;
}) {
  return (
    <Input
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`
        transition-all duration-300
        bg-background
        border-border
        ${inputFocus}
        focus:shadow-lg
        ${className}
      `}
      {...props}
    />
  );
}

function ColorTextarea({
  id, value, onChange, placeholder, rows, className = "", inputFocus = "", ...props
}: {
  id: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string; rows?: number; className?: string; inputFocus?: string;
  [key: string]: any;
}) {
  return (
    <Textarea
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className={`
        transition-all duration-300
        bg-background
        border-border
        ${inputFocus}
        focus:shadow-lg
        ${className}
      `}
      {...props}
    />
  );
}

// ── Data source badge ──────────────────────────────────────────
function DataSourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  if (source === "ai") {
    return <Badge variant="outline" className="text-xs bg-cyan-500/10 text-cyan-300 border-cyan-500/20 gap-1"><Bot className="h-3 w-3" /> AI</Badge>;
  }
  if (source === "user") {
    return <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-300 border-emerald-500/20 gap-1"><ShieldCheck className="h-3 w-3" /> You</Badge>;
  }
  return <Badge variant="outline" className="text-xs">{source}</Badge>;
}

// ── URL validation ─────────────────────────────────────────────
function isValidUrl(str: string): boolean {
  if (!str) return true;
  if (str.toLowerCase() === "no") return true;
  try { new URL(str); return true; } catch { return false; }
}

export default function ProfileSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    bio: "",
    linkedin_url: "",
    github_url: "",
    portfolio_url: "",
    current_company: "",
    expected_salary: "",
    skills: "",
    desired_roles: "",
    experience_years: 0,
    location: "",
    education: "",
    certifications: "",
    languages: "",
    work_authorization: "",
    willing_to_relocate: "",
    availability: "",
    work_type: "",
    application_answers: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());

  const dataSources = useMemo(() => {
    try {
      return (profile?.data_sources as Record<string, string>) || {};
    } catch {
      return {};
    }
  }, [profile]);

  // Fetch latest profile on mount
  useEffect(() => {
    if (user) refreshProfile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        bio: profile.bio || "",
        linkedin_url: profile.linkedin_url || "",
        github_url: profile.github_url || "",
        portfolio_url: (profile as any).portfolio_url || "",
        current_company: (profile as any).current_company || "",
        expected_salary: (profile as any).expected_salary || "",
        skills: (profile.skills || []).join(", "),
        desired_roles: (profile.desired_roles || []).join(", "),
        experience_years: profile.experience_years || 0,
        location: profile.location || "",
        education: (profile as any).education || "",
        certifications: ((profile as any).certifications || []).join(", "),
        languages: ((profile as any).languages || []).join(", "),
        work_authorization: (profile as any).work_authorization || "",
        willing_to_relocate: (profile as any).willing_to_relocate || "",
        availability: (profile as any).availability || "",
        work_type: (profile as any).work_type || "",
        application_answers: Object.entries(((profile as any).application_answers || {}) as Record<string, unknown>)
          .map(([question, answer]) => `${question} = ${String(answer)}`)
          .join("\n"),
      });
    }
  }, [profile]);

  const updateField = (key: string, value: string | number) => {
    setForm(f => ({ ...f, [key]: value }));
    setChangedFields(prev => new Set(prev).add(key));
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (form.linkedin_url && !isValidUrl(form.linkedin_url)) errs.linkedin_url = "Invalid URL";
    if (form.github_url && !isValidUrl(form.github_url)) errs.github_url = "Invalid URL";
    if (form.portfolio_url && !isValidUrl(form.portfolio_url)) errs.portfolio_url = "Invalid URL";
    if (form.phone && form.phone.toLowerCase() !== "no" && !/^[+\d\s()-]*$/.test(form.phone)) errs.phone = "Invalid phone format";
    for (const [index, line] of form.application_answers.split("\n").entries()) {
      if (line.trim() && !line.includes("=")) errs.application_answers = `Line ${index + 1} needs: question = answer`;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!user) return;
    if (!validate()) {
      toast({ title: "Validation error", description: "Please fix the highlighted fields.", variant: "destructive" });
      return;
    }
    setSaving(true);

    const corePayload: Record<string, any> = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      bio: form.bio.trim() || null,
      linkedin_url: form.linkedin_url.trim() || null,
      github_url: form.github_url.trim() || null,
      skills: form.skills ? form.skills.split(",").map(s => s.trim()).filter(Boolean) : [],
      desired_roles: form.desired_roles ? form.desired_roles.split(",").map(s => s.trim()).filter(Boolean) : [],
      experience_years: Number(form.experience_years) || 0,
      location: form.location.trim() || null,
    };

    const applicationAnswers = Object.fromEntries(
      form.application_answers.split("\n").map(line => line.trim()).filter(Boolean).map(line => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim()];
      }).filter(([question, answer]) => question && answer)
    );

    const extendedPayload: Record<string, any> = {
      portfolio_url: form.portfolio_url.trim() || null,
      current_company: form.current_company.trim() || null,
      expected_salary: form.expected_salary.trim() || null,
      education: form.education.trim() || null,
      certifications: form.certifications ? form.certifications.split(",").map(s => s.trim()).filter(Boolean) : [],
      languages: form.languages ? form.languages.split(",").map(s => s.trim()).filter(Boolean) : [],
      work_authorization: form.work_authorization || null,
      willing_to_relocate: form.willing_to_relocate || null,
      availability: form.availability.trim() || null,
      work_type: form.work_type || null,
      application_answers: applicationAnswers,
    };

    const { error: fullError } = await supabase.from("profiles").update({ ...corePayload, ...extendedPayload }).eq("user_id", user.id);
    let error = fullError;

    if (fullError) {
      const { error: coreError } = await supabase.from("profiles").update(corePayload).eq("user_id", user.id);
      error = coreError;
      if (!coreError) {
        toast({
          title: "Partially saved",
          description: "Core info saved. Some fields need a database migration to be saved.",
        });
      }
    }

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      const changedKeys = Array.from(changedFields).filter(k => k !== "email");
      if (changedKeys.length > 0) {
        try {
          await supabase.rpc("update_profile_data_sources", {
            p_user_id: user.id,
            p_field_names: changedKeys,
            p_source: "user",
          });
        } catch { /* graceful degradation */ }
      }
      await refreshProfile();
      setChangedFields(new Set());
      if (!fullError) {
        toast({ title: "Profile updated!", description: "Your changes have been saved." });
      }
    }
    setSaving(false);
  };

  const completenessItems = useMemo(() => {
    const p = profile;
    if (!p) return [];
    return [
      { label: "Name", key: "full_name", done: hasValue(p.full_name) },
      { label: "Email", key: "email", done: hasValue(p.email) },
      { label: "Phone", key: "phone", done: hasValue(p.phone) },
      { label: "Location", key: "location", done: hasValue(p.location) },
      { label: "Bio", key: "bio", done: hasValue(p.bio) },
      { label: "Skills", key: "skills", done: hasValue(p.skills) },
      { label: "Roles", key: "desired_roles", done: hasValue(p.desired_roles) },
      { label: "Experience", key: "experience_years", done: hasValue(p.experience_years) },
      { label: "Resume", key: "resume_url", done: hasValue(p.resume_url) },
      { label: "LinkedIn", key: "linkedin_url", done: hasValue(p.linkedin_url) },
      { label: "GitHub", key: "github_url", done: hasValue(p.github_url) },
      { label: "Portfolio", key: "portfolio_url", done: hasValue((p as any).portfolio_url) },
      { label: "Company", key: "current_company", done: hasValue((p as any).current_company) },
      { label: "Education", key: "education", done: hasValue((p as any).education) },
    ];
  }, [profile]);

  const completeness = useMemo(() => {
    if (!completenessItems.length) return 0;
    return Math.round((completenessItems.filter(i => i.done).length / completenessItems.length) * 100);
  }, [completenessItems]);

  const skills = profile?.skills || [];
  const roles = profile?.desired_roles || [];
  const P = SECTION_THEMES.personal;
  const S = SECTION_THEMES.social;
  const K = SECTION_THEMES.skills;
  const A = SECTION_THEMES.additional;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
        {/* ── Page Header ─────────────────────────────────── */}
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Your job profile</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Profile settings</h1>
            <p className="mt-1 text-muted-foreground">Keep the details that matter for matching and autofill up to date.</p>
          </div>
          <Badge variant="outline" className="w-fit border-primary/25 bg-primary/10 px-3 py-1 text-primary">{completeness}% complete</Badge>
        </section>

        {/* ── Profile Completeness ────────────────────────── */}
        <Card className="border-border bg-card shadow-card">
          <CardContent className="py-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-display font-semibold text-sm">Profile readiness</span>
              <span className="text-xs text-muted-foreground">{completenessItems.filter(item => !item.done).length ? `${completenessItems.filter(item => !item.done).length} details left` : "Ready to apply"}</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${completeness}%`,
                  background: completeness === 100
                    ? "linear-gradient(90deg, #10b981, #34d399, #6ee7b7)"
                    : "linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)",
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {completenessItems.filter(item => !item.done).slice(0, 5).map(item => (
                <Badge
                  key={item.key}
                  variant="outline"
                  className={`text-xs transition-all duration-300 ${
                    "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  Add {item.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Extracted CV Data ───────────────────────────── */}
        {/* ── Personal Information (Cyan) ─────────────────── */}
        <Card className="border-border bg-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <User className="h-5 w-5 text-primary" /> Contact & background
            </CardTitle>
            <CardDescription>Your essential contact and career information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name" className={`flex items-center gap-1.5 ${P.titleColor}`}>
                  <User className="h-3.5 w-3.5" /> Full Name
                  <DataSourceBadge source={dataSources.full_name} />
                </Label>
                <ColorInput id="full_name" value={form.full_name} onChange={e => updateField("full_name", e.target.value)} placeholder="John Doe" inputFocus={P.inputFocus} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1.5 text-slate-300">
                  <Mail className="h-3.5 w-3.5" /> Email
                </Label>
                <Input id="email" value={form.email} disabled className="border-border bg-muted/50 text-muted-foreground" />
                <p className="text-xs text-slate-500">Email cannot be changed here</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone" className={`flex items-center gap-1.5 ${P.titleColor}`}>
                  <Phone className="h-3.5 w-3.5" /> Phone Number
                  <DataSourceBadge source={dataSources.phone} />
                </Label>
                <ColorInput
                  id="phone"
                  inputMode="tel"
                  value={form.phone}
                  onChange={e => {
                    const val = e.target.value;
                    if (val.toLowerCase() === "n" || val.toLowerCase() === "no") {
                      updateField("phone", val);
                    } else {
                      updateField("phone", val.replace(/[a-zA-Z]/g, ""));
                    }
                  }}
                  placeholder="+1 234 567 8900"
                  inputFocus={P.inputFocus}
                  className={errors.phone ? "border-rose-400/50" : ""}
                />
                {errors.phone && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.phone}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="location" className={`flex items-center gap-1.5 ${P.titleColor}`}>
                  <MapPin className="h-3.5 w-3.5" /> Location
                  <DataSourceBadge source={dataSources.location} />
                </Label>
                <ColorInput id="location" value={form.location} onChange={e => updateField("location", e.target.value)} placeholder="New York, NY" inputFocus={P.inputFocus} />
                <p className="text-xs text-slate-500">Used for location-based job matching</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="experience" className={`flex items-center gap-1.5 ${P.titleColor}`}>
                  <Briefcase className="h-3.5 w-3.5" /> Experience (years)
                  <DataSourceBadge source={dataSources.experience_years} />
                </Label>
                <ColorInput id="experience" type="number" min={0} value={form.experience_years} onChange={e => updateField("experience_years", Number(e.target.value))} inputFocus={P.inputFocus} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company" className={`flex items-center gap-1.5 ${P.titleColor}`}>
                  <Building2 className="h-3.5 w-3.5" /> Current Company
                  <DataSourceBadge source={dataSources.current_company} />
                </Label>
                <ColorInput id="company" value={form.current_company} onChange={e => updateField("current_company", e.target.value)} placeholder="Acme Inc." inputFocus={P.inputFocus} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="salary" className={`flex items-center gap-1.5 ${P.titleColor}`}>
                  <DollarSign className="h-3.5 w-3.5" /> Expected Salary
                  <DataSourceBadge source={dataSources.expected_salary} />
                </Label>
                <ColorInput id="salary" value={form.expected_salary} onChange={e => updateField("expected_salary", e.target.value)} placeholder="$80,000" inputFocus={P.inputFocus} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="education" className={`flex items-center gap-1.5 ${P.titleColor}`}>
                  <GraduationCap className="h-3.5 w-3.5" /> Education
                  <DataSourceBadge source={dataSources.education} />
                </Label>
                <ColorInput id="education" value={form.education} onChange={e => updateField("education", e.target.value)} placeholder="BSc Computer Science, MIT 2022" inputFocus={P.inputFocus} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio" className={P.titleColor}>Bio / About Me</Label>
              <ColorTextarea id="bio" value={form.bio} onChange={e => updateField("bio", e.target.value)} placeholder="Tell us about yourself..." rows={3} inputFocus={P.inputFocus} />
            </div>
          </CardContent>
        </Card>

        {/* ── Social Links (Violet) ───────────────────────── */}
        <Card className="border-border bg-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Globe className="h-5 w-5 text-primary" /> Professional links
            </CardTitle>
            <CardDescription>Used by the browser extension for application autofill.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="linkedin" className={`flex items-center gap-1.5 ${S.titleColor}`}>
                <Linkedin className="h-3.5 w-3.5" /> LinkedIn URL
                <DataSourceBadge source={dataSources.linkedin_url} />
              </Label>
              <ColorInput
                id="linkedin"
                value={form.linkedin_url}
                onChange={e => updateField("linkedin_url", e.target.value)}
                placeholder="https://linkedin.com/in/yourprofile"
                inputFocus={S.inputFocus}
                className={errors.linkedin_url ? "border-rose-400/50" : ""}
              />
              {errors.linkedin_url && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.linkedin_url}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="github" className={`flex items-center gap-1.5 ${S.titleColor}`}>
                <Github className="h-3.5 w-3.5" /> GitHub URL
                <DataSourceBadge source={dataSources.github_url} />
              </Label>
              <ColorInput
                id="github"
                value={form.github_url}
                onChange={e => updateField("github_url", e.target.value)}
                placeholder="https://github.com/yourusername"
                inputFocus={S.inputFocus}
                className={errors.github_url ? "border-rose-400/50" : ""}
              />
              {errors.github_url && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.github_url}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="portfolio" className={`flex items-center gap-1.5 ${S.titleColor}`}>
                <Globe className="h-3.5 w-3.5" /> Portfolio URL
                <DataSourceBadge source={dataSources.portfolio_url} />
              </Label>
              <ColorInput
                id="portfolio"
                value={form.portfolio_url}
                onChange={e => updateField("portfolio_url", e.target.value)}
                placeholder="https://yourportfolio.com"
                inputFocus={S.inputFocus}
                className={errors.portfolio_url ? "border-rose-400/50" : ""}
              />
              {errors.portfolio_url && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.portfolio_url}</p>}
            </div>
          </CardContent>
        </Card>

        {/* ── Skills & Roles (Emerald) ────────────────────── */}
        <Card className="border-primary/25 bg-primary/[0.03] shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Sparkles className="h-5 w-5 text-primary" /> Matching essentials
            </CardTitle>
            <CardDescription>Skills and target roles have the strongest effect on job matching.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="skills" className={`flex items-center gap-1.5 ${K.titleColor}`}>
                Skills <DataSourceBadge source={dataSources.skills} />
              </Label>
              <ColorTextarea id="skills" value={form.skills} onChange={e => updateField("skills", e.target.value)} placeholder="React, TypeScript, Node.js, Python..." rows={2} inputFocus={K.inputFocus} />
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {skills.map((s: string) => (
                    <Badge key={s} variant="secondary" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/20 text-xs">{s}</Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="roles" className={`flex items-center gap-1.5 ${K.titleColor}`}>
                Desired Roles <DataSourceBadge source={dataSources.desired_roles} />
              </Label>
              <ColorTextarea id="roles" value={form.desired_roles} onChange={e => updateField("desired_roles", e.target.value)} placeholder="Frontend Developer, Full Stack Engineer..." rows={2} inputFocus={K.inputFocus} />
              {roles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {roles.map((r: string) => (
                    <Badge key={r} variant="secondary" className="bg-violet-500/15 text-violet-300 border-violet-500/20 text-xs">{r}</Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Additional Info (Amber) ─────────────────────── */}
        <Card className="border-border bg-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Award className="h-5 w-5 text-primary" /> Credentials
            </CardTitle>
            <CardDescription>Optional details that make your profile more complete.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="certifications" className={`flex items-center gap-1.5 ${A.titleColor}`}>
                <Award className="h-3.5 w-3.5" /> Certifications
                <DataSourceBadge source={dataSources.certifications} />
              </Label>
              <ColorTextarea id="certifications" value={form.certifications} onChange={e => updateField("certifications", e.target.value)} placeholder="AWS Certified, PMP, Google Analytics..." rows={2} inputFocus={A.inputFocus} />
              <p className="text-xs text-slate-500">Comma-separated list of certifications</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="languages" className={`flex items-center gap-1.5 ${A.titleColor}`}>
                <Languages className="h-3.5 w-3.5" /> Languages
                <DataSourceBadge source={dataSources.languages} />
              </Label>
              <ColorInput id="languages" value={form.languages} onChange={e => updateField("languages", e.target.value)} placeholder="English, Spanish, French" inputFocus={A.inputFocus} />
              <p className="text-xs text-slate-500">Comma-separated list of languages you speak</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display"><ShieldCheck className="h-5 w-5 text-primary" /> Application autofill</CardTitle>
            <CardDescription>Used only to answer job-application questions you have confirmed are accurate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="work_authorization" className="text-indigo-200">Work authorization</Label><select id="work_authorization" value={form.work_authorization} onChange={e => updateField("work_authorization", e.target.value)} className="flex h-10 w-full rounded-md border border-white/10 bg-[#0d1230]/80 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400/60"><option value="">Choose an answer</option><option value="yes">Authorized to work</option><option value="no">Not authorized to work</option></select></div>
              <div className="space-y-2"><Label htmlFor="willing_to_relocate" className="text-indigo-200">Willing to relocate</Label><select id="willing_to_relocate" value={form.willing_to_relocate} onChange={e => updateField("willing_to_relocate", e.target.value)} className="flex h-10 w-full rounded-md border border-white/10 bg-[#0d1230]/80 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400/60"><option value="">Choose an answer</option><option value="yes">Yes</option><option value="no">No</option></select></div>
              <div className="space-y-2"><Label htmlFor="work_type" className="text-indigo-200">Work preference</Label><select id="work_type" value={form.work_type} onChange={e => updateField("work_type", e.target.value)} className="flex h-10 w-full rounded-md border border-white/10 bg-[#0d1230]/80 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400/60"><option value="">Choose a preference</option><option value="onsite">On-site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></div>
              <div className="space-y-2"><Label htmlFor="availability" className="text-indigo-200">Availability to start</Label><ColorInput id="availability" value={form.availability} onChange={e => updateField("availability", e.target.value)} placeholder="Immediately, 2 weeks, 4 weeks..." inputFocus="focus-visible:ring-indigo-400/60" /></div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="application_answers" className="text-indigo-200">Employer-specific answers</Label>
              <ColorTextarea id="application_answers" value={form.application_answers} onChange={e => updateField("application_answers", e.target.value)} placeholder={"deployed and debugged an application on a linux server = Yes\nable to work onsite in Karachi = Yes"} rows={4} inputFocus="focus-visible:ring-indigo-400/60" className={errors.application_answers ? "border-rose-400/50" : ""} />
              {errors.application_answers ? <p className="text-xs text-rose-400">{errors.application_answers}</p> : <p className="text-xs text-slate-400">One answer per line: <code>question phrase = answer</code>. These answers override automatic guesses.</p>}
            </div>
          </CardContent>
        </Card>

        {/* ── Save Button ─────────────────────────────────── */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/40 via-violet-500/40 to-purple-500/40 rounded-lg blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <Button
            onClick={handleSave}
            disabled={saving}
            className="relative w-full h-12 text-base font-semibold transition-all duration-300 gradient-primary border-0 text-primary-foreground shadow-lg hover:opacity-90"
            size="lg"
          >
            {saving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              <><Save className="mr-2 h-4 w-4" /> Save All Changes</>
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

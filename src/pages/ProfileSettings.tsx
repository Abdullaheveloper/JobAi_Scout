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
  MapPin, FileText, Calendar, Globe, Building2, GraduationCap, Award,
  Languages, DollarSign, AlertCircle, CheckCircle2, ShieldCheck, Bot,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Data source badge helper
function DataSourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  if (source === "ai") {
    return <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200 gap-1"><Bot className="h-3 w-3" /> AI</Badge>;
  }
  if (source === "user") {
    return <Badge variant="outline" className="text-xs bg-green-50 text-green-600 border-green-200 gap-1"><ShieldCheck className="h-3 w-3" /> You</Badge>;
  }
  return <Badge variant="outline" className="text-xs">{source}</Badge>;
}

// Simple URL validation (allows "no" case-insensitive for opt-out)
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
      });
    }
  }, [profile]);

  const updateField = (key: string, value: string | number) => {
    setForm(f => ({ ...f, [key]: value }));
    setChangedFields(prev => new Set(prev).add(key));
    // Clear error on change
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (form.linkedin_url && !isValidUrl(form.linkedin_url)) errs.linkedin_url = "Invalid URL";
    if (form.github_url && !isValidUrl(form.github_url)) errs.github_url = "Invalid URL";
    if (form.portfolio_url && !isValidUrl(form.portfolio_url)) errs.portfolio_url = "Invalid URL";
    if (form.phone && form.phone.toLowerCase() !== "no" && !/^[+\d\s()-]*$/.test(form.phone)) errs.phone = "Invalid phone format";
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

    // Core payload — columns that exist in all schema versions
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

    // Extended payload — columns added by later migrations (may not exist in older DB instances)
    const extendedPayload: Record<string, any> = {
      portfolio_url: form.portfolio_url.trim() || null,
      current_company: form.current_company.trim() || null,
      expected_salary: form.expected_salary.trim() || null,
      education: form.education.trim() || null,
      certifications: form.certifications ? form.certifications.split(",").map(s => s.trim()).filter(Boolean) : [],
      languages: form.languages ? form.languages.split(",").map(s => s.trim()).filter(Boolean) : [],
    };

    // Try saving core + extended together first
    const { error: fullError } = await supabase.from("profiles").update({ ...corePayload, ...extendedPayload }).eq("user_id", user.id);

    let error = fullError;

    // If that fails (e.g. extended columns missing from schema), fall back to core-only save
    if (fullError) {
      const { error: coreError } = await supabase.from("profiles").update(corePayload).eq("user_id", user.id);
      error = coreError;
      if (!coreError) {
        toast({
          title: "Partially saved",
          description: "Core info saved. Some fields (education, certifications, languages) need a database migration to be saved. Ask your admin to apply the latest migration.",
        });
      }
    }

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      // Mark changed fields as user-sourced
      const changedKeys = Array.from(changedFields).filter(k => k !== "email");
      if (changedKeys.length > 0) {
        try {
          await supabase.rpc("update_profile_data_sources", {
            p_user_id: user.id,
            p_field_names: changedKeys,
            p_source: "user",
          });
        } catch {
          // Graceful degradation
        }
      }
      await refreshProfile();
      setChangedFields(new Set());
      if (!fullError) {
        toast({ title: "Profile updated!", description: "Your changes have been saved." });
      }
    }
    setSaving(false);
  };

  // Profile completeness
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

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold">Profile Settings</h1>
          <p className="text-muted-foreground mt-1">Update your details. This data powers job matching and extension auto-fill.</p>
        </div>

        {/* Profile Completeness */}
        <Card className="shadow-card border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="font-display font-semibold text-sm">Profile Completeness</span>
              <Badge variant={completeness === 100 ? "default" : "secondary"} className={completeness === 100 ? "gradient-primary border-0 text-primary-foreground" : ""}>
                {completeness}%
              </Badge>
            </div>
            <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full gradient-primary transition-all duration-500" style={{ width: `${completeness}%` }} />
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {completenessItems.map(item => (
                <Badge key={item.key} variant="outline" className={`text-xs ${item.done ? "bg-accent/10 text-accent border-accent/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}>
                  {item.done ? "✓" : "✗"} {item.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <User className="h-5 w-5 text-primary" /> Personal Information
            </CardTitle>
            <CardDescription>Your basic contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Full Name
                  <DataSourceBadge source={dataSources.full_name} />
                </Label>
                <Input id="full_name" value={form.full_name} onChange={e => updateField("full_name", e.target.value)} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Email
                </Label>
                <Input id="email" value={form.email} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Phone Number
                  <DataSourceBadge source={dataSources.phone} />
                </Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  value={form.phone}
                  onChange={e => {
                    const val = e.target.value;
                    // Allow "no" or "NO" (case-insensitive) for opt-out, otherwise filter out letters
                    if (val.toLowerCase() === "n" || val.toLowerCase() === "no") {
                      updateField("phone", val);
                    } else {
                      updateField("phone", val.replace(/[a-zA-Z]/g, ""));
                    }
                  }}
                  placeholder="+1 234 567 8900"
                  className={errors.phone ? "border-destructive" : ""}
                />
                {errors.phone && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.phone}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="location" className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Location
                  <DataSourceBadge source={dataSources.location} />
                </Label>
                <Input id="location" value={form.location} onChange={e => updateField("location", e.target.value)} placeholder="New York, NY" />
                <p className="text-xs text-muted-foreground">Used for location-based job matching</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="experience" className="flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" /> Experience (years)
                  <DataSourceBadge source={dataSources.experience_years} />
                </Label>
                <Input id="experience" type="number" min={0} value={form.experience_years} onChange={e => updateField("experience_years", Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company" className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Current Company
                  <DataSourceBadge source={dataSources.current_company} />
                </Label>
                <Input id="company" value={form.current_company} onChange={e => updateField("current_company", e.target.value)} placeholder="Acme Inc." />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="salary" className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" /> Expected Salary
                  <DataSourceBadge source={dataSources.expected_salary} />
                </Label>
                <Input id="salary" value={form.expected_salary} onChange={e => updateField("expected_salary", e.target.value)} placeholder="$80,000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="education" className="flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5" /> Education
                  <DataSourceBadge source={dataSources.education} />
                </Label>
                <Input id="education" value={form.education} onChange={e => updateField("education", e.target.value)} placeholder="BSc Computer Science, MIT 2022" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio / About Me</Label>
              <Textarea id="bio" value={form.bio} onChange={e => updateField("bio", e.target.value)} placeholder="Tell us about yourself..." rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Social Links */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Globe className="h-5 w-5 text-primary" /> Social Links
            </CardTitle>
            <CardDescription>Used by the browser extension for auto-fill</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="linkedin" className="flex items-center gap-1.5">
                <Linkedin className="h-3.5 w-3.5" /> LinkedIn URL
                <DataSourceBadge source={dataSources.linkedin_url} />
              </Label>
              <Input
                id="linkedin"
                value={form.linkedin_url}
                onChange={e => updateField("linkedin_url", e.target.value)}
                placeholder="https://linkedin.com/in/yourprofile"
                className={errors.linkedin_url ? "border-destructive" : ""}
              />
              {errors.linkedin_url && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.linkedin_url}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="github" className="flex items-center gap-1.5">
                <Github className="h-3.5 w-3.5" /> GitHub URL
                <DataSourceBadge source={dataSources.github_url} />
              </Label>
              <Input
                id="github"
                value={form.github_url}
                onChange={e => updateField("github_url", e.target.value)}
                placeholder="https://github.com/yourusername"
                className={errors.github_url ? "border-destructive" : ""}
              />
              {errors.github_url && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.github_url}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="portfolio" className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" /> Portfolio URL
                <DataSourceBadge source={dataSources.portfolio_url} />
              </Label>
              <Input
                id="portfolio"
                value={form.portfolio_url}
                onChange={e => updateField("portfolio_url", e.target.value)}
                placeholder="https://yourportfolio.com"
                className={errors.portfolio_url ? "border-destructive" : ""}
              />
              {errors.portfolio_url && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.portfolio_url}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Skills & Roles */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Sparkles className="h-5 w-5 text-primary" /> Skills & Roles
            </CardTitle>
            <CardDescription>Comma-separated values. These power AI job matching.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="skills" className="flex items-center gap-1.5">
                Skills <DataSourceBadge source={dataSources.skills} />
              </Label>
              <Textarea id="skills" value={form.skills} onChange={e => updateField("skills", e.target.value)} placeholder="React, TypeScript, Node.js, Python..." rows={2} />
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {skills.map((s: string) => <Badge key={s} variant="secondary" className="bg-primary/10 text-primary border-0 text-xs">{s}</Badge>)}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="roles" className="flex items-center gap-1.5">
                Desired Roles <DataSourceBadge source={dataSources.desired_roles} />
              </Label>
              <Textarea id="roles" value={form.desired_roles} onChange={e => updateField("desired_roles", e.target.value)} placeholder="Frontend Developer, Full Stack Engineer..." rows={2} />
              {roles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {roles.map((r: string) => <Badge key={r} variant="secondary" className="bg-accent/10 text-accent border-0 text-xs">{r}</Badge>)}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Award className="h-5 w-5 text-primary" /> Additional Information
            </CardTitle>
            <CardDescription>Certifications, languages, and more</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="certifications" className="flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5" /> Certifications
                <DataSourceBadge source={dataSources.certifications} />
              </Label>
              <Textarea id="certifications" value={form.certifications} onChange={e => updateField("certifications", e.target.value)} placeholder="AWS Certified, PMP, Google Analytics..." rows={2} />
              <p className="text-xs text-muted-foreground">Comma-separated list of certifications</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="languages" className="flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5" /> Languages
                <DataSourceBadge source={dataSources.languages} />
              </Label>
              <Input id="languages" value={form.languages} onChange={e => updateField("languages", e.target.value)} placeholder="English, Spanish, French" />
              <p className="text-xs text-muted-foreground">Comma-separated list of languages you speak</p>
            </div>
          </CardContent>
        </Card>

        {/* CV Summary (read-only display) */}
        {hasValue(profile?.cv_summary) && (
          <Card className="shadow-card border-accent/20 bg-accent/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <FileText className="h-5 w-5 text-accent" /> AI-Generated CV Summary
                <DataSourceBadge source={dataSources.cv_summary} />
              </CardTitle>
              <CardDescription>This was extracted from your uploaded resume</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed bg-muted/30 rounded-md p-4">{profile?.cv_summary}</p>
            </CardContent>
          </Card>
        )}

        {/* Save Button */}
        <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save All Changes</>}
        </Button>
      </div>
    </DashboardLayout>
  );
}

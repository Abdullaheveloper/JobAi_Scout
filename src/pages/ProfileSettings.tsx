import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Save, User, Phone, Linkedin, Github, Mail, Briefcase, Sparkles,
  MapPin, Globe, Building2, GraduationCap, Award,
  Languages, DollarSign, AlertCircle, ShieldCheck, Bot, ImagePlus, Upload, X,
} from "lucide-react";
import { FuzzyAutocompleteInput, locationTaxonomy, skillsTaxonomy } from "@/lib/fuzzy-taxonomy";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import CareerProfileWorkspace from "@/components/profile/CareerProfileWorkspace";
import ResumeSuggestionNotification from "@/components/resume/ResumeSuggestionNotification";
import { useResumeATSAnalysis } from "@/hooks/useResumeATSAnalysis";
import {
  AutofillPreferences, CareerProfile, defaultAutofillPreferences, emptyCareerProfile,
  normalizeAutofillPreferences, normalizeCareerProfile,
} from "@/lib/career-profile";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProfileReadinessCard } from "@/components/profile/ProfileReadinessCard";
import { buildProfileReadinessItems, profileReadinessPercent } from "@/lib/profile-readiness";
import {
  EXPERIENCE_INVALID_MESSAGE,
  SALARY_INVALID_MESSAGE,
  clampExperienceYears,
  formatEducationFlat,
  parseEducationString,
  validateSalary,
} from "../../supabase/functions/_shared/cv-profile-merge.ts";

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
  if (source === "cv_upload") {
    return <Badge variant="outline" className="text-xs bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20 gap-1"><Upload className="h-3 w-3" /> CV</Badge>;
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
  const { t } = useTranslation();
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [profileImageUploading, setProfileImageUploading] = useState(false);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [retryingAts, setRetryingAts] = useState(false);
  const ats = useResumeATSAnalysis(user?.id, profile?.resume_url);
  const autoAtsAttempted = useRef<string | null>(null);
  const { acceptResult: acceptAtsResult, setError: setAtsError } = ats;
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
    commute_to_office: "",
    availability: "",
    work_type: "",
    application_answers: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  const [careerProfile, setCareerProfile] = useState<CareerProfile>(emptyCareerProfile());
  const [autofillPreferences, setAutofillPreferences] = useState<AutofillPreferences>(defaultAutofillPreferences());
  const [skillDraft, setSkillDraft] = useState("");

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
        commute_to_office: (profile as any).commute_to_office || "",
        availability: (profile as any).availability || "",
        work_type: (profile as any).work_type || "",
        application_answers: Object.entries(((profile as any).application_answers || {}) as Record<string, unknown>)
          .map(([question, answer]) => `${question} = ${String(answer)}`)
          .join("\n"),
      });
      const normalizedCareer = normalizeCareerProfile((profile as any).career_profile);
      const flatEducation = String((profile as any).education || "").trim();
      // Hydrate structured education from the flat readiness field when Career Passport is empty.
      if (!normalizedCareer.education.length && flatEducation) {
        const parsed = parseEducationString(flatEducation);
        if (parsed.length) {
          normalizedCareer.education = parsed.map((entry) => ({
            id: crypto.randomUUID?.() || `edu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            institution: entry.institution || "",
            degree: entry.degree || "",
            fieldOfStudy: entry.fieldOfStudy || "",
            location: "",
            startDate: entry.startYear || "",
            endDate: entry.endYear || "",
            grade: entry.grade || "",
            activities: "",
            status: entry.status || "",
            source: "cv",
          }));
        }
      }
      setCareerProfile(normalizedCareer);
      setAutofillPreferences(normalizeAutofillPreferences((profile as any).autofill_preferences));
    }
  }, [profile]);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    const path = (profile as any)?.avatar_url as string | undefined;
    if (!path) {
      setProfileImagePreview(null);
      return;
    }
    if (/^https?:\/\//i.test(path)) {
      setProfileImagePreview(path);
      return;
    }
    supabase.storage.from("profile-assets").download(path).then(({ data, error }) => {
      if (cancelled || error || !data) return;
      objectUrl = URL.createObjectURL(data);
      setProfileImagePreview(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [(profile as any)?.avatar_url]);

  const handleProfileImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    const extension = file.name.toLowerCase().match(/\.(jpe?g|png|webp)$/)?.[1];
    if (!extension || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ title: t("settings.toastImageUnsupportedTitle"), description: t("settings.toastImageUnsupportedBody"), variant: "destructive" });
      return;
    }
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      toast({ title: t("settings.toastImageTooLargeTitle"), description: t("settings.toastImageTooLargeBody"), variant: "destructive" });
      return;
    }
    setProfileImageUploading(true);
    const normalizedExtension = extension === "jpeg" ? "jpg" : extension;
    const filePath = `${user.id}/${Date.now()}_profile.${normalizedExtension}`;
    const { error: uploadError } = await supabase.storage.from("profile-assets").upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      toast({ title: t("settings.toastImageUploadFailed"), description: uploadError.message, variant: "destructive" });
      setProfileImageUploading(false);
      return;
    }
    const { error: profileError } = await supabase.from("profiles").update({ avatar_url: filePath }).eq("user_id", user.id);
    if (profileError) {
      await supabase.storage.from("profile-assets").remove([filePath]);
      toast({ title: t("settings.toastImageSaveFailed"), description: profileError.message, variant: "destructive" });
    } else {
      await refreshProfile();
      toast({ title: t("settings.toastImageUpdatedTitle"), description: t("settings.toastImageUpdatedBody") });
    }
    setProfileImageUploading(false);
  };

  const retryAtsAnalysis = useCallback(async () => {
    const resumePath = profile?.resume_url;
    if (!resumePath || retryingAts) return;
    setRetryingAts(true);
    setAtsError(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-cv", {
        body: { fileName: resumePath.split("/").pop(), filePath: resumePath, forceAts: true, atsOnly: true },
      });
      if (error) throw error;
      const result = (data as { _ats?: unknown } | null)?._ats;
      const failure = result && typeof result === "object" ? (result as { error?: string }).error : undefined;
      if (!acceptAtsResult(result)) throw new Error(failure || t("settings.toastAtsFailed"));
    } catch (error: unknown) {
      setAtsError(error instanceof Error ? error.message : t("settings.toastAtsFailed"));
    } finally {
      setRetryingAts(false);
    }
  }, [acceptAtsResult, profile?.resume_url, retryingAts, setAtsError, t]);

  // Existing resumes uploaded before ATS suggestions were introduced receive
  // one background analysis after the initial lookup confirms no result exists.
  useEffect(() => {
    const resumePath = profile?.resume_url;
    if (!resumePath || !ats.loaded || ats.loading || ats.analysis || ats.error) return;
    if (autoAtsAttempted.current === resumePath) return;
    autoAtsAttempted.current = resumePath;
    void retryAtsAnalysis();
  }, [ats.analysis, ats.error, ats.loaded, ats.loading, profile?.resume_url, retryAtsAnalysis]);

  const updateField = (key: string, value: string | number) => {
    setForm(f => ({ ...f, [key]: value }));
    setChangedFields(prev => new Set(prev).add(key));
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const experienceCalcNote = useMemo(() => {
    const meta = (profile as any)?.field_metadata?.experience_years;
    if (meta && typeof meta === "object" && typeof meta.calcNote === "string") return meta.calcNote as string;
    return "";
  }, [profile]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (form.linkedin_url && !isValidUrl(form.linkedin_url)) errs.linkedin_url = "Invalid URL";
    if (form.github_url && !isValidUrl(form.github_url)) errs.github_url = "Invalid URL";
    if (form.portfolio_url && !isValidUrl(form.portfolio_url)) errs.portfolio_url = "Invalid URL";
    if (form.phone && form.phone.toLowerCase() !== "no" && !/^[+\d\s()-]*$/.test(form.phone)) errs.phone = "Invalid phone format";
    const experienceCheck = clampExperienceYears(form.experience_years);
    if (!experienceCheck.valid) errs.experience_years = experienceCheck.message || EXPERIENCE_INVALID_MESSAGE;
    const salaryCheck = validateSalary(form.expected_salary);
    if (!salaryCheck.valid) errs.expected_salary = salaryCheck.message || SALARY_INVALID_MESSAGE;
    for (const [index, line] of form.application_answers.split("\n").entries()) {
      if (line.trim() && !line.includes("=")) errs.application_answers = `Line ${index + 1} needs: question = answer`;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!user) return;
    if (!validate()) {
      toast({ title: t("settings.toastValidation"), description: t("settings.toastValidationBody"), variant: "destructive" });
      return;
    }
    setSaving(true);

    const experienceCheck = clampExperienceYears(form.experience_years);
    const salaryCheck = validateSalary(form.expected_salary);
    if (!experienceCheck.valid || !salaryCheck.valid) {
      setSaving(false);
      return;
    }

    // Keep flat education (readiness badge) in sync with structured Career Passport entries.
    const structuredFlat = careerProfile.education.length
      ? formatEducationFlat(careerProfile.education.map((entry) => ({
        degree: entry.degree,
        institution: entry.institution,
        startYear: entry.startDate,
        endYear: entry.endDate,
        status: entry.status === "Completed" || entry.status === "Ongoing" ? entry.status : undefined,
        grade: entry.grade,
        fieldOfStudy: entry.fieldOfStudy,
      })))
      : "";
    const educationValue = structuredFlat || form.education.trim() || null;

    const corePayload: Record<string, any> = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      bio: form.bio.trim() || null,
      linkedin_url: form.linkedin_url.trim() || null,
      github_url: form.github_url.trim() || null,
      skills: form.skills ? form.skills.split(",").map(s => s.trim()).filter(Boolean) : [],
      desired_roles: form.desired_roles ? form.desired_roles.split(",").map(s => s.trim()).filter(Boolean) : [],
      experience_years: experienceCheck.value ?? 0,
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
      expected_salary: salaryCheck.raw,
      education: educationValue,
      certifications: form.certifications ? form.certifications.split(",").map(s => s.trim()).filter(Boolean) : [],
      languages: form.languages ? form.languages.split(",").map(s => s.trim()).filter(Boolean) : [],
      work_authorization: form.work_authorization || null,
      willing_to_relocate: form.willing_to_relocate || null,
      commute_to_office: form.commute_to_office || null,
      availability: form.availability.trim() || null,
      work_type: form.work_type || null,
      application_answers: applicationAnswers,
      career_profile: careerProfile,
      autofill_preferences: autofillPreferences,
    };

    const { error: fullError } = await supabase.from("profiles").update({ ...corePayload, ...extendedPayload }).eq("user_id", user.id);
    let error = fullError;

    if (fullError) {
      const { error: coreError } = await supabase.from("profiles").update(corePayload).eq("user_id", user.id);
      error = coreError;
      if (!coreError) {
        toast({
          title: t("settings.toastPartialTitle"),
          description: t("settings.toastPartialBody"),
        });
      }
    }

    if (error) {
      toast({ title: t("settings.toastSaveFailed"), description: error.message, variant: "destructive" });
    } else {
      const changedKeys = [...Array.from(changedFields).filter(k => k !== "email"), "career_profile", "autofill_preferences"];
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
        toast({ title: t("settings.toastUpdatedTitle"), description: t("settings.toastUpdatedBody") });
      }
    }
    setSaving(false);
  };

  const completenessItems = useMemo(
    () => buildProfileReadinessItems(profile, t),
    [profile, t],
  );

  const completeness = useMemo(
    () => profileReadinessPercent(completenessItems),
    [completenessItems],
  );

  const editableSkills = form.skills
    ? form.skills.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const roles = form.desired_roles
    ? form.desired_roles.split(",").map((r) => r.trim()).filter(Boolean)
    : [];
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t("settings.eyebrow")}</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
            <p className="mt-1 text-muted-foreground">{t("settings.subtitle")}</p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("settings.languagePreference")}</p>
                <LanguageSwitcher />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("settings.themePreference")}</p>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </section>

        <ResumeSuggestionNotification
          analysis={ats.analysis}
          loading={ats.loading || retryingAts}
          error={ats.error}
          dismissed={ats.isDismissed}
          onDismiss={ats.dismiss}
          onRetry={profile?.resume_url ? retryAtsAnalysis : undefined}
          retrying={retryingAts}
        />

        {/* ── Profile Completeness ────────────────────────── */}
        <ProfileReadinessCard
          items={completenessItems}
          percent={completeness}
          showHeaderCompleteBadge
        />

        {/* ── Extracted CV Data ───────────────────────────── */}
        {/* ── Personal Information (Cyan) ─────────────────── */}
        <Card className="border-border bg-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <User className="h-5 w-5 text-primary" /> {t("settings.contactBackground")}
            </CardTitle>
            <CardDescription>{t("settings.personalDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/25 bg-slate-950/40 text-xl font-bold text-cyan-200">
                {profileImagePreview ? <img src={profileImagePreview} alt={t("settings.profileImage")} className="h-full w-full object-cover" /> : <ImagePlus className="h-7 w-7" aria-hidden="true" />}
              </div>
              <div className="min-w-0 flex-1">
                <Label htmlFor="profile-image" className={`font-semibold ${P.titleColor}`}>{t("settings.profileImage")}</Label>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("settings.profileImageHint")}</p>
                <input id="profile-image" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="sr-only" onChange={handleProfileImageUpload} />
                <Button type="button" variant="outline" size="sm" className="mt-3 gap-2" disabled={profileImageUploading} asChild={!profileImageUploading}>
                  {profileImageUploading ? <span><Loader2 className="h-4 w-4 animate-spin" />{t("settings.uploading")}</span> : <label htmlFor="profile-image" className="cursor-pointer"><Upload className="h-4 w-4" />{profileImagePreview ? t("settings.replaceImage") : t("settings.uploadImage")}</label>}
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name" className={`flex items-center gap-1.5 ${P.titleColor}`}>
                  <User className="h-3.5 w-3.5" /> {t("settings.fullName")}
                  <DataSourceBadge source={dataSources.full_name} />
                </Label>
                <ColorInput id="full_name" value={form.full_name} onChange={e => updateField("full_name", e.target.value)} placeholder={t("settings.placeholderName")} inputFocus={P.inputFocus} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> {t("settings.email")}
                </Label>
                <Input id="email" type="email" value={form.email} disabled className="border-border bg-muted/50 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{t("settings.emailLocked")}</p>
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
                  type="tel"
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
                  placeholder={t("settings.placeholderPhone")}
                  inputFocus={P.inputFocus}
                  className={errors.phone ? "border-rose-400/50" : ""}
                />
                {errors.phone && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.phone}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="location" className={`flex items-center gap-1.5 ${P.titleColor}`}>
                  <MapPin className="h-3.5 w-3.5" /> {t("settings.location")}
                  <DataSourceBadge source={dataSources.location} />
                </Label>
                <FuzzyAutocompleteInput
                  id="location"
                  taxonomy={locationTaxonomy}
                  value={form.location}
                  onChange={(value) => updateField("location", value)}
                  onCommit={(canonical) => updateField("location", canonical)}
                  placeholder={t("settings.placeholderLocation")}
                  aria-label={t("settings.location")}
                  inputClassName={`transition-all duration-300 bg-background border-border focus:shadow-lg ${P.inputFocus}`}
                />
                <p className="text-xs text-muted-foreground">Used for location-based job matching</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="experience" className={`flex items-center gap-1.5 ${P.titleColor}`}>
                  <Briefcase className="h-3.5 w-3.5" /> Experience (years)
                  <DataSourceBadge source={dataSources.experience_years} />
                </Label>
                <ColorInput
                  id="experience"
                  type="number"
                  min={0}
                  max={40}
                  step={0.1}
                  value={form.experience_years}
                  onChange={e => updateField("experience_years", Number(e.target.value))}
                  inputFocus={P.inputFocus}
                  className={errors.experience_years ? "border-rose-400/50" : ""}
                />
                {errors.experience_years && (
                  <p className="text-xs text-rose-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />{errors.experience_years}
                  </p>
                )}
                {experienceCalcNote && (
                  <p className="text-xs text-muted-foreground">{experienceCalcNote}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="company" className={`flex items-center gap-1.5 ${P.titleColor}`}>
                  <Building2 className="h-3.5 w-3.5" /> Current Company
                  <DataSourceBadge source={dataSources.current_company} />
                </Label>
                <ColorInput id="company" value={form.current_company} onChange={e => updateField("current_company", e.target.value)} placeholder={t("settings.placeholderCompany")} inputFocus={P.inputFocus} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="salary" className={`flex items-center gap-1.5 ${P.titleColor}`}>
                  <DollarSign className="h-3.5 w-3.5" /> Expected Salary
                  <DataSourceBadge source={dataSources.expected_salary} />
                </Label>
                <ColorInput
                  id="salary"
                  value={form.expected_salary}
                  onChange={e => updateField("expected_salary", e.target.value)}
                  placeholder={t("settings.placeholderSalary")}
                  inputFocus={P.inputFocus}
                  className={errors.expected_salary ? "border-rose-400/50" : ""}
                />
                {errors.expected_salary && (
                  <p className="text-xs text-rose-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />{errors.expected_salary}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Must be greater than 10,000</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="education" className={`flex items-center gap-1.5 ${P.titleColor}`}>
                  <GraduationCap className="h-3.5 w-3.5" /> Education
                  <DataSourceBadge source={dataSources.education} />
                </Label>
                <ColorInput
                  id="education"
                  value={form.education}
                  onChange={e => updateField("education", e.target.value)}
                  placeholder={t("settings.placeholderEducation")}
                  inputFocus={P.inputFocus}
                />
                <p className="text-xs text-muted-foreground">
                  Used for readiness. Structured degree rows live in Career Passport below
                  {careerProfile.education.length ? ` (${careerProfile.education.length} entr${careerProfile.education.length === 1 ? "y" : "ies"})` : ""}.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio" className={P.titleColor}>Bio / About Me</Label>
              <ColorTextarea id="bio" value={form.bio} onChange={e => updateField("bio", e.target.value)} placeholder={t("settings.placeholderBio")} rows={3} inputFocus={P.inputFocus} />
            </div>
          </CardContent>
        </Card>

        {/* ── Social Links (Violet) ───────────────────────── */}
        <Card className="border-border bg-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Globe className="h-5 w-5 text-primary" /> Professional links
            </CardTitle>
            <CardDescription>{t("settings.extensionAutofillHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="linkedin" className={`flex items-center gap-1.5 ${S.titleColor}`}>
                <Linkedin className="h-3.5 w-3.5" /> LinkedIn URL
                <DataSourceBadge source={dataSources.linkedin_url} />
              </Label>
              <ColorInput
                id="linkedin"
                type="url"
                value={form.linkedin_url}
                onChange={e => updateField("linkedin_url", e.target.value)}
                placeholder={t("settings.placeholderLinkedin")}
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
                type="url"
                value={form.github_url}
                onChange={e => updateField("github_url", e.target.value)}
                placeholder={t("settings.placeholderGithub")}
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
                type="url"
                value={form.portfolio_url}
                onChange={e => updateField("portfolio_url", e.target.value)}
                placeholder={t("settings.placeholderPortfolio")}
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
            <CardDescription>{t("settings.skillsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="skills" className={`flex items-center gap-1.5 ${K.titleColor}`}>
                Skills <DataSourceBadge source={dataSources.skills} />
              </Label>
              <FuzzyAutocompleteInput
                id="skills"
                taxonomy={skillsTaxonomy}
                value={skillDraft}
                onChange={setSkillDraft}
                clearOnCommit
                placeholder={t("settings.placeholderSkills")}
                inputClassName={K.inputFocus}
                onCommit={(canonical) => {
                  const existing = form.skills
                    ? form.skills.split(",").map((s) => s.trim()).filter(Boolean)
                    : [];
                  if (existing.some((s) => s.toLowerCase() === canonical.toLowerCase())) {
                    setSkillDraft("");
                    return;
                  }
                  updateField("skills", [...existing, canonical].join(", "));
                  setSkillDraft("");
                }}
              />
              {editableSkills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {editableSkills.map((s: string) => (
                    <Badge
                      key={s}
                      variant="secondary"
                      className="gap-1 bg-emerald-500/15 text-emerald-300 border-emerald-500/20 text-xs"
                    >
                      {s}
                      <button
                        type="button"
                        aria-label={`Remove ${s}`}
                        className="rounded-sm opacity-70 hover:opacity-100"
                        onClick={() => {
                          updateField(
                            "skills",
                            editableSkills.filter((item) => item !== s).join(", "),
                          );
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Select a suggestion or press Enter to add. Canonical names are preferred when matched.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="roles" className={`flex items-center gap-1.5 ${K.titleColor}`}>
                Desired Roles <DataSourceBadge source={dataSources.desired_roles} />
              </Label>
              <ColorTextarea id="roles" value={form.desired_roles} onChange={e => updateField("desired_roles", e.target.value)} placeholder={t("settings.placeholderRoles")} rows={2} inputFocus={K.inputFocus} />
              {roles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {roles.map((r: string) => (
                    <Badge key={r} variant="secondary" className="bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20 text-xs">{r}</Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Additional Info (Amber) ─────────────────────── */}
        <CareerProfileWorkspace
          value={careerProfile}
          onChange={(next) => {
            setCareerProfile(next);
            setChangedFields((current) => new Set(current).add("career_profile"));
          }}
        />

        <Card className="border-border bg-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Award className="h-5 w-5 text-primary" /> Credentials
            </CardTitle>
            <CardDescription>{t("settings.additionalDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="certifications" className={`flex items-center gap-1.5 ${A.titleColor}`}>
                <Award className="h-3.5 w-3.5" /> Certifications
                <DataSourceBadge source={dataSources.certifications} />
              </Label>
              <ColorTextarea id="certifications" value={form.certifications} onChange={e => updateField("certifications", e.target.value)} placeholder={t("settings.placeholderCerts")} rows={2} inputFocus={A.inputFocus} />
              <p className="text-xs text-muted-foreground">Comma-separated list of certifications</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="languages" className={`flex items-center gap-1.5 ${A.titleColor}`}>
                <Languages className="h-3.5 w-3.5" /> Languages
                <DataSourceBadge source={dataSources.languages} />
              </Label>
              <ColorInput id="languages" value={form.languages} onChange={e => updateField("languages", e.target.value)} placeholder={t("settings.placeholderLanguages")} inputFocus={A.inputFocus} />
              <p className="text-xs text-muted-foreground">Comma-separated list of languages you speak</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display"><ShieldCheck className="h-5 w-5 text-primary" /> Application autofill</CardTitle>
            <CardDescription>{t("settings.autofillHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="work_authorization" className="text-foreground">{t("settings.workAuthorization")}</Label><select id="work_authorization" value={form.work_authorization} onChange={e => updateField("work_authorization", e.target.value)} className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400/60"><option value="">{t("settings.chooseAnswer")}</option><option value="yes">{t("settings.authorized")}</option><option value="no">{t("settings.notAuthorized")}</option></select></div>
              <div className="space-y-2"><Label htmlFor="willing_to_relocate" className="text-foreground">{t("settings.willingToRelocate")}</Label><select id="willing_to_relocate" value={form.willing_to_relocate} onChange={e => updateField("willing_to_relocate", e.target.value)} className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400/60"><option value="">{t("settings.chooseAnswer")}</option><option value="yes">{t("common.yes")}</option><option value="no">{t("common.no")}</option></select></div>
              <div className="space-y-2"><Label htmlFor="work_type" className="text-foreground">Work preference</Label><select id="work_type" value={form.work_type} onChange={e => updateField("work_type", e.target.value)} className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400/60"><option value="">Choose a preference</option><option value="onsite">On-site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></div>
              <div className="space-y-2"><Label htmlFor="commute_to_office" className="text-foreground">{t("settings.commute")}</Label><select id="commute_to_office" value={form.commute_to_office} onChange={e => updateField("commute_to_office", e.target.value)} className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400/60"><option value="">{t("settings.chooseAnswer")}</option><option value="yes">{t("common.yes")}</option><option value="no">{t("common.no")}</option><option value="depends">{t("settings.dependsLocation")}</option></select></div>
              <div className="space-y-2"><Label htmlFor="availability" className="text-foreground">{t("settings.availability")}</Label><ColorInput id="availability" value={form.availability} onChange={e => updateField("availability", e.target.value)} placeholder={t("settings.placeholderAvailability")} inputFocus="focus-visible:ring-indigo-400/60" /></div>
            </div>
            <div className="grid gap-4 rounded-xl border border-primary/20 bg-primary/[0.04] p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="space-y-2"><Label htmlFor="text-confidence" className="text-foreground">Text-field confidence</Label><Input id="text-confidence" type="number" min="0.75" max="1" step="0.01" value={autofillPreferences.textAutofillConfidence} onChange={event => setAutofillPreferences(current => ({ ...current, textAutofillConfidence: Math.min(1, Math.max(0.75, Number(event.target.value) || 0.75)) }))} className="border-border bg-background" /><p className="text-xs text-muted-foreground">Safe text fields are filled at or above this evidence score.</p></div>
              <div className="space-y-2"><Label htmlFor="checkbox-confidence" className="text-foreground">Non-sensitive checkbox threshold</Label><Input id="checkbox-confidence" type="number" min="0.41" max="1" step="0.01" value={autofillPreferences.checkboxConfidence} onChange={event => setAutofillPreferences(current => ({ ...current, checkboxConfidence: Math.min(1, Math.max(0.41, Number(event.target.value) || 0.41)) }))} className="border-border bg-background" /><p className="text-xs text-muted-foreground">40% is the minimum suggestion threshold; direct evidence is still required.</p></div>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm"><Switch checked={autofillPreferences.reviewBeforeSensitiveAnswers} onCheckedChange={checked => setAutofillPreferences(current => ({ ...current, reviewBeforeSensitiveAnswers: checked }))} /><span>Review sensitive suggestions</span></label>
            </div>
            <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-4 py-3 text-sm leading-6 text-amber-100/90"><strong>Always manual:</strong> terms, privacy consent, declarations, diversity/self-identification, CAPTCHA, verification codes, assessments, and final submission. The extension can explain a suggestion but will never click them.</div>
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
              <><Loader2 className="me-2 h-4 w-4 animate-spin" /> {t("settings.saving")}</>
            ) : (
              <><Save className="me-2 h-4 w-4" /> {t("settings.saveChanges")}</>
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

import { useState, useCallback, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import ExtractedDataCard from "@/components/ExtractedDataCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { hasValue } from "@/lib/constants";
import {
  type ExtractedData,
  type ProfileLike,
  profileToExtractedData,
  hasExtractedCvData,
  normalizeExtractedData,
  buildProfileUpdateFromExtracted,
  applyProfileUpdate,
} from "@/lib/cv-extracted-data";
import {
  FileUp, Loader2, Sparkles, CheckCircle2, Upload, MapPin, Mail, Phone,
  Linkedin, Github, FileText, Globe, Building2, GraduationCap, Award,
  Languages, ArrowRight, ShieldCheck, ExternalLink, AlertTriangle,
} from "lucide-react";
import { Link } from "react-router-dom";

type MergeField = {
  key: string;
  label: string;
  icon: React.ElementType;
  existing: string;
  extracted: string;
  action: "fill" | "keep" | "skip";
};

function formatValue(val: unknown): string {
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "number") return val > 0 ? String(val) : "";
  return (val as string) || "";
}

export default function CVUpload() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [mergeFields, setMergeFields] = useState<MergeField[]>([]);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [extractionInfo, setExtractionInfo] = useState<{
    method: string;
    pages: number;
    ocrUsed: boolean;
    charCount: number;
  } | null>(null);

  useEffect(() => {
    if (user) refreshProfile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Profile completeness calculation
  const completionInfo = useMemo(() => {
    if (!profile) return { percent: 0, fields: [], missing: [] };
    const checks = [
      { key: "full_name", label: "Name", done: hasValue(profile.full_name) },
      { key: "email", label: "Email", done: hasValue(profile.email) },
      { key: "phone", label: "Phone", done: hasValue(profile.phone) },
      { key: "location", label: "Location", done: hasValue(profile.location) },
      { key: "bio", label: "Bio", done: hasValue(profile.bio) },
      { key: "skills", label: "Skills", done: hasValue(profile.skills) },
      { key: "desired_roles", label: "Roles", done: hasValue(profile.desired_roles) },
      { key: "experience_years", label: "Experience", done: hasValue(profile.experience_years) },
      { key: "resume_url", label: "Resume", done: hasValue(profile.resume_url) },
      { key: "linkedin_url", label: "LinkedIn", done: hasValue(profile.linkedin_url) },
      { key: "github_url", label: "GitHub", done: hasValue(profile.github_url) },
      { key: "portfolio_url", label: "Portfolio", done: hasValue((profile as any).portfolio_url) },
      { key: "current_company", label: "Company", done: hasValue((profile as any).current_company) },
      { key: "education", label: "Education", done: hasValue((profile as any).education) },
    ];
    const done = checks.filter(c => c.done);
    const missing = checks.filter(c => !c.done);
    return { percent: Math.round((done.length / checks.length) * 100), fields: checks, missing };
  }, [profile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.type === "application/pdf" || dropped.name.endsWith(".docx") || dropped.name.endsWith(".doc"))) {
      setFile(dropped);
      setExtractedData(null);
      setMergeFields([]);
      setApplied(false);
      setExtractionInfo(null);
    } else {
      toast({ title: "Invalid file", description: "Please upload a PDF or DOCX file.", variant: "destructive" });
    }
  }, [toast]);

  // Build merge plan: only fill fields that are currently empty
  const buildMergePlan = useCallback((data: ExtractedData, profileSnapshot: ProfileLike | null) => {
    const p = profileSnapshot || {};
    const fields: MergeField[] = [
      { key: "full_name", label: "Full Name", icon: FileUp, existing: formatValue(p.full_name), extracted: data.fullName || "", action: !hasValue(p.full_name) && hasValue(data.fullName) ? "fill" : "keep" },
      { key: "email", label: "Email", icon: Mail, existing: formatValue(p.email), extracted: data.email || "", action: !hasValue(p.email) && hasValue(data.email) ? "fill" : "keep" },
      { key: "phone", label: "Phone", icon: Phone, existing: formatValue(p.phone), extracted: data.phone || "", action: !hasValue(p.phone) && hasValue(data.phone) ? "fill" : "keep" },
      { key: "location", label: "Location", icon: MapPin, existing: formatValue(p.location), extracted: data.location || "", action: !hasValue(p.location) && hasValue(data.location) ? "fill" : "keep" },
      { key: "linkedin_url", label: "LinkedIn", icon: Linkedin, existing: formatValue(p.linkedin_url), extracted: data.linkedinUrl || "", action: !hasValue(p.linkedin_url) && hasValue(data.linkedinUrl) ? "fill" : "keep" },
      { key: "github_url", label: "GitHub", icon: Github, existing: formatValue(p.github_url), extracted: data.githubUrl || "", action: !hasValue(p.github_url) && hasValue(data.githubUrl) ? "fill" : "keep" },
      { key: "portfolio_url", label: "Portfolio", icon: Globe, existing: formatValue(p.portfolio_url), extracted: data.portfolioUrl || "", action: !hasValue(p.portfolio_url) && hasValue(data.portfolioUrl) ? "fill" : "keep" },
      { key: "current_company", label: "Company", icon: Building2, existing: formatValue(p.current_company), extracted: data.currentCompany || "", action: !hasValue(p.current_company) && hasValue(data.currentCompany) ? "fill" : "keep" },
      { key: "experience_years", label: "Experience (yrs)", icon: FileText, existing: formatValue(p.experience_years), extracted: String(data.experienceYears || ""), action: !hasValue(p.experience_years) && hasValue(data.experienceYears) ? "fill" : "keep" },
      { key: "skills", label: "Skills", icon: Sparkles, existing: formatValue(p.skills), extracted: (data.skills || []).join(", "), action: !hasValue(p.skills) && hasValue(data.skills) ? "fill" : "keep" },
      { key: "desired_roles", label: "Target Roles", icon: FileText, existing: formatValue(p.desired_roles), extracted: (data.suggestedRoles || []).join(", "), action: !hasValue(p.desired_roles) && hasValue(data.suggestedRoles) ? "fill" : "keep" },
      { key: "education", label: "Education", icon: GraduationCap, existing: formatValue(p.education), extracted: data.education || "", action: !hasValue(p.education) && hasValue(data.education) ? "fill" : "keep" },
      { key: "certifications", label: "Certifications", icon: Award, existing: formatValue(p.certifications), extracted: (data.certifications || []).join(", "), action: !hasValue(p.certifications) && hasValue(data.certifications) ? "fill" : "keep" },
      { key: "languages", label: "Languages", icon: Languages, existing: formatValue((p.languages)), extracted: (data.languages || []).join(", "), action: !hasValue(p.languages) && hasValue(data.languages) ? "fill" : "keep" },
      { key: "cv_summary", label: "CV Summary", icon: FileText, existing: formatValue(p.cv_summary), extracted: data.cvSummary || "", action: !hasValue(p.cv_summary) && hasValue(data.cvSummary) ? "fill" : "keep" },
    ];
    return fields.map(f => ({
      ...f,
      action: f.action === "keep" && !f.extracted ? "skip" as const : f.action,
    }));
  }, []);

  const handleUploadAndAnalyze = async () => {
    if (!file || !user) return;
    setUploading(true);

    // Upload to storage
    const filePath = `${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("resumes").upload(filePath, file);
    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    // Update profile with resume URL
    await supabase.from("profiles").update({ resume_url: filePath }).eq("user_id", user.id);

    setUploading(false);
    setAnalyzing(true);

    // Call AI analysis edge function
    try {
      const { data, error } = await supabase.functions.invoke("analyze-cv", {
        body: { fileName: file.name, filePath },
      });

      if (error) throw error;

      if (data) {
        const raw = data as Record<string, unknown> & {
          _extraction?: { method: string; pages: number; ocrUsed: boolean; charCount: number };
          _saved?: { count: number; keys: string[] };
        };
        const { _extraction, _saved, ...rawExtracted } = raw;
        const extracted = normalizeExtractedData(rawExtracted);

        if (_extraction) setExtractionInfo(_extraction);
        setExtractedData(extracted);

        // Fetch fresh profile directly (avoid stale React state in merge plan)
        const { data: freshProfile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (profileError) {
          console.error("Failed to fetch profile:", profileError.message);
        }

        const plan = buildMergePlan(extracted, freshProfile);
        setMergeFields(plan);

        setApplying(true);
        let savedKeys = _saved?.keys ?? [];
        let saveFailed = false;

        if (savedKeys.length === 0) {
          const { updatePayload, filledKeys } = buildProfileUpdateFromExtracted(freshProfile, extracted);
          if (filledKeys.length > 0) {
            const { error: saveError, savedKeys: clientSaved } = await applyProfileUpdate(
              user.id,
              updatePayload,
              filledKeys,
            );

            if (saveError) {
              console.error("Profile update failed:", saveError);
              toast({ title: "Auto-fill failed", description: saveError, variant: "destructive" });
              saveFailed = true;
            } else {
              savedKeys = clientSaved;
            }
          }
        }

        setApplying(false);

        if (saveFailed) return;

        if (savedKeys.length > 0) {
          await refreshProfile();
          setApplied(true);
          toast({
            title: "Profile auto-filled!",
            description: `${savedKeys.length} field(s) extracted from your CV and added to your profile.`,
          });
        } else if (hasExtractedCvData(extracted)) {
          toast({
            title: "No profile changes",
            description: "Extracted CV data is shown below. Empty profile fields were already filled or could not be saved.",
          });
        } else {
          toast({
            title: "No data extracted",
            description: "The AI could not find usable fields in your resume.",
            variant: "destructive",
          });
        }
      }
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message || "Could not analyze CV", variant: "destructive" });
    }
    setAnalyzing(false);
  };

  const profileExtractedData = profileToExtractedData(profile);
  const displayExtractedData = extractedData ?? profileExtractedData;
  const showExtractedData = hasExtractedCvData(displayExtractedData);
  const dataSources = (profile?.data_sources as Record<string, string>) || {};

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
        <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card px-6 py-7 sm:px-8">
          <Badge variant="outline" className="mb-3 border-primary/25 bg-primary/10 text-primary">Step 1 of 2 · Your profile</Badge>
          <h1 className="font-display text-3xl font-bold tracking-tight">Bring your CV to life.</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Upload one resume and we will extract the information that improves job matching and application autofill.</p>
        </section>

        {/* Profile Completion Bar */}
        <Card className="border-border bg-card shadow-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="font-display font-semibold text-sm">Profile readiness</span>
              <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
                {completionInfo.percent}%
              </Badge>
            </div>
            <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${completionInfo.percent}%`,
                  background: completionInfo.percent === 100
                    ? "linear-gradient(90deg, #10b981, #34d399, #6ee7b7)"
                    : "linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)",
                }}
              />
            </div>
            {completionInfo.missing.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {completionInfo.fields.map(item => (
                  <Badge key={item.key} variant="outline" className={`text-xs ${item.done ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25" : "bg-rose-500/10 text-rose-300 border-rose-500/25"}`}>
                    {item.done ? "✓" : "✗"} {item.label}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Section */}
        <Card className="overflow-hidden border-border bg-card shadow-card">
          <CardHeader className="border-b border-border/70 bg-muted/20">
            <CardTitle className="flex items-center gap-2 font-display">
              <Upload className="h-5 w-5 text-primary" /> Upload your resume
            </CardTitle>
            <CardDescription>
              Supported formats: PDF, DOCX — text is extracted (PyMuPDF / pdfplumber / OCR), then AI fills your profile without overwriting existing info
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer sm:p-12 ${
                dragOver ? "border-primary bg-primary/10" : "border-border bg-muted/20 hover:border-primary/50 hover:bg-primary/[0.03]"
              }`}
              onClick={() => document.getElementById("cv-input")?.click()}
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><FileUp className="h-6 w-6 text-primary" /></div>
              <p className="text-base font-semibold">{file ? file.name : "Drop your CV here"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{file ? "Ready for AI review" : "or click to choose a PDF or DOCX"}</p>
              <input
                id="cv-input"
                type="file"
                accept=".pdf,.docx,.doc"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setFile(e.target.files[0]);
                    setExtractedData(null);
                    setMergeFields([]);
                    setApplied(false);
                    setExtractionInfo(null);
                  }
                }}
              />
            </div>

            {file && !extractedData && (
              <Button onClick={handleUploadAndAnalyze} disabled={uploading || analyzing} className="mt-4 w-full sm:w-auto">
                {uploading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
                ) : analyzing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> AI Analyzing...</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" /> Upload & Analyze with AI</>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* ── Fresh Extracted Data (just uploaded) ─────────── */}
        {extractionInfo && (
          <Card className="shadow-card border-emerald-400/20 bg-gradient-to-r from-emerald-500/8 to-transparent">
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/25">
                  Text extraction: {extractionInfo.method}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {extractionInfo.pages} page{extractionInfo.pages === 1 ? "" : "s"}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {extractionInfo.charCount.toLocaleString()} chars
                </Badge>
                {extractionInfo.ocrUsed && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/25">
                    OCR used
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {extractedData && mergeFields.length > 0 && (
          <>
            {/* Merge Review */}
            <Card className="shadow-card border-cyan-400/20 bg-gradient-to-br from-cyan-500/8 via-cyan-500/2 to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-cyan-400">
                  <ShieldCheck className="h-5 w-5" /> Merge Review
                </CardTitle>
                <CardDescription className="text-cyan-200/40">
                  Data from your CV is being auto-filled into your profile. Existing data is preserved.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {applying && (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm font-medium">Auto-filling your profile...</span>
                  </div>
                )}
                {mergeFields.filter(f => f.action !== "skip").map((field) => {
                  const Icon = field.icon;
                  return (
                    <div key={field.key} className={`flex items-start gap-3 rounded-lg p-3 border ${field.action === "fill" ? "border-cyan-400/40 bg-cyan-500/5" : "border-white/[0.06] bg-[#0d1230]/50"}`}>
                      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-slate-200">{field.label}</span>
                          {field.action === "fill" ? (
                            <Badge variant="secondary" className="bg-cyan-500/15 text-cyan-300 border-0 text-xs gap-1">
                              <ArrowRight className="h-3 w-3" /> Auto-filled
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs gap-1 border-emerald-500/20 text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" /> Already set
                            </Badge>
                          )}
                        </div>
                        {field.action === "fill" && field.extracted && (
                          <p className="text-sm text-cyan-200 truncate">{field.extracted}</p>
                        )}
                        {field.action === "keep" && field.existing && (
                          <p className="text-sm text-slate-400 truncate">{field.existing}</p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {mergeFields.filter(f => f.action === "fill").length === 0 && (
                  <div className="text-center py-4">
                    <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
                    <p className="font-medium text-slate-200">All extracted data already exists in your profile!</p>
                    <p className="text-sm text-muted-foreground">No changes needed.</p>
                  </div>
                )}

                <div className="pt-3 border-t border-white/[0.06]">
                  <span className="text-sm text-slate-400">
                    {mergeFields.filter(f => f.action === "fill").length} field(s) auto-filled • {mergeFields.filter(f => f.action === "keep").length} field(s) preserved
                  </span>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Post-Merge Results ──────────────────────────── */}
        {applied && (
          <>
            <Card className="shadow-card border-success/30 bg-gradient-to-br from-emerald-500/8 via-emerald-500/2 to-transparent">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <span className="font-display font-semibold text-emerald-300">Profile Updated</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">New Completion</span>
                  <Badge variant="default" className="gradient-primary border-0">
                    {completionInfo.percent}%
                  </Badge>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full gradient-primary transition-all duration-500" style={{ width: `${completionInfo.percent}%` }} />
                </div>
              </CardContent>
            </Card>

            {/* Missing fields prompt */}
            {completionInfo.missing.length > 0 && (
              <Card className="shadow-card border-amber-400/20 bg-gradient-to-br from-amber-500/8 via-amber-500/2 to-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display text-base text-amber-400">
                    <AlertTriangle className="h-5 w-5" /> Remaining Gaps
                  </CardTitle>
                  <CardDescription className="text-amber-200/40">Complete these fields for better job matching and auto-fill</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {completionInfo.missing.map(f => (
                      <Badge key={f.key} variant="outline" className="bg-rose-500/10 text-rose-300 border-rose-500/25 text-xs">
                        ✗ {f.label}
                      </Badge>
                    ))}
                  </div>
                  <Button asChild variant="outline" className="w-full border-violet-400/30 hover:border-violet-400/60">
                    <Link to="/dashboard/settings">
                      <ExternalLink className="mr-2 h-4 w-4" /> Complete Profile in Settings
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ── Extracted CV Data (always visible when available) ─────── */}
        {showExtractedData && (
          <ExtractedDataCard
            data={displayExtractedData}
            title={extractedData ? "Extracted Data from Resume" : "Extracted CV Data"}
            description={
              extractedData
                ? "Data automatically extracted from your resume by AI (OpenRouter + Gemini 2.5 Flash)"
                : "Your profile data from CV extraction. Edit fields in Profile Settings."
            }
            dataSources={dataSources}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

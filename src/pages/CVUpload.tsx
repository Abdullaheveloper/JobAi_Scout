import { useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  FileUp, Loader2, Sparkles, CheckCircle2, Upload, MapPin, Mail, Phone,
  Linkedin, Github, FileText, Globe, Building2, GraduationCap, Award,
  Languages, ArrowRight, ShieldCheck, AlertTriangle, ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";

// Priority: USER_UPDATED > VERIFIED > AI_EXTRACTED > EMPTY
// We never overwrite a non-empty existing value with an empty or AI-extracted one
type ExtractedData = {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  currentCompany?: string;
  skills?: string[];
  suggestedRoles?: string[];
  experienceYears?: number;
  education?: string;
  certifications?: string[];
  languages?: string[];
  cvSummary?: string;
};

type MergeField = {
  key: string;
  label: string;
  icon: React.ElementType;
  existing: string;
  extracted: string;
  action: "fill" | "keep" | "skip";
};

function hasValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "string") return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "number") return val > 0;
  return false;
}

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
    } else {
      toast({ title: "Invalid file", description: "Please upload a PDF or DOCX file.", variant: "destructive" });
    }
  }, [toast]);

  // Build merge plan: only fill fields that are currently empty
  const buildMergePlan = useCallback((data: ExtractedData) => {
    const p = profile || {};
    const fields: MergeField[] = [
      { key: "full_name", label: "Full Name", icon: FileUp, existing: formatValue(p.full_name), extracted: data.fullName || "", action: !hasValue(p.full_name) && hasValue(data.fullName) ? "fill" : "keep" },
      { key: "email", label: "Email", icon: Mail, existing: formatValue(p.email), extracted: data.email || "", action: !hasValue(p.email) && hasValue(data.email) ? "fill" : "keep" },
      { key: "phone", label: "Phone", icon: Phone, existing: formatValue(p.phone), extracted: data.phone || "", action: !hasValue(p.phone) && hasValue(data.phone) ? "fill" : "keep" },
      { key: "location", label: "Location", icon: MapPin, existing: formatValue(p.location), extracted: data.location || "", action: !hasValue(p.location) && hasValue(data.location) ? "fill" : "keep" },
      { key: "linkedin_url", label: "LinkedIn", icon: Linkedin, existing: formatValue(p.linkedin_url), extracted: data.linkedinUrl || "", action: !hasValue(p.linkedin_url) && hasValue(data.linkedinUrl) ? "fill" : "keep" },
      { key: "github_url", label: "GitHub", icon: Github, existing: formatValue(p.github_url), extracted: data.githubUrl || "", action: !hasValue(p.github_url) && hasValue(data.githubUrl) ? "fill" : "keep" },
      { key: "portfolio_url", label: "Portfolio", icon: Globe, existing: formatValue((p as any).portfolio_url), extracted: data.portfolioUrl || "", action: !hasValue((p as any).portfolio_url) && hasValue(data.portfolioUrl) ? "fill" : "keep" },
      { key: "current_company", label: "Company", icon: Building2, existing: formatValue((p as any).current_company), extracted: data.currentCompany || "", action: !hasValue((p as any).current_company) && hasValue(data.currentCompany) ? "fill" : "keep" },
      { key: "experience_years", label: "Experience (yrs)", icon: FileText, existing: formatValue(p.experience_years), extracted: String(data.experienceYears || ""), action: !hasValue(p.experience_years) && hasValue(data.experienceYears) ? "fill" : "keep" },
      { key: "skills", label: "Skills", icon: Sparkles, existing: formatValue(p.skills), extracted: (data.skills || []).join(", "), action: !hasValue(p.skills) && hasValue(data.skills) ? "fill" : "keep" },
      { key: "desired_roles", label: "Target Roles", icon: FileText, existing: formatValue(p.desired_roles), extracted: (data.suggestedRoles || []).join(", "), action: !hasValue(p.desired_roles) && hasValue(data.suggestedRoles) ? "fill" : "keep" },
      { key: "education", label: "Education", icon: GraduationCap, existing: formatValue((p as any).education), extracted: data.education || "", action: !hasValue((p as any).education) && hasValue(data.education) ? "fill" : "keep" },
      { key: "certifications", label: "Certifications", icon: Award, existing: formatValue((p as any).certifications), extracted: (data.certifications || []).join(", "), action: !hasValue((p as any).certifications) && hasValue(data.certifications) ? "fill" : "keep" },
      { key: "languages", label: "Languages", icon: Languages, existing: formatValue((p as any).languages), extracted: (data.languages || []).join(", "), action: !hasValue((p as any).languages) && hasValue(data.languages) ? "fill" : "keep" },
      { key: "cv_summary", label: "CV Summary", icon: FileText, existing: formatValue(p.cv_summary), extracted: data.cvSummary || "", action: !hasValue(p.cv_summary) && hasValue(data.cvSummary) ? "fill" : "keep" },
    ];
    // Mark fields with nothing to do as "skip"
    return fields.map(f => ({
      ...f,
      action: f.action === "keep" && !f.extracted ? "skip" as const : f.action,
    }));
  }, [profile]);

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

    // Update profile with resume URL (always update - it's the new resume)
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
        setExtractedData(data as ExtractedData);
        const plan = buildMergePlan(data as ExtractedData);
        setMergeFields(plan);
        await refreshProfile();
      }
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message || "Could not analyze CV", variant: "destructive" });
    }
    setAnalyzing(false);
  };

  // Apply merge: only write fields marked as "fill"
  const handleApplyMerge = async () => {
    if (!user) return;
    setApplying(true);

    const fieldsToFill = mergeFields.filter(f => f.action === "fill");
    if (fieldsToFill.length === 0) {
      toast({ title: "Nothing to merge", description: "All extracted data already exists in your profile." });
      setApplying(false);
      setApplied(true);
      return;
    }

    // Build update payload - only for empty fields
    const updatePayload: Record<string, any> = {};
    const filledKeys: string[] = [];

    for (const field of fieldsToFill) {
      const d = extractedData;
      if (!d) continue;
      switch (field.key) {
        case "full_name": if (d.fullName) { updatePayload.full_name = d.fullName; filledKeys.push("full_name"); } break;
        case "email": if (d.email) { updatePayload.email = d.email; filledKeys.push("email"); } break;
        case "phone": if (d.phone) { updatePayload.phone = d.phone; filledKeys.push("phone"); } break;
        case "location": if (d.location) { updatePayload.location = d.location; filledKeys.push("location"); } break;
        case "linkedin_url": if (d.linkedinUrl) { updatePayload.linkedin_url = d.linkedinUrl; filledKeys.push("linkedin_url"); } break;
        case "github_url": if (d.githubUrl) { updatePayload.github_url = d.githubUrl; filledKeys.push("github_url"); } break;
        case "portfolio_url": if (d.portfolioUrl) { updatePayload.portfolio_url = d.portfolioUrl; filledKeys.push("portfolio_url"); } break;
        case "current_company": if (d.currentCompany) { updatePayload.current_company = d.currentCompany; filledKeys.push("current_company"); } break;
        case "experience_years": if (d.experienceYears) { updatePayload.experience_years = d.experienceYears; filledKeys.push("experience_years"); } break;
        case "skills": if (d.skills?.length) { updatePayload.skills = d.skills; filledKeys.push("skills"); } break;
        case "desired_roles": if (d.suggestedRoles?.length) { updatePayload.desired_roles = d.suggestedRoles; filledKeys.push("desired_roles"); } break;
        case "education": if (d.education) { updatePayload.education = d.education; filledKeys.push("education"); } break;
        case "certifications": if (d.certifications?.length) { updatePayload.certifications = d.certifications; filledKeys.push("certifications"); } break;
        case "languages": if (d.languages?.length) { updatePayload.languages = d.languages; filledKeys.push("languages"); } break;
        case "cv_summary": if (d.cvSummary) { updatePayload.cv_summary = d.cvSummary; filledKeys.push("cv_summary"); } break;
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error } = await supabase.from("profiles").update(updatePayload).eq("user_id", user.id);
      if (error) {
        toast({ title: "Merge failed", description: error.message, variant: "destructive" });
        setApplying(false);
        return;
      }

      // Update data_sources to mark these fields as AI-extracted
      try {
        await supabase.rpc("update_profile_data_sources", {
          p_user_id: user.id,
          p_field_names: filledKeys,
          p_source: "ai",
        });
      } catch {
        // Graceful degradation: data_sources tracking is optional
      }
    }

    await refreshProfile();
    toast({ title: "Profile updated!", description: `Merged ${filledKeys.length} new field(s) from your CV.` });
    setApplying(false);
    setApplied(true);
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold">CV Upload & Profile Builder</h1>
          <p className="text-muted-foreground mt-1">Upload your resume to auto-fill your profile. Existing data is always preserved.</p>
        </div>

        {/* Profile Completion Bar */}
        <Card className="shadow-card border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="font-display font-semibold text-sm">Profile Completion</span>
              <Badge variant={completionInfo.percent === 100 ? "default" : "secondary"} className={completionInfo.percent === 100 ? "gradient-primary border-0 text-primary-foreground" : ""}>
                {completionInfo.percent}%
              </Badge>
            </div>
            <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full gradient-primary transition-all duration-500" style={{ width: `${completionInfo.percent}%` }} />
            </div>
            {completionInfo.missing.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {completionInfo.fields.map(item => (
                  <Badge key={item.key} variant="outline" className={`text-xs ${item.done ? "bg-accent/10 text-accent border-accent/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}>
                    {item.done ? "✓" : "✗"} {item.label}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Section */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Upload className="h-5 w-5 text-primary" /> Upload Resume
            </CardTitle>
            <CardDescription>Supported formats: PDF, DOCX — AI will extract profile data without overwriting existing info</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onClick={() => document.getElementById("cv-input")?.click()}
            >
              <FileUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">{file ? file.name : "Drop your CV here or click to browse"}</p>
              <p className="text-sm text-muted-foreground mt-1">PDF or DOCX, max 20MB</p>
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
                  }
                }}
              />
            </div>

            {file && !extractedData && (
              <Button onClick={handleUploadAndAnalyze} disabled={uploading || analyzing} className="mt-4 w-full">
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

        {/* Merge Review Section */}
        {extractedData && mergeFields.length > 0 && !applied && (
          <Card className="shadow-card border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <ShieldCheck className="h-5 w-5 text-primary" /> Review Extracted Data
              </CardTitle>
              <CardDescription>
                Smart merge: only <strong>empty</strong> fields will be filled. Your existing data is protected.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mergeFields.filter(f => f.action !== "skip").map((field) => {
                const Icon = field.icon;
                return (
                  <div key={field.key} className={`flex items-start gap-3 rounded-lg p-3 border ${field.action === "fill" ? "border-primary/40 bg-primary/5" : "border-border/60 bg-muted/30"}`}>
                    <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{field.label}</span>
                        {field.action === "fill" ? (
                          <Badge variant="secondary" className="bg-primary/15 text-primary border-0 text-xs gap-1">
                            <ArrowRight className="h-3 w-3" /> Will fill
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Already set
                          </Badge>
                        )}
                      </div>
                      {field.action === "fill" && field.extracted && (
                        <p className="text-sm text-primary/80 truncate">{field.extracted}</p>
                      )}
                      {field.action === "keep" && field.existing && (
                        <p className="text-sm text-muted-foreground truncate">{field.existing}</p>
                      )}
                    </div>
                  </div>
                );
              })}

              {mergeFields.filter(f => f.action === "fill").length === 0 && (
                <div className="text-center py-4">
                  <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
                  <p className="font-medium">All extracted data already exists in your profile!</p>
                  <p className="text-sm text-muted-foreground">No changes needed.</p>
                </div>
              )}

              <div className="pt-3 border-t border-border">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-accent" />
                  <span className="text-sm text-muted-foreground">
                    {mergeFields.filter(f => f.action === "fill").length} field(s) will be filled • {mergeFields.filter(f => f.action === "keep").length} field(s) preserved
                  </span>
                </div>
                <Button onClick={handleApplyMerge} disabled={applying} className="w-full">
                  {applying ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Merging...</>
                  ) : (
                    <><CheckCircle2 className="mr-2 h-4 w-4" /> Apply Smart Merge</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Post-Merge Results */}
        {applied && (
          <>
            {/* Updated completion */}
            <Card className="shadow-card border-success/30 bg-success/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <span className="font-display font-semibold">Profile Updated</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">New Completion</span>
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
              <Card className="shadow-card border-accent/30 bg-accent/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display text-base">
                    <AlertTriangle className="h-5 w-5 text-accent" /> Remaining Gaps
                  </CardTitle>
                  <CardDescription>Complete these fields for better job matching and auto-fill</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {completionInfo.missing.map(f => (
                      <Badge key={f.key} variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                        ✗ {f.label}
                      </Badge>
                    ))}
                  </div>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/dashboard/settings">
                      <ExternalLink className="mr-2 h-4 w-4" /> Complete Profile in Settings
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Existing analysis results from profile */}
        {!extractedData && hasValue(profile?.skills) && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <CheckCircle2 className="h-5 w-5 text-success" /> Current Profile Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasValue(profile.skills) && (
                <div>
                  <h4 className="font-semibold mb-2">Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {(profile.skills as string[]).map((skill: string) => (
                      <Badge key={skill} variant="secondary" className="bg-primary/10 text-primary border-0">{skill}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {hasValue(profile.desired_roles) && (
                <div>
                  <h4 className="font-semibold mb-2">Desired Roles</h4>
                  <div className="flex flex-wrap gap-2">
                    {(profile.desired_roles as string[]).map((role: string) => (
                      <Badge key={role} variant="secondary" className="bg-accent/10 text-accent border-0">{role}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {profile?.cv_summary && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4" /> CV Summary</h4>
                  <p className="text-muted-foreground text-sm whitespace-pre-line leading-relaxed bg-muted/50 rounded-lg p-4">{profile.cv_summary}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

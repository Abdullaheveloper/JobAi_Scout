import { useState, useCallback, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import ExtractedDataCard from "@/components/ExtractedDataCard";
import ResumeSuggestionNotification from "@/components/resume/ResumeSuggestionNotification";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { hasValue } from "@/lib/constants";
import {
  type ExtractedData,
  profileToExtractedData,
  hasExtractedCvData,
  normalizeExtractedData,
} from "@/lib/cv-extracted-data";
import {
  FileUp, Loader2, Sparkles, CheckCircle2, Upload, ExternalLink, AlertTriangle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useResumeATSAnalysis } from "@/hooks/useResumeATSAnalysis";

const MAX_RESUME_BYTES = 10 * 1024 * 1024;
function validateResume(candidate: File): string | null {
  const name = candidate.name.toLowerCase();
  if (!candidate.name.includes(".")) return "The file has no extension. Choose a PDF or DOCX resume.";
  if (!/\.(pdf|docx)$/.test(name)) return "Unsupported resume format. Please upload a PDF or DOCX file.";
  if (candidate.size <= 0) return "This file is empty. Choose a resume that contains readable content.";
  if (candidate.size > MAX_RESUME_BYTES) return "Your resume is larger than 10 MB. Choose a smaller file.";
  return null;
}

async function getEdgeFunctionError(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response } | null)?.context;
  if (context) {
    try {
      const payload = await context.clone().json() as { error?: unknown };
      if (typeof payload?.error === "string" && payload.error.trim()) return payload.error;
    } catch {
      // The Edge Function may return a non-JSON gateway response. Keep the
      // user-facing fallback below instead of exposing the raw response.
    }
  }
  return error instanceof Error && error.message && !error.message.includes("non-2xx")
    ? error.message
    : fallback;
}

export default function CVUpload() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [applied, setApplied] = useState(false);
  const [activeResumePath, setActiveResumePath] = useState<string | null>(profile?.resume_url || null);
  const [retryingAts, setRetryingAts] = useState(false);
  const [extractionInfo, setExtractionInfo] = useState<{
    method: string;
    pages: number;
    ocrUsed: boolean;
    charCount: number;
  } | null>(null);
  const ats = useResumeATSAnalysis(user?.id, activeResumePath);
  const clearAts = ats.clear;

  useEffect(() => {
    if (profile?.resume_url) setActiveResumePath(profile.resume_url);
  }, [profile?.resume_url]);

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
    const validationError = dropped ? validateResume(dropped) : "No resume file was selected.";
    if (dropped && !validationError) {
      setFile(dropped);
      setExtractedData(null);
      setApplied(false);
      setExtractionInfo(null);
      clearAts();
    } else {
      toast({ title: "Resume not accepted", description: validationError, variant: "destructive" });
    }
  }, [clearAts, toast]);

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

    // The analysis transaction updates resume_url together with every
    // CV-managed profile field.
    setActiveResumePath(filePath);

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
          _ats?: Record<string, unknown>;
          _replacement?: { id?: string; status?: string };
        };
        const { _extraction, _saved, _ats, _replacement, ...rawExtracted } = raw;
        const extracted = normalizeExtractedData(rawExtracted);

        if (_extraction) setExtractionInfo(_extraction);
        setExtractedData(extracted);
        if (_ats?.analysis_status === "completed") {
          ats.acceptResult(_ats);
        } else if (_ats?.analysis_status === "failed") {
          ats.setError(String(_ats.error || "Your resume was uploaded successfully, but ATS suggestions could not be generated."));
        }

        setApplied(false);
        if (_replacement?.id && _replacement.status === "approved") {
          await refreshProfile();
          setApplied(true);
          toast({
            title: "Profile updated from your CV",
            description: "Your new CV replaced all CV-managed profile details. Account email was unchanged.",
          });
        } else if (!hasExtractedCvData(extracted)) {
          toast({
            title: "No data extracted",
            description: "The AI could not find usable fields in your resume.",
            variant: "destructive",
          });
        } else if (!_replacement?.id) {
          toast({
            title: "CV analyzed",
            description: "No profile replacement was needed because a newer CV is already active.",
          });
        }
      }
    } catch (err: unknown) {
      const message = await getEdgeFunctionError(err, "The resume analysis service could not process this file. Please try again.");
      toast({ title: "Analysis failed", description: message, variant: "destructive" });
      ats.setError(message);
    }
    setAnalyzing(false);
  };

  const retryAtsAnalysis = async () => {
    if (!activeResumePath || retryingAts) return;
    setRetryingAts(true);
    ats.setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-cv", {
        body: { fileName: activeResumePath.split("/").pop(), filePath: activeResumePath, forceAts: true, atsOnly: true },
      });
      if (error) throw error;
      const result = (data as { _ats?: unknown } | null)?._ats;
      const failure = result && typeof result === "object" ? (result as { error?: string }).error : undefined;
      if (!ats.acceptResult(result)) throw new Error(failure || "ATS suggestions could not be generated.");
    } catch (error: unknown) {
      ats.setError(await getEdgeFunctionError(error, "ATS suggestions could not be generated. Your uploaded resume is still safe."));
    } finally {
      setRetryingAts(false);
    }
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

        <ResumeSuggestionNotification
          analysis={ats.analysis}
          loading={analyzing}
          error={ats.error}
          dismissed={ats.isDismissed}
          onDismiss={ats.dismiss}
          onRetry={activeResumePath ? retryAtsAnalysis : undefined}
          retrying={retryingAts}
        />

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
              PDF or DOCX up to 10 MB. After analysis, the new CV automatically replaces every CV-managed profile field. Your account email is unchanged.
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
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => {
                  const candidate = e.target.files?.[0];
                  const validationError = candidate ? validateResume(candidate) : null;
                  if (candidate && !validationError) {
                    setFile(candidate);
                    setExtractedData(null);
                    setApplied(false);
                    setExtractionInfo(null);
                    ats.clear();
                  } else if (candidate) {
                    toast({ title: "Resume not accepted", description: validationError || "Choose a PDF or DOCX file up to 10 MB.", variant: "destructive" });
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

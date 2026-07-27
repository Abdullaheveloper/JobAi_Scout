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
import { useTranslation } from "react-i18next";
import { MixedDir } from "@/components/MixedDir";
import { ProfileReadinessCard } from "@/components/profile/ProfileReadinessCard";
import { buildProfileReadinessItems, profileReadinessPercent } from "@/lib/profile-readiness";

const MAX_RESUME_BYTES = 10 * 1024 * 1024;
function validateResume(candidate: File, t: (key: string) => string): string | null {
  const name = candidate.name.toLowerCase();
  if (!candidate.name.includes(".")) return t("cv.errorNoExtension");
  if (!/\.(pdf|docx)$/.test(name)) return t("cv.errorFormat");
  if (candidate.size <= 0) return t("cv.errorEmpty");
  if (candidate.size > MAX_RESUME_BYTES) return t("cv.errorTooLarge");
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
  const { t } = useTranslation();
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
  const completionItems = useMemo(
    () => buildProfileReadinessItems(profile, t),
    [profile, t],
  );
  const completionInfo = useMemo(() => {
    const missing = completionItems.filter((c) => !c.done);
    return {
      percent: profileReadinessPercent(completionItems),
      fields: completionItems,
      missing,
    };
  }, [completionItems]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    const validationError = dropped ? validateResume(dropped, t) : t("cv.errorNoFile");
    if (dropped && !validationError) {
      setFile(dropped);
      setExtractedData(null);
      setApplied(false);
      setExtractionInfo(null);
      clearAts();
    } else {
      toast({ title: t("cv.toastNotAccepted"), description: validationError, variant: "destructive" });
    }
  }, [clearAts, toast, t]);

  const handleUploadAndAnalyze = async () => {
    if (!file || !user) return;
    setUploading(true);

    // Upload to storage
    const filePath = `${user.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("resumes").upload(filePath, file);
    if (uploadError) {
      toast({ title: t("cv.toastUploadFailed"), description: uploadError.message, variant: "destructive" });
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
          ats.setError(String(_ats.error || t("cv.atsFailedUploadOk")));
        }

        const profileSaved = Boolean(
          (_replacement?.id && _replacement.status === "approved")
          || (_saved?.count && _saved.count > 0),
        );

        if (profileSaved) {
          await refreshProfile();
          setApplied(true);
          toast({
            title: t("cv.toastProfileUpdatedTitle"),
            description: t("cv.toastProfileUpdatedBody"),
          });
        } else if (!hasExtractedCvData(extracted)) {
          setApplied(false);
          toast({
            title: t("cv.toastNoDataTitle"),
            description: t("cv.toastNoDataBody"),
            variant: "destructive",
          });
        } else {
          setApplied(false);
          toast({
            title: t("cv.toastAnalyzedTitle"),
            description: t("cv.toastAnalyzedBody"),
          });
        }
      }
    } catch (err: unknown) {
      const message = await getEdgeFunctionError(err, t("cv.toastAnalysisFallback"));
      toast({ title: t("cv.toastAnalysisFailed"), description: message, variant: "destructive" });
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
      if (!ats.acceptResult(result)) throw new Error(failure || t("cv.atsFailedRetry"));
    } catch (error: unknown) {
      ats.setError(await getEdgeFunctionError(error, t("cv.atsFailedRetry")));
    } finally {
      setRetryingAts(false);
    }
  };

  const profileExtractedData = profileToExtractedData(profile);
  const displayExtractedData = extractedData ?? profileExtractedData;
  const showExtractedData = hasExtractedCvData(displayExtractedData);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
        <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card px-6 py-7 sm:px-8">
          <Badge variant="outline" className="mb-3 border-primary/25 bg-primary/10 text-primary">
            <MixedDir>{t("cv.stepBadge", { step: 1, total: 2 })}</MixedDir>
          </Badge>
          <MixedDir as="h1" className="font-display text-3xl font-bold tracking-tight">
            {t("cv.title")}
          </MixedDir>
          <MixedDir as="p" className="mt-2 max-w-2xl text-muted-foreground">
            {t("cv.subtitle")}
          </MixedDir>
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
        <ProfileReadinessCard
          items={completionInfo.fields}
          percent={completionInfo.percent}
          hideBadgesWhenComplete
        />

        {/* Upload Section */}
        <Card className="overflow-hidden border-border bg-card shadow-card">
          <CardHeader className="border-b border-border/70 bg-muted/20">
            <CardTitle className="flex items-center gap-2 font-display">
              <Upload className="h-5 w-5 text-primary" /> {t("cv.uploadTitle")}
            </CardTitle>
            <CardDescription>
              {t("cv.uploadDescription")}
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
              {/* File name is user data — not translated */}
              <p className="text-base font-semibold">{file ? file.name : t("cv.dropHere")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{file ? t("cv.readyForReview") : t("cv.orClickChoose")}</p>
              <input
                id="cv-input"
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => {
                  const candidate = e.target.files?.[0];
                  const validationError = candidate ? validateResume(candidate, t) : null;
                  if (candidate && !validationError) {
                    setFile(candidate);
                    setExtractedData(null);
                    setApplied(false);
                    setExtractionInfo(null);
                    ats.clear();
                  } else if (candidate) {
                    toast({ title: t("cv.toastNotAccepted"), description: validationError || t("cv.toastChooseFile"), variant: "destructive" });
                  }
                }}
              />
            </div>

            {file && !extractedData && (
              <Button onClick={handleUploadAndAnalyze} disabled={uploading || analyzing} className="mt-4 w-full sm:w-auto">
                {uploading ? (
                  <><Loader2 className="me-2 h-4 w-4 animate-spin" /> {t("cv.uploading")}</>
                ) : analyzing ? (
                  <><Loader2 className="me-2 h-4 w-4 animate-spin" /> {t("cv.analyzing")}</>
                ) : (
                  <><Sparkles className="me-2 h-4 w-4" /> {t("cv.analyze")}</>
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
                  {t("cv.freshExtraction", { method: extractionInfo.method })}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {t("cv.pages", { count: extractionInfo.pages, pages: extractionInfo.pages })}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {t("cv.chars", { chars: extractionInfo.charCount.toLocaleString() })}
                </Badge>
                {extractionInfo.ocrUsed && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/25">
                    {t("cv.ocrUsed")}
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
                  <span className="font-display font-semibold text-emerald-300">{t("cv.profileUpdated")}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">{t("cv.newCompletion")}</span>
                  <Badge variant="default" className="gradient-primary border-0">
                    {t("cv.percent", { percent: completionInfo.percent })}
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
                    <AlertTriangle className="h-5 w-5" /> {t("cv.remainingGaps")}
                  </CardTitle>
                  <CardDescription className="text-amber-200/40">{t("cv.remainingGapsDesc")}</CardDescription>
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
                      <ExternalLink className="me-2 h-4 w-4" /> {t("cv.completeInSettings")}
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
            title={extractedData ? t("cv.extractedFromResume") : t("cv.extractedCvData")}
            description={
              extractedData
                ? t("cv.extractedFreshDesc")
                : t("cv.extractedProfileDesc")
            }
          />
        )}
      </div>
    </DashboardLayout>
  );
}

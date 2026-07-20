import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, FileSearch, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import ATSScoreBadge from "./ATSScoreBadge";
import ResumeSuggestionList, { SuggestionItem } from "./ResumeSuggestionList";
import { careerLevelLabel, shouldShowResumeAtsNotification, type ResumeAtsAnalysis } from "@/lib/resume-ats";

type Props = {
  analysis?: ResumeAtsAnalysis | null;
  loading?: boolean;
  error?: string | null;
  dismissed?: boolean;
  onDismiss?: () => void;
  onRetry?: () => void;
  retrying?: boolean;
};

export default function ResumeSuggestionNotification({
  analysis,
  loading = false,
  error,
  dismissed = false,
  onDismiss,
  onRetry,
  retrying = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const improvements = analysis?.suggestions.filter((item) => item.severity !== "positive") || [];
  const positiveHighlights = [
    ...(analysis?.suggestions.filter((item) => item.severity === "positive").map((item) => item.title) || []),
    ...(analysis?.strengths.map((item) => item.message) || []),
  ].slice(0, 4);
  const isExcellent = Boolean(analysis && improvements.length === 0);
  const visible = loading || Boolean(error) || shouldShowResumeAtsNotification(analysis || null);
  const analysisId = analysis?.id;
  const shouldOpenReview = Boolean(analysis && improvements.length > 0 && !dismissed);

  useEffect(() => {
    setReviewOpen(shouldOpenReview);
  }, [analysisId, shouldOpenReview]);

  if (!visible || (dismissed && !loading && !error)) return null;

  if (analysis && improvements.length > 0 && !loading && !error) {
    const handleOpenChange = (nextOpen: boolean) => {
      setReviewOpen(nextOpen);
      if (!nextOpen) onDismiss?.();
    };

    return (
      <Dialog open={reviewOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className="h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl border-violet-400/30 bg-[#090d21] p-0 text-slate-50 shadow-[0_30px_100px_rgba(0,0,0,0.65)] sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:rounded-3xl [&>button]:right-5 [&>button]:top-5 [&>button]:z-30 [&>button]:flex [&>button]:h-10 [&>button]:w-10 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:border [&>button]:border-white/15 [&>button]:bg-white/10 [&>button]:text-white [&>button]:opacity-100 [&>button]:backdrop-blur-md [&>button_svg]:h-5 [&>button_svg]:w-5"
          aria-describedby="ats-review-description"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.28),transparent_50%),radial-gradient(circle_at_top_right,rgba(37,99,235,0.2),transparent_45%)]" aria-hidden="true" />

          <header className="relative border-b border-white/10 px-5 pb-5 pt-6 sm:px-8 sm:pb-7 sm:pt-8 lg:px-12">
            <div className="max-w-[calc(100%-3.5rem)]">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-violet-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">
                  <FileSearch className="h-3.5 w-3.5" /> ATS knowledge review
                </span>
                <ATSScoreBadge score={analysis.ats_score} />
              </div>
              <DialogTitle className="font-display text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">Your CV needs {improvements.length} important improvement{improvements.length === 1 ? "" : "s"}</DialogTitle>
              <DialogDescription id="ats-review-description" className="mt-3 max-w-4xl text-sm leading-6 text-slate-300 sm:text-base">
                We compared your resume with the JobAI ATS knowledge base and tailored this review for a{analysis.career_level === "early_career" ? "n" : ""} {careerLevelLabel(analysis.career_level)} candidate. These changes can improve readability, evidence, and ATS matching.
              </DialogDescription>
            </div>
          </header>

          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8 lg:px-12 lg:py-8">
            <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              <main>
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">What is missing or weak</p>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{analysis.summary}</p>
                </div>
                <ResumeSuggestionList analysis={{ ...analysis, suggestions: improvements }} />
              </main>

              <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
                <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] p-3 lg:p-4">
                    <div className="flex items-center gap-2 text-rose-200"><AlertCircle className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Critical</span></div>
                    <p className="mt-2 text-2xl font-bold">{analysis.critical_count}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] p-3 lg:p-4">
                    <div className="flex items-center gap-2 text-amber-100"><AlertTriangle className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Warnings</span></div>
                    <p className="mt-2 text-2xl font-bold">{analysis.warning_count}</p>
                  </div>
                  <div className="rounded-2xl border border-blue-400/20 bg-blue-400/[0.07] p-3 lg:p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-blue-200">Keyword readiness</div>
                    <p className="mt-2 text-2xl font-bold">{analysis.keyword_match_score}%</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-violet-400/20 bg-violet-400/[0.07] p-4">
                  <p className="text-sm font-semibold text-violet-100">Your review stays under your control</p>
                  <p className="mt-2 text-xs leading-5 text-slate-300">These are recommendations from <span className="font-medium text-slate-100">knowledge/ats_resume_guide.md</span>. Nothing in your CV or profile is changed automatically.</p>
                </div>
              </aside>
            </div>
          </div>

          <footer className="relative flex flex-col gap-3 border-t border-white/10 bg-[#090d21]/95 px-5 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
            <p className="text-xs text-slate-400">Close this review and update your CV when you are ready.</p>
            <DialogClose asChild>
              <Button type="button" className="gradient-primary w-full sm:w-auto"><CheckCircle2 className="mr-2 h-4 w-4" />I understand these suggestions</Button>
            </DialogClose>
          </footer>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <aside
      className={`relative overflow-hidden rounded-2xl border p-4 text-slate-50 shadow-[0_12px_38px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:p-5 ${isExcellent ? "border-emerald-400/30 bg-[rgba(15,42,42,0.9)]" : "border-violet-400/30 bg-[rgba(23,18,49,0.88)]"}`}
      aria-live="polite"
      aria-label="ATS resume suggestions"
    >
      <div className={`pointer-events-none absolute inset-x-12 -top-16 h-32 rounded-full blur-3xl ${isExcellent ? "bg-emerald-500/20" : "bg-violet-500/20"}`} aria-hidden="true" />
      {onDismiss && !loading && (
        <Button type="button" variant="ghost" size="icon" onClick={onDismiss} aria-label="Dismiss resume suggestions" className="absolute right-2 top-2 z-10 h-8 w-8 text-slate-300 hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </Button>
      )}

      {loading ? (
        <div className="relative flex items-center gap-3 pr-8">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-400/15 text-violet-200"><Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" /></span>
          <div><p className="font-semibold">Analyzing your resume</p><p className="mt-0.5 text-sm text-slate-300">Checking ATS structure, evidence, and career-level fit without blocking your upload.</p></div>
        </div>
      ) : error ? (
        <div className="relative flex flex-col gap-3 pr-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-200"><AlertTriangle className="h-5 w-5" /></span>
            <div><p className="font-semibold">Resume saved, suggestions unavailable</p><p className="mt-0.5 text-sm text-slate-300">{error}</p></div>
          </div>
          {onRetry && <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={retrying} className="shrink-0 border-violet-300/30 bg-white/[0.05] hover:bg-white/10"><RotateCcw className={`mr-2 h-4 w-4 ${retrying ? "animate-spin" : ""}`} />Try analysis again</Button>}
        </div>
      ) : analysis ? (
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="relative pr-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${isExcellent ? "bg-emerald-400/15 text-emerald-200" : "bg-violet-400/15 text-violet-200"}`}>
                {isExcellent ? <CheckCircle2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              </span>
              <div className="mr-auto">
                <p className="font-semibold">{isExcellent ? "Your CV looks outstanding" : "Resume improvement suggestions"}</p>
                <p className="text-xs text-slate-400">{analysis.career_level_estimated ? "Estimated " : ""}{careerLevelLabel(analysis.career_level)} review</p>
              </div>
              <ATSScoreBadge score={analysis.ats_score} />
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              {isExcellent
                ? "Excellent work—no important ATS problems were detected. Your CV is clear, complete, and ready to represent you professionally."
                : analysis.summary}
            </p>
            <p className={`mt-2 text-xs font-medium ${isExcellent ? "text-emerald-200" : "text-violet-200"}`}>
              {isExcellent
                ? "Your strongest resume qualities are highlighted below."
                : `We found ${improvements.length} important improvement${improvements.length === 1 ? "" : "s"}.`}
            </p>
          </div>
          {isExcellent ? (
            positiveHighlights.length > 0 && (
              <ul className="relative mt-3 grid gap-2 md:grid-cols-2" aria-label="CV strengths">
                {positiveHighlights.map((message, index) => (
                  <li key={`${message}-${index}`} className="flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-2 text-sm font-medium text-emerald-50">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{message}
                  </li>
                ))}
              </ul>
            )
          ) : (
            <ul className="relative mt-3 grid gap-2 md:grid-cols-2">
              {improvements.slice(0, 4).map((suggestion) => <SuggestionItem key={suggestion.id} suggestion={suggestion} compact />)}
            </ul>
          )}
          {(analysis.suggestions.length > 4 || analysis.strengths.length > 0) && (
            <>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="relative mt-3 px-2 text-violet-200 hover:bg-violet-300/10 hover:text-white" aria-expanded={open}>
                  {open ? "Hide detailed review" : "View all suggestions"}<ChevronDown className={`ml-2 h-4 w-4 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="relative mt-3 border-t border-white/10 pt-4"><ResumeSuggestionList analysis={analysis} /></CollapsibleContent>
            </>
          )}
        </Collapsible>
      ) : null}
    </aside>
  );
}

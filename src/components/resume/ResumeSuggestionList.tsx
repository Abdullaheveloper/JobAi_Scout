import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ResumeAtsAnalysis, ResumeAtsSuggestion } from "@/lib/resume-ats";

const severityMeta = {
  critical: { icon: AlertCircle, label: "Critical", classes: "border-rose-400/20 bg-rose-400/[0.07] text-rose-100" },
  warning: { icon: AlertTriangle, label: "Warning", classes: "border-amber-400/20 bg-amber-400/[0.07] text-amber-50" },
  positive: { icon: CheckCircle2, label: "Strength", classes: "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-50" },
} as const;

export function SuggestionItem({ suggestion, compact = false }: { suggestion: ResumeAtsSuggestion; compact?: boolean }) {
  const meta = severityMeta[suggestion.severity];
  const Icon = meta.icon;
  return (
    <li className={`rounded-xl border ${meta.classes} ${compact ? "px-3 py-2" : "p-3"}`}>
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5"><span className="sr-only">{meta.label}: </span>{suggestion.title}</p>
          {!compact && <p className="mt-1 text-xs leading-5 text-slate-300">{suggestion.message}</p>}
        </div>
      </div>
    </li>
  );
}

export default function ResumeSuggestionList({ analysis }: { analysis: ResumeAtsAnalysis }) {
  return (
    <div className="space-y-4">
      <ul className="space-y-2" aria-label="All resume suggestions">
        {analysis.suggestions.map((suggestion) => <SuggestionItem key={suggestion.id} suggestion={suggestion} />)}
      </ul>
      {analysis.strengths.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">What is working</p>
          <ul className="space-y-2">
            {analysis.strengths.map((strength, index) => (
              <li key={`${strength.category}-${index}`} className="flex gap-2 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2 text-xs leading-5 text-emerald-50">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {strength.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

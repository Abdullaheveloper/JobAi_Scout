import { useEffect, useRef } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ResumeAtsAnalysis } from "@/lib/resume-ats";

type Props = {
  analysis?: ResumeAtsAnalysis | null;
  loading?: boolean;
  error?: string | null;
  dismissed?: boolean;
  onDismiss?: () => void;
  onRetry?: () => void;
  retrying?: boolean;
};

export default function ResumeSuggestionNotification({ analysis, dismissed = false, onDismiss }: Props) {
  const { toast } = useToast();
  const notified = useRef<string | null>(null);

  useEffect(() => {
    if (!analysis || dismissed) return;
    const notificationKey = analysis.id || `${analysis.resume_path}:${analysis.analyzed_at}`;
    if (notified.current === notificationKey) return;
    notified.current = notificationKey;

    if (analysis.ats_score >= 90) {
      const control = toast({
        title: <span className="flex items-center gap-2 text-emerald-200"><CheckCircle2 className="h-4 w-4" />Excellent resume</span>,
        description: `${analysis.ats_score}/100 ATS score. You’re ready to apply with confidence.`,
        duration: 7_000,
        className: "border-emerald-500/30 bg-[rgba(34,197,94,0.08)] text-foreground backdrop-blur-xl",
      });
      const timer = window.setTimeout(() => {
        control.dismiss();
        onDismiss?.();
      }, 7_000);
      return () => window.clearTimeout(timer);
    }

    const suggestions = analysis.suggestions
      .filter((item) => item.severity !== "positive")
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 3);
    const control = toast({
      title: <span className="flex items-center gap-2 text-blue-200"><Sparkles className="h-4 w-4" />Resume suggestions · {analysis.ats_score}/100</span>,
      description: suggestions.length
        ? <ul className="mt-1 space-y-1 text-sm">{suggestions.map((item) => <li key={item.id}>• {item.message}</li>)}</ul>
        : analysis.summary,
      duration: 8_000,
      className: "border-blue-500/30 bg-[rgba(59,130,246,0.10)] text-foreground backdrop-blur-xl",
    });
    const timer = window.setTimeout(() => {
      control.dismiss();
      onDismiss?.();
    }, 8_000);
    return () => window.clearTimeout(timer);
  }, [analysis, dismissed, onDismiss, toast]);

  return null;
}

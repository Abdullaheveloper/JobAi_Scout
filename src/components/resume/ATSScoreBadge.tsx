import { Badge } from "@/components/ui/badge";

export default function ATSScoreBadge({ score }: { score: number }) {
  const tone = score >= 80
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
    : score >= 60
      ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
      : "border-rose-400/30 bg-rose-400/10 text-rose-100";
  return <Badge variant="outline" className={tone} aria-label={`ATS score ${score} out of 100`}>{score}/100 ATS</Badge>;
}

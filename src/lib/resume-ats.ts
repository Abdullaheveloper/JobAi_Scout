import type { Json } from "@/integrations/supabase/types";

export type AtsSeverity = "critical" | "warning" | "positive";
export type AtsCareerLevel = "fresher" | "early_career" | "mid_level" | "senior";

export type ResumeAtsSuggestion = {
  id: string;
  severity: AtsSeverity;
  category: string;
  title: string;
  message: string;
  priority: number;
};

export type ResumeAtsStrength = { category: string; message: string };

export type ResumeAtsAnalysis = {
  id?: string;
  resume_path: string;
  career_level: AtsCareerLevel;
  career_level_estimated: boolean;
  ats_score: number;
  keyword_match_score: number;
  analysis_status: "completed";
  summary: string;
  critical_count: number;
  warning_count: number;
  positive_count: number;
  suggestions: ResumeAtsSuggestion[];
  strengths: ResumeAtsStrength[];
  analyzed_at: string;
  dismissed_at: string | null;
  knowledge_version: string;
};

export type ResumeAtsFailure = {
  analysis_status: "failed";
  error: string;
};

const levels: AtsCareerLevel[] = ["fresher", "early_career", "mid_level", "senior"];
const severities: AtsSeverity[] = ["critical", "warning", "positive"];

const asArray = (value: Json | unknown): unknown[] => Array.isArray(value) ? value : [];
const score = (value: unknown) => Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? value as Record<string, unknown> : null;

export function normalizeResumeAtsAnalysis(value: unknown): ResumeAtsAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.analysis_status !== "completed") return null;
  const suggestions = asArray(raw.suggestions ?? raw.suggestions_json)
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item?.title && item?.message))
    .map((item, index): ResumeAtsSuggestion => {
      const severity = severities.includes(item.severity as AtsSeverity) ? item.severity as AtsSeverity : "warning";
      return {
        id: String(item.id || `suggestion-${index}`),
        severity,
        category: String(item.category || "general"),
        title: String(item.title),
        message: String(item.message),
        priority: Number(item.priority) || index + 1,
      };
    })
    .sort((a, b) => a.priority - b.priority);
  const strengths = asArray(raw.strengths ?? raw.strengths_json)
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item?.message))
    .map((item): ResumeAtsStrength => ({ category: String(item.category || "general"), message: String(item.message) }));
  const level = levels.includes(raw.career_level as AtsCareerLevel) ? raw.career_level as AtsCareerLevel : "fresher";
  return {
    id: raw.id ? String(raw.id) : undefined,
    resume_path: String(raw.resume_path || ""),
    career_level: level,
    career_level_estimated: Boolean(raw.career_level_estimated),
    ats_score: score(raw.ats_score),
    keyword_match_score: score(raw.keyword_match_score),
    analysis_status: "completed",
    summary: String(raw.summary || "Your resume review is ready."),
    critical_count: suggestions.filter((item) => item.severity === "critical").length,
    warning_count: suggestions.filter((item) => item.severity === "warning").length,
    positive_count: strengths.length + suggestions.filter((item) => item.severity === "positive").length,
    suggestions,
    strengths,
    analyzed_at: String(raw.analyzed_at || raw.updated_at || raw.created_at || new Date().toISOString()),
    dismissed_at: raw.dismissed_at ? String(raw.dismissed_at) : null,
    knowledge_version: String(raw.knowledge_version || ""),
  };
}

export function careerLevelLabel(level: AtsCareerLevel): string {
  return ({ fresher: "Fresher", early_career: "Early Career", mid_level: "Mid-Level", senior: "Senior" })[level];
}

export function hasActionableSuggestions(analysis: ResumeAtsAnalysis | null): boolean {
  return Boolean(analysis?.suggestions.some((item) => item.severity !== "positive"));
}

export function shouldShowResumeAtsNotification(analysis: ResumeAtsAnalysis | null): boolean {
  return Boolean(analysis && analysis.analysis_status === "completed");
}

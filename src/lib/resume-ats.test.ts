import { describe, expect, it } from "vitest";
import { careerLevelLabel, hasActionableSuggestions, normalizeResumeAtsAnalysis, shouldShowResumeAtsNotification } from "./resume-ats";

describe("resume ATS analysis normalization", () => {
  it("normalizes database JSON, recomputes counts, sorts priorities, and clamps scores", () => {
    const analysis = normalizeResumeAtsAnalysis({
      id: "analysis-1",
      analysis_status: "completed",
      career_level: "early_career",
      ats_score: 108,
      keyword_match_score: -5,
      suggestions_json: [
        { id: "skills", severity: "warning", title: "Expand skills", message: "Add relevant tools.", priority: 2 },
        { id: "metrics", severity: "critical", title: "Add outcomes", message: "Use measurable results.", priority: 1 },
        { id: "broken" },
      ],
      strengths_json: [{ category: "education", message: "Education is clear." }],
    });

    expect(analysis?.ats_score).toBe(100);
    expect(analysis?.keyword_match_score).toBe(0);
    expect(analysis?.suggestions.map((item) => item.id)).toEqual(["metrics", "skills"]);
    expect(analysis?.critical_count).toBe(1);
    expect(analysis?.warning_count).toBe(1);
    expect(analysis?.positive_count).toBe(1);
    expect(careerLevelLabel(analysis!.career_level)).toBe("Early Career");
    expect(hasActionableSuggestions(analysis)).toBe(true);
  });

  it("does not create a notification from failed or empty analysis data", () => {
    expect(normalizeResumeAtsAnalysis({ analysis_status: "failed" })).toBeNull();
    expect(normalizeResumeAtsAnalysis(null)).toBeNull();
    expect(hasActionableSuggestions(null)).toBe(false);
    expect(shouldShowResumeAtsNotification(null)).toBe(false);
  });

  it("shows a positive notification when no improvements are needed", () => {
    const analysis = normalizeResumeAtsAnalysis({
      id: "excellent-cv",
      analysis_status: "completed",
      career_level: "mid_level",
      ats_score: 96,
      keyword_match_score: 91,
      suggestions: [],
      strengths: [{ category: "achievements", message: "Strong measurable achievements." }],
    });

    expect(hasActionableSuggestions(analysis)).toBe(false);
    expect(shouldShowResumeAtsNotification(analysis)).toBe(true);
  });
});

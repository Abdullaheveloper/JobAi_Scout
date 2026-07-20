export const ATS_KNOWLEDGE_VERSION = "ats-guide-2026-07-20";

export type AtsSeverity = "critical" | "warning" | "positive";
export type AtsCareerLevel = "fresher" | "early_career" | "mid_level" | "senior";

export type AtsSuggestion = {
  id: string;
  severity: AtsSeverity;
  category: string;
  title: string;
  message: string;
  priority: number;
};

export type AtsStrength = { category: string; message: string };

export type AtsAnalysis = {
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
  suggestions: AtsSuggestion[];
  strengths: AtsStrength[];
  analyzed_at: string;
  dismissed_at: string | null;
  knowledge_version: string;
};

type KnowledgeChunk = {
  id: string;
  career_levels: string[];
  search_terms: string[];
  content: string;
};

const CORE_FALLBACK_CHUNKS: KnowledgeChunk[] = [
  {
    id: "career-levels",
    career_levels: ["all"],
    search_terms: ["experience", "career", "graduation", "internship"],
    content: "Career levels: Fresher 0-1 year; Early Career over 1-2.5; Mid Level over 2.5-4.5; Senior over 4.5. Estimate from education, internships, work history, projects and title only when years are uncertain.",
  },
  {
    id: "core-sections",
    career_levels: ["all"],
    search_terms: ["contact", "summary", "skills", "education", "project", "experience"],
    content: "Check professional contact details, 3-5 line summary, categorized technical skills, education, relevant projects and experience. GitHub matters for technical roles and LinkedIn is recommended.",
  },
  {
    id: "evidence",
    career_levels: ["all"],
    search_terms: ["achievement", "metric", "project", "experience", "action"],
    content: "Strong entries use specific action verbs and measurable outcomes such as percentages, time, users, APIs, records, accuracy, revenue, cost, scale or performance. Deduplicate overlapping feedback.",
  },
  {
    id: "format-score",
    career_levels: ["all"],
    search_terms: ["format", "score", "page", "date", "keyword"],
    content: "Prefer one column, standard fonts and bullets; avoid tables, headers/footers, images, icons and graphics when evidenced. Evaluate sections, experience, projects, skills, keywords, achievements, grammar and certifications out of 100.",
  },
];

const CAREER_LEVELS: AtsCareerLevel[] = ["fresher", "early_career", "mid_level", "senior"];
const SEVERITIES: AtsSeverity[] = ["critical", "warning", "positive"];

function compactWords(value: string): Set<string> {
  return new Set(
    value.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, " ").split(/\s+/).filter((word) => word.length > 2),
  );
}

function estimateCareerLevel(experienceYears: number): AtsCareerLevel {
  if (experienceYears <= 1) return "fresher";
  if (experienceYears <= 2.5) return "early_career";
  if (experienceYears <= 4.5) return "mid_level";
  return "senior";
}

async function retrieveKnowledge(
  db: any,
  cvText: string,
  structuredData: Record<string, unknown>,
): Promise<KnowledgeChunk[]> {
  const experience = Number(structuredData.experienceYears) || 0;
  const level = estimateCareerLevel(experience);
  const queryWords = compactWords(`${cvText.slice(0, 12000)} ${JSON.stringify(structuredData)}`);
  const { data, error } = await db
    .from("ats_resume_knowledge_chunks")
    .select("id, career_levels, search_terms, content")
    .eq("knowledge_version", ATS_KNOWLEDGE_VERSION);

  const chunks: KnowledgeChunk[] = !error && Array.isArray(data) && data.length ? data : CORE_FALLBACK_CHUNKS;
  return chunks
    .map((chunk) => {
      const levelBoost = chunk.career_levels?.includes("all") || chunk.career_levels?.includes(level) ? 5 : 0;
      const termScore = (chunk.search_terms || []).reduce(
        (score: number, term: string) => score + (queryWords.has(term.toLowerCase()) ? 2 : 0),
        0,
      );
      const essentialBoost = ["career-levels", "scoring", "feedback"].includes(chunk.id) ? 8 : 0;
      return { chunk, score: levelBoost + termScore + essentialBoost };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ chunk }) => chunk);
}

function clampScore(value: unknown): number {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 0;
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "suggestion";
}

function normalizeAnalysis(raw: Record<string, unknown>, resumePath: string): AtsAnalysis {
  const careerLevel = CAREER_LEVELS.includes(raw.career_level as AtsCareerLevel)
    ? raw.career_level as AtsCareerLevel
    : "fresher";
  const seen = new Set<string>();
  const suggestions = (Array.isArray(raw.suggestions) ? raw.suggestions : [])
    .map((item: any, index): AtsSuggestion | null => {
      const severity = SEVERITIES.includes(item?.severity) ? item.severity : "warning";
      const title = cleanText(item?.title, 100);
      const message = cleanText(item?.message, 300);
      if (!title || !message) return null;
      const key = `${slug(title)}-${slug(message).slice(0, 30)}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        id: cleanText(item?.id, 80) || slug(title),
        severity,
        category: cleanText(item?.category, 50) || "general",
        title,
        message,
        priority: Math.max(1, Math.min(99, Number(item?.priority) || index + 1)),
      };
    })
    .filter((item): item is AtsSuggestion => Boolean(item))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 12);
  const strengths = (Array.isArray(raw.strengths) ? raw.strengths : [])
    .map((item: any): AtsStrength | null => {
      const message = cleanText(item?.message, 240);
      return message ? { category: cleanText(item?.category, 50) || "general", message } : null;
    })
    .filter((item): item is AtsStrength => Boolean(item))
    .slice(0, 6);

  return {
    resume_path: resumePath,
    career_level: careerLevel,
    career_level_estimated: Boolean(raw.career_level_estimated),
    ats_score: clampScore(raw.ats_score),
    keyword_match_score: clampScore(raw.keyword_match_score),
    analysis_status: "completed",
    summary: cleanText(raw.summary, 500) || "Your resume review is ready.",
    critical_count: suggestions.filter((item) => item.severity === "critical").length,
    warning_count: suggestions.filter((item) => item.severity === "warning").length,
    positive_count: strengths.length + suggestions.filter((item) => item.severity === "positive").length,
    suggestions,
    strengths,
    analyzed_at: new Date().toISOString(),
    dismissed_at: null,
    knowledge_version: ATS_KNOWLEDGE_VERSION,
  };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function analyzeAndSaveResumeAts(options: {
  db: any;
  userId: string;
  resumePath: string;
  cvText: string;
  structuredData: Record<string, unknown>;
  openrouterApiKey: string;
  force?: boolean;
}): Promise<AtsAnalysis> {
  const { db, userId, resumePath, cvText, structuredData, openrouterApiKey, force = false } = options;
  const fingerprint = await sha256(`${resumePath}|${cvText.length}|${cvText.slice(0, 2000)}`);

  const { data: cached } = await db
    .from("resume_ats_analyses")
    .select("*")
    .eq("user_id", userId)
    .eq("resume_fingerprint", fingerprint)
    .eq("knowledge_version", ATS_KNOWLEDGE_VERSION)
    .eq("analysis_status", "completed")
    .maybeSingle();
  if (cached && !force) return databaseRowToAnalysis(cached);

  const chunks = await retrieveKnowledge(db, cvText, structuredData);
  const rules = chunks.map((chunk, index) => `[Rule ${index + 1}: ${chunk.id}] ${chunk.content}`).join("\n\n");
  const prompt = `Analyze this resume using only the evidence in the resume and the retrieved rules from knowledge/ats_resume_guide.md.

RETRIEVED ATS RULES:
${rules}

EXTRACTED STRUCTURE:
${JSON.stringify(structuredData)}

RESUME TEXT:
${cvText.slice(0, 18000)}

Return JSON only with: career_level (fresher|early_career|mid_level|senior), career_level_estimated (boolean), ats_score (0-100), keyword_match_score (0-100 general target-role readiness because no job description was supplied), summary, suggestions (array of id, severity critical|warning|positive, category, title, message, priority), strengths (array of category,message).

Requirements: career thresholds are exact; adapt priorities to career level; report only evidenced issues; never invent visual formatting, grammar or missing job-description requirements; combine duplicate advice; keep suggestions specific and actionable; return at most 12 suggestions and 6 strengths.`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openrouterApiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a conservative ATS resume evaluator. Return valid JSON only. Do not expose private resume text beyond concise feedback." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2600,
    }),
  });
  if (!response.ok) throw new Error(`ATS model request failed (${response.status})`);
  const payload = await response.json();
  const responseText = payload.choices?.[0]?.message?.content?.trim();
  if (!responseText) throw new Error("ATS model returned no analysis");
  const analysis = normalizeAnalysis(JSON.parse(responseText), resumePath);

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single();
  if (profileError || !profile) throw new Error("Resume owner profile was not found");

  const record = {
    user_id: userId,
    profile_id: profile.id,
    resume_path: resumePath,
    resume_fingerprint: fingerprint,
    knowledge_version: ATS_KNOWLEDGE_VERSION,
    career_level: analysis.career_level,
    career_level_estimated: analysis.career_level_estimated,
    ats_score: analysis.ats_score,
    keyword_match_score: analysis.keyword_match_score,
    summary: analysis.summary,
    suggestions_json: analysis.suggestions,
    strengths_json: analysis.strengths,
    analysis_status: "completed",
    error_message: null,
    dismissed_at: null,
  };
  const { data: saved, error: saveError } = await db
    .from("resume_ats_analyses")
    .upsert(record, { onConflict: "user_id,resume_fingerprint,knowledge_version" })
    .select("*")
    .single();
  if (saveError) throw new Error(`ATS analysis could not be saved: ${saveError.message}`);
  return databaseRowToAnalysis(saved);
}

export function databaseRowToAnalysis(row: any): AtsAnalysis {
  const suggestions = Array.isArray(row.suggestions_json) ? row.suggestions_json : [];
  const strengths = Array.isArray(row.strengths_json) ? row.strengths_json : [];
  return {
    id: row.id,
    resume_path: row.resume_path,
    career_level: row.career_level,
    career_level_estimated: row.career_level_estimated,
    ats_score: row.ats_score,
    keyword_match_score: row.keyword_match_score,
    analysis_status: "completed",
    summary: row.summary,
    critical_count: suggestions.filter((item: AtsSuggestion) => item.severity === "critical").length,
    warning_count: suggestions.filter((item: AtsSuggestion) => item.severity === "warning").length,
    positive_count: strengths.length + suggestions.filter((item: AtsSuggestion) => item.severity === "positive").length,
    suggestions,
    strengths,
    analyzed_at: row.updated_at || row.created_at,
    dismissed_at: row.dismissed_at,
    knowledge_version: row.knowledge_version,
  };
}

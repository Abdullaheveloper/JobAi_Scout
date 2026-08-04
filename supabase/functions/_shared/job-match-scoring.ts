import type { NormalizedJob } from "./job-types.ts";
import {
  DEFAULT_MIN_MATCH_THRESHOLD,
  normalizeMatchWeights,
  resolveEffectiveWeights,
  type MatchWeights,
} from "./match-preferences.ts";

export type MatchProfile = {
  skills?: string[] | null;
  desired_roles?: string[] | null;
  location?: string | null;
  experience_years?: number | null;
  education?: string | null;
  expected_salary?: string | null;
};

export type CareerLevel = "internship" | "junior" | "mid" | "senior" | "unknown";

const CAREER_LEVELS: CareerLevel[] = ["internship", "junior", "mid", "senior"];

export type MatchBreakdown = {
  score: number;
  explanation: {
    formula: Record<string, number>;
    titleMatch: { score: number; matched: string[] };
    roleMatch: { score: number; matched: boolean; detail: string };
    skillsMatch: { score: number; matched: string[]; considered: string[] };
    keywordMatch: { score: number; matched: string[] };
    locationMatch: { score: number; detail: string };
    experienceMatch: { score: number; detail: string };
    educationMatch: { score: number; detail: string };
    salaryMatch: { score: number; detail: string };
  };
};

const STOP_WORDS = new Set(["and", "the", "for", "with", "job", "role", "position", "jobs", "in", "at", "of", "a", "an"]);

export function tokenize(value: unknown): string[] {
  return [...new Set(String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !STOP_WORDS.has(term)))];
}

function coverage(terms: string[], text: string): { ratio: number; matched: string[] } {
  if (!terms.length) return { ratio: 0, matched: [] };
  const normalized = text.toLowerCase();
  const matched = terms.filter((term) => normalized.includes(term));
  return { ratio: matched.length / terms.length, matched };
}

function experienceRequirement(job: NormalizedJob): number | null {
  const text = `${job.experience_level || ""} ${job.title || ""} ${job.description || ""}`.toLowerCase();
  const range = text.match(/(\d+(?:\.\d+)?)\s*(?:\+|to|-|\u2013)?\s*(?:\d+(?:\.\d+)?)?\s*years?/i);
  if (range) return Number(range[1]);
  if (/principal|staff|director|head|senior|lead/.test(text)) return 5;
  if (/mid[- ]?level|intermediate/.test(text)) return 3;
  if (/junior|entry[- ]?level|graduate/.test(text)) return 1;
  if (/intern|internship/.test(text)) return 0;
  return null;
}

export function preferredCareerLevel(profile: MatchProfile): CareerLevel | null {
  const roles = (profile.desired_roles || []).join(" ").toLowerCase();
  if (/intern(ship)?|co[- ]?op|trainee/.test(roles)) return "internship";
  if (/junior|entry[- ]?level|graduate/.test(roles)) return "junior";
  if (/senior|lead|staff|principal|director|head/.test(roles)) return "senior";
  if (/mid[- ]?level|intermediate/.test(roles)) return "mid";
  return null;
}

export function jobCareerLevel(job: NormalizedJob): CareerLevel {
  const text = `${job.experience_level || ""} ${job.title || ""} ${job.description || ""}`.toLowerCase();
  if (/intern(ship)?|co[- ]?op|trainee/.test(text)) return "internship";
  if (/senior|lead|staff|principal|director|head/.test(text)) return "senior";
  if (/junior|entry[- ]?level|graduate/.test(text)) return "junior";
  const required = experienceRequirement(job);
  if (required !== null) return required >= 5 ? "senior" : required >= 2 ? "mid" : "junior";
  return "unknown";
}

export function matchesCareerLevel(job: NormalizedJob, profile: MatchProfile): boolean {
  const years = Math.max(0, Number(profile.experience_years) || 0);
  const requested = preferredCareerLevel(profile) || (years < 2 ? "junior" : years < 5 ? "mid" : "senior");
  const level = jobCareerLevel(job);
  // Feeds often omit seniority. Keep those jobs eligible and let the match
  // score decide, rather than treating missing metadata as the wrong level.
  if (level === "unknown") return true;
  return Math.abs(CAREER_LEVELS.indexOf(level) - CAREER_LEVELS.indexOf(requested)) <= 1;
}

function careerLevelPenalty(job: NormalizedJob, profile: MatchProfile): number {
  const years = Math.max(0, Number(profile.experience_years) || 0);
  const requested = preferredCareerLevel(profile) || (years < 2 ? "junior" : years < 5 ? "mid" : "senior");
  const level = jobCareerLevel(job);
  if (level === "unknown" || level === requested) return 0;
  return 10;
}

function normalizedLocation(value: unknown): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function parseSalaryNumber(value: unknown): number | null {
  const digits = String(value || "").replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function salaryRatio(job: NormalizedJob, profile: MatchProfile): { ratio: number; detail: string } {
  const expected = parseSalaryNumber(profile.expected_salary);
  if (expected === null) {
    return { ratio: 1, detail: "No salary preference supplied" };
  }
  const min = job.salary_min;
  const max = job.salary_max;
  if (min == null && max == null) {
    return { ratio: 0.5, detail: "Job salary not specified" };
  }
  const low = min ?? max ?? expected;
  const high = max ?? min ?? expected;
  if (expected >= low && expected <= high) {
    return { ratio: 1, detail: `Expected salary fits ${low}–${high}` };
  }
  if (expected < low) {
    const gap = (low - expected) / Math.max(low, 1);
    return { ratio: Math.max(0, 1 - gap), detail: `Role starts near ${low}; profile expects ${expected}` };
  }
  const gap = (expected - high) / Math.max(expected, 1);
  return { ratio: Math.max(0, 1 - gap), detail: `Role tops near ${high}; profile expects ${expected}` };
}

function educationRatio(job: NormalizedJob, profile: MatchProfile): { ratio: number; detail: string } {
  const education = String(profile.education || "").trim();
  if (!education) {
    return { ratio: 1, detail: "No education preference supplied" };
  }
  const terms = tokenize(education).slice(0, 12);
  const evidence = `${job.title || ""} ${job.description || ""} ${(job.skills || []).join(" ")}`;
  const result = coverage(terms, evidence);
  return {
    ratio: result.ratio,
    detail: result.matched.length
      ? `Matched education terms: ${result.matched.join(", ")}`
      : "No education terms found in the posting",
  };
}

export function calculateJobMatch(job: NormalizedJob, input: {
  query: string;
  location?: string | null;
  profile?: MatchProfile | null;
  /** Sparse user weights; unset → equal weighting across default categories. */
  matchWeights?: MatchWeights | null;
  hasSetMatchPreferences?: boolean;
}): MatchBreakdown {
  const profile = input.profile || {};
  const queryTerms = tokenize(input.query).slice(0, 8);
  const roleTerms = tokenize((profile.desired_roles || []).join(" ")).slice(0, 12);
  const titleEvidence = `${job.title} ${job.job_type || ""}`;
  const queryTitle = coverage(queryTerms, titleEvidence);
  const roleTitle = coverage(roleTerms, titleEvidence);
  const bestTitle = queryTitle.ratio >= roleTitle.ratio ? queryTitle : roleTitle;

  const profileSkills = [...new Set((profile.skills || []).map((skill) => skill.trim()).filter(Boolean))].slice(0, 20);
  const jobEvidence = `${job.title} ${(job.skills || []).join(" ")} ${job.description || ""}`.toLowerCase();
  const matchedSkills = profileSkills.filter((skill) => jobEvidence.includes(skill.toLowerCase()));
  const skillDenominator = Math.min(Math.max(profileSkills.length, 1), 10);
  const skillRatio = profileSkills.length ? Math.min(1, matchedSkills.length / skillDenominator) : 0;

  const keywordEvidence = `${job.description || ""} ${(job.skills || []).join(" ")} ${job.title}`;
  const queryKeywordCoverage = coverage(queryTerms, keywordEvidence);
  const roleKeywordCoverage = coverage(roleTerms, keywordEvidence);
  const keywordCoverage = queryKeywordCoverage.ratio >= roleKeywordCoverage.ratio
    ? queryKeywordCoverage
    : roleKeywordCoverage;

  // Desired-role category blends title + keyword/description signal.
  const desiredRoleRatio = (bestTitle.ratio * 0.6) + (keywordCoverage.ratio * 0.4);

  const preferredLocation = normalizedLocation(input.location || profile.location);
  const jobLocation = normalizedLocation(`${job.location || ""} ${job.work_mode || ""}`);
  let locationRatio = 1;
  let locationDetail = "No location preference supplied";
  if (preferredLocation) {
    const preferredParts = tokenize(preferredLocation);
    const locationParts = coverage(preferredParts, jobLocation);
    const remoteJob = /\b(remote|worldwide|anywhere|global)\b/.test(jobLocation);
    locationRatio = remoteJob ? 1 : locationParts.ratio;
    locationDetail = remoteJob
      ? "Remote/worldwide role is available from the preferred location"
      : locationRatio >= 0.8 ? `Matches ${input.location || profile.location}` : `Job location is ${job.location || "not specified"}`;
  }

  const userExperience = Math.max(0, Number(profile.experience_years) || 0);
  const requiredExperience = experienceRequirement(job);
  const experienceRatio = requiredExperience === null || requiredExperience === 0
    ? 1
    : Math.min(1, userExperience / requiredExperience);
  const experienceDetail = requiredExperience === null
    ? "No explicit experience requirement detected"
    : userExperience >= requiredExperience
      ? `Profile meets the detected ${requiredExperience}+ year requirement`
      : `Profile has ${userExperience} years; the role appears to request ${requiredExperience}+`;

  const education = educationRatio(job, profile);
  const salary = salaryRatio(job, profile);

  const ratios: Record<string, number> = {
    skills: skillRatio,
    location: locationRatio,
    desiredRole: desiredRoleRatio,
    experience: experienceRatio,
    education: education.ratio,
    salary: salary.ratio,
  };

  const weights = resolveEffectiveWeights(
    normalizeMatchWeights(input.matchWeights),
    input.hasSetMatchPreferences,
  );

  const components: Record<string, number> = {};
  for (const [key, weight] of Object.entries(weights)) {
    const ratio = ratios[key] ?? 0;
    components[key] = ratio * weight;
  }

  // Adjacent career levels are useful discovery results, but exact-level
  // opportunities should remain at the top of the list.
  const rawScore = Object.values(components).reduce((sum, value) => sum + value, 0);
  const score = Math.max(0, Math.min(100, Math.round(rawScore - careerLevelPenalty(job, profile))));

  const formula: Record<string, number> = {};
  for (const [key, value] of Object.entries(components)) {
    formula[key] = Math.round(value);
  }

  return {
    score,
    explanation: {
      formula,
      titleMatch: { score: Math.round(bestTitle.ratio * 100), matched: bestTitle.matched },
      roleMatch: { score: Math.round(roleTitle.ratio * 100), matched: roleTitle.ratio > 0, detail: roleTitle.matched.length ? roleTitle.matched.join(", ") : "No desired-role term in the title" },
      skillsMatch: { score: Math.round(skillRatio * 100), matched: matchedSkills, considered: profileSkills },
      keywordMatch: { score: Math.round(keywordCoverage.ratio * 100), matched: keywordCoverage.matched },
      locationMatch: { score: Math.round(locationRatio * 100), detail: locationDetail },
      experienceMatch: { score: Math.round(experienceRatio * 100), detail: experienceDetail },
      educationMatch: { score: Math.round(education.ratio * 100), detail: education.detail },
      salaryMatch: { score: Math.round(salary.ratio * 100), detail: salary.detail },
    },
  };
}

export { DEFAULT_MIN_MATCH_THRESHOLD };

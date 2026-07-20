import type { NormalizedJob } from "./job-types.ts";

export type MatchProfile = {
  skills?: string[] | null;
  desired_roles?: string[] | null;
  location?: string | null;
  experience_years?: number | null;
};

export type MatchBreakdown = {
  score: number;
  explanation: {
    formula: { title: number; skills: number; keywords: number; location: number; experience: number };
    titleMatch: { score: number; matched: string[] };
    roleMatch: { score: number; matched: boolean; detail: string };
    skillsMatch: { score: number; matched: string[]; considered: string[] };
    keywordMatch: { score: number; matched: string[] };
    locationMatch: { score: number; detail: string };
    experienceMatch: { score: number; detail: string };
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

function normalizedLocation(value: unknown): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function calculateJobMatch(job: NormalizedJob, input: {
  query: string;
  location?: string | null;
  profile?: MatchProfile | null;
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

  // Skills have their own 30-point component. Keeping them out of this
  // denominator prevents a long profile skill list from weakening an exact
  // user-query match in the keyword/description component.
  const keywordEvidence = `${job.description || ""} ${(job.skills || []).join(" ")} ${job.title}`;
  const queryKeywordCoverage = coverage(queryTerms, keywordEvidence);
  const roleKeywordCoverage = coverage(roleTerms, keywordEvidence);
  const keywordCoverage = queryKeywordCoverage.ratio >= roleKeywordCoverage.ratio
    ? queryKeywordCoverage
    : roleKeywordCoverage;

  const preferredLocation = normalizedLocation(input.location || profile.location);
  const jobLocation = normalizedLocation(`${job.location || ""} ${job.work_mode || ""}`);
  let locationRatio = 1;
  let locationDetail = "No location preference supplied";
  if (preferredLocation) {
    const preferredParts = tokenize(preferredLocation);
    const locationParts = coverage(preferredParts, jobLocation);
    const remoteMatch = preferredLocation.includes("remote") && jobLocation.includes("remote");
    locationRatio = remoteMatch ? 1 : locationParts.ratio;
    locationDetail = locationRatio >= 0.8 ? `Matches ${input.location || profile.location}` : `Job location is ${job.location || "not specified"}`;
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

  const components = {
    title: bestTitle.ratio * 35,
    skills: skillRatio * 30,
    keywords: keywordCoverage.ratio * 20,
    location: locationRatio * 10,
    experience: experienceRatio * 5,
  };
  const score = Math.max(0, Math.min(100, Math.round(Object.values(components).reduce((sum, value) => sum + value, 0))));

  return {
    score,
    explanation: {
      formula: {
        title: Math.round(components.title),
        skills: Math.round(components.skills),
        keywords: Math.round(components.keywords),
        location: Math.round(components.location),
        experience: Math.round(components.experience),
      },
      titleMatch: { score: Math.round(bestTitle.ratio * 100), matched: bestTitle.matched },
      roleMatch: { score: Math.round(roleTitle.ratio * 100), matched: roleTitle.ratio > 0, detail: roleTitle.matched.length ? roleTitle.matched.join(", ") : "No desired-role term in the title" },
      skillsMatch: { score: Math.round(skillRatio * 100), matched: matchedSkills, considered: profileSkills },
      keywordMatch: { score: Math.round(keywordCoverage.ratio * 100), matched: keywordCoverage.matched },
      locationMatch: { score: Math.round(locationRatio * 100), detail: locationDetail },
      experienceMatch: { score: Math.round(experienceRatio * 100), detail: experienceDetail },
    },
  };
}

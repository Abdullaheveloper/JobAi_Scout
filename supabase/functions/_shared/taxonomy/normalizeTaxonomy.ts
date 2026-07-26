import Fuse from "npm:fuse.js@7.5.0";
import jobTaxonomyJson from "./job-taxonomy.json" with { type: "json" };
import skillsTaxonomyJson from "./skills-taxonomy.json" with { type: "json" };
import locationTaxonomyJson from "./location-taxonomy.json" with { type: "json" };

export type TaxonomyEntry = {
  canonical: string;
  aliases: string[];
};

export type FuzzyMatchResult = {
  canonical: string;
  score: number;
};

export type NormalizeTaxonomyOptions = {
  threshold?: number;
  maxResults?: number;
  confidentScore?: number;
};

export const DEFAULT_FUZZY_THRESHOLD = 0.35;
export const DEFAULT_MAX_RESULTS = 5;
export const DEFAULT_CONFIDENT_SCORE = 0.45;

export const jobTaxonomy = jobTaxonomyJson as TaxonomyEntry[];
export const skillsTaxonomy = skillsTaxonomyJson as TaxonomyEntry[];
export const locationTaxonomy = locationTaxonomyJson as TaxonomyEntry[];

export function searchTaxonomy(
  term: string,
  taxonomy: TaxonomyEntry[],
  options: NormalizeTaxonomyOptions = {},
): FuzzyMatchResult[] {
  const trimmed = term.trim();
  if (!trimmed || taxonomy.length === 0) return [];

  const threshold = options.threshold ?? DEFAULT_FUZZY_THRESHOLD;
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;

  const fuse = new Fuse(taxonomy, {
    keys: ["canonical", "aliases"],
    threshold,
    includeScore: true,
    minMatchCharLength: 2,
    ignoreLocation: true,
  });

  const matches = fuse.search(trimmed);
  const seen = new Set<string>();
  const deduped: FuzzyMatchResult[] = [];

  for (const match of matches) {
    const canonical = match.item.canonical;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    deduped.push({
      canonical,
      score: typeof match.score === "number" ? match.score : 1,
    });
  }

  deduped.sort((a, b) => a.score - b.score);
  return deduped.slice(0, maxResults);
}

export function normalizeWithTaxonomy(
  term: string,
  taxonomy: TaxonomyEntry[],
  options: NormalizeTaxonomyOptions = {},
): string {
  const trimmed = term.trim();
  if (!trimmed) return "";

  const confidentScore = options.confidentScore ?? DEFAULT_CONFIDENT_SCORE;
  const results = searchTaxonomy(trimmed, taxonomy, options);
  const best = results[0];
  if (best && best.score <= confidentScore) {
    return best.canonical;
  }
  return trimmed;
}

export function normalizeListWithTaxonomy(
  terms: string[] | null | undefined,
  taxonomy: TaxonomyEntry[],
  options: NormalizeTaxonomyOptions = {},
): string[] {
  if (!Array.isArray(terms) || terms.length === 0) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of terms) {
    if (typeof raw !== "string") continue;
    const normalized = normalizeWithTaxonomy(raw, taxonomy, options);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }

  return out;
}

/** Apply taxonomy canonicalization to CV-extracted skills, roles, location, and experience titles. */
export function applyTaxonomyToExtractedData<T extends {
  skills?: string[];
  suggestedRoles?: string[];
  location?: string;
  experience?: Array<{ title?: string; [key: string]: unknown }>;
}>(extracted: T, options: NormalizeTaxonomyOptions = {}): T {
  const skills = normalizeListWithTaxonomy(extracted.skills, skillsTaxonomy, options);
  const suggestedRoles = normalizeListWithTaxonomy(extracted.suggestedRoles, jobTaxonomy, options);
  const location = extracted.location
    ? normalizeWithTaxonomy(extracted.location, locationTaxonomy, options)
    : extracted.location;
  const experience = Array.isArray(extracted.experience)
    ? extracted.experience.map((entry) => ({
      ...entry,
      title: entry.title ? normalizeWithTaxonomy(entry.title, jobTaxonomy, options) : entry.title,
    }))
    : extracted.experience;

  return {
    ...extracted,
    skills,
    suggestedRoles,
    location,
    experience,
  };
}

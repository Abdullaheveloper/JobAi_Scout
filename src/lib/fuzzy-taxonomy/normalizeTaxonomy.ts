import Fuse from "fuse.js";

export type TaxonomyEntry = {
  canonical: string;
  aliases: string[];
};

export type FuzzyMatchResult = {
  canonical: string;
  score: number;
};

export type NormalizeTaxonomyOptions = {
  /** Fuse threshold (0 = exact, 1 = anything). Default 0.35 */
  threshold?: number;
  /** Max ranked results to consider. Default 5 */
  maxResults?: number;
  /** Score at or below this is a confident canonical match. Default 0.45 */
  confidentScore?: number;
};

export const DEFAULT_FUZZY_THRESHOLD = 0.35;
export const DEFAULT_MAX_RESULTS = 5;
export const DEFAULT_CONFIDENT_SCORE = 0.45;

/**
 * Pure Fuse-based taxonomy match. Returns ranked canonical hits for a term.
 * Lower score = better match (Fuse convention).
 */
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

/**
 * Normalize a free-text term to its taxonomy canonical when a confident
 * match exists; otherwise return the trimmed original (free-text fallback).
 */
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

/** Normalize a list of terms; dedupe case-insensitively after canonicalization. */
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
}>(
  extracted: T,
  taxonomies: { skills: TaxonomyEntry[]; jobs: TaxonomyEntry[]; locations?: TaxonomyEntry[] },
  options: NormalizeTaxonomyOptions = {},
): T {
  const skills = normalizeListWithTaxonomy(extracted.skills, taxonomies.skills, options);
  const suggestedRoles = normalizeListWithTaxonomy(extracted.suggestedRoles, taxonomies.jobs, options);
  const location = extracted.location && taxonomies.locations?.length
    ? normalizeWithTaxonomy(extracted.location, taxonomies.locations, options)
    : extracted.location;
  const experience = Array.isArray(extracted.experience)
    ? extracted.experience.map((entry) => ({
      ...entry,
      title: entry.title ? normalizeWithTaxonomy(entry.title, taxonomies.jobs, options) : entry.title,
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

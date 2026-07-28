/**
 * Shared job-matching preference model used by the web app and scrape scorer.
 * Categories are data-driven — append to MATCH_CATEGORIES to add more later.
 */

export const DEFAULT_MIN_MATCH_THRESHOLD = 40;
export const SKILLS_MIN_WEIGHT = 20; // Skills must be strictly above this

export type MatchCategoryKey =
  | "skills"
  | "location"
  | "desiredRole"
  | "experience"
  | "education"
  | "salary"
  | (string & {});

export type MatchCategoryDef = {
  key: MatchCategoryKey;
  /** i18n key under matchPreferences.categories.* */
  labelKey: string;
  /** Skills is always required with weight > SKILLS_MIN_WEIGHT */
  mandatory?: boolean;
};

/** Extensible category list — not hardcoded to a fixed count in UI/scoring loops. */
export const MATCH_CATEGORIES: readonly MatchCategoryDef[] = [
  { key: "skills", labelKey: "skills", mandatory: true },
  { key: "location", labelKey: "location" },
  { key: "desiredRole", labelKey: "desiredRole" },
  { key: "experience", labelKey: "experience" },
  { key: "education", labelKey: "education" },
  { key: "salary", labelKey: "salary" },
] as const;

export const DEFAULT_MATCH_CATEGORY_KEYS: readonly MatchCategoryKey[] =
  MATCH_CATEGORIES.map((category) => category.key);

export type MatchWeights = { [categoryKey: string]: number };

export type MatchPreferences = {
  matchWeights: MatchWeights;
  minMatchThreshold: number;
  hasSetMatchPreferences: boolean;
};

export type MatchPreferencesValidation =
  | { ok: true }
  | { ok: false; code: "skills_required" | "skills_too_low" | "sum_not_100"; total: number; skillsWeight: number };

export function clampThreshold(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_MIN_MATCH_THRESHOLD;
  return Math.min(100, Math.max(0, n));
}

/** Sparse normalize: only finite positive entries kept; zeros dropped. */
export function normalizeMatchWeights(raw: unknown): MatchWeights {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: MatchWeights = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = Math.round(Number(value));
    if (!key || !Number.isFinite(n) || n <= 0) continue;
    out[key] = Math.min(100, Math.max(0, n));
  }
  return out;
}

export function sumMatchWeights(weights: MatchWeights): number {
  return Object.values(weights).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

export function validateMatchPreferences(
  weights: MatchWeights,
  options?: { requireSkillsAbove?: number },
): MatchPreferencesValidation {
  const skillsFloor = options?.requireSkillsAbove ?? SKILLS_MIN_WEIGHT;
  const skillsWeight = Number(weights.skills) || 0;
  const total = sumMatchWeights(weights);

  if (skillsWeight <= 0) {
    return { ok: false, code: "skills_required", total, skillsWeight };
  }
  if (skillsWeight <= skillsFloor) {
    return { ok: false, code: "skills_too_low", total, skillsWeight };
  }
  if (total !== 100) {
    return { ok: false, code: "sum_not_100", total, skillsWeight };
  }
  return { ok: true };
}

/**
 * Effective weights for scoring.
 * - When the user has set preferences and provided any weights, use those (sparse; 0% omitted).
 * - Otherwise fall back to equal weighting across the default category set.
 */
export function resolveEffectiveWeights(
  weights: MatchWeights | null | undefined,
  hasSetMatchPreferences?: boolean,
): MatchWeights {
  const normalized = normalizeMatchWeights(weights);
  if (hasSetMatchPreferences && Object.keys(normalized).length > 0) {
    return normalized;
  }

  const keys = DEFAULT_MATCH_CATEGORY_KEYS;
  const share = Math.floor(100 / keys.length);
  const remainder = 100 - share * keys.length;
  const equal: MatchWeights = {};
  keys.forEach((key, index) => {
    equal[key] = share + (index < remainder ? 1 : 0);
  });
  return equal;
}

export function normalizeMatchPreferences(raw: {
  match_weights?: unknown;
  matchWeights?: unknown;
  min_match_threshold?: unknown;
  minMatchThreshold?: unknown;
  has_set_match_preferences?: unknown;
  hasSetMatchPreferences?: unknown;
} | null | undefined): MatchPreferences {
  const source = raw || {};
  return {
    matchWeights: normalizeMatchWeights(source.match_weights ?? source.matchWeights),
    minMatchThreshold: clampThreshold(source.min_match_threshold ?? source.minMatchThreshold),
    hasSetMatchPreferences: Boolean(
      source.has_set_match_preferences ?? source.hasSetMatchPreferences ?? false,
    ),
  };
}

export function shouldShowMatchPreferencesGate(
  prefs: Pick<MatchPreferences, "hasSetMatchPreferences"> | null | undefined,
): boolean {
  return !prefs?.hasSetMatchPreferences;
}

export function filterJobsByThreshold<T extends { match_score?: number | null }>(
  jobs: T[],
  threshold: number = DEFAULT_MIN_MATCH_THRESHOLD,
): T[] {
  const floor = clampThreshold(threshold);
  return jobs.filter((job) => Number(job.match_score || 0) >= floor);
}

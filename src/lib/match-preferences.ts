/**
 * Client-facing match preference helpers. Core validation/scoring config lives
 * in the shared Deno module so scrape + UI stay aligned.
 */
export {
  DEFAULT_MATCH_CATEGORY_KEYS,
  DEFAULT_MIN_MATCH_THRESHOLD,
  MATCH_CATEGORIES,
  SKILLS_MIN_WEIGHT,
  clampThreshold,
  filterJobsByThreshold,
  normalizeMatchPreferences,
  normalizeMatchWeights,
  resolveEffectiveWeights,
  shouldShowMatchPreferencesGate,
  sumMatchWeights,
  validateMatchPreferences,
  type MatchCategoryDef,
  type MatchCategoryKey,
  type MatchPreferences,
  type MatchPreferencesValidation,
  type MatchWeights,
} from "../../supabase/functions/_shared/match-preferences.ts";

import {
  DEFAULT_MIN_MATCH_THRESHOLD,
  normalizeMatchPreferences,
  normalizeMatchWeights,
  type MatchPreferences,
  type MatchWeights,
} from "../../supabase/functions/_shared/match-preferences.ts";
import { supabase } from "@/integrations/supabase/client";

export function matchPreferencesFromProfile(profile: Record<string, unknown> | null | undefined): MatchPreferences {
  if (!profile) {
    return {
      matchWeights: {},
      minMatchThreshold: DEFAULT_MIN_MATCH_THRESHOLD,
      hasSetMatchPreferences: false,
    };
  }
  return normalizeMatchPreferences({
    match_weights: profile.match_weights,
    min_match_threshold: profile.min_match_threshold,
    has_set_match_preferences: profile.has_set_match_preferences,
  });
}

export async function saveMatchPreferences(userId: string, input: {
  matchWeights: MatchWeights;
  minMatchThreshold: number;
  markComplete?: boolean;
}): Promise<{ error: Error | null }> {
  const payload: Record<string, unknown> = {
    match_weights: normalizeMatchWeights(input.matchWeights),
    min_match_threshold: Math.min(100, Math.max(0, Math.round(Number(input.minMatchThreshold) || DEFAULT_MIN_MATCH_THRESHOLD))),
  };
  if (input.markComplete !== false) {
    payload.has_set_match_preferences = true;
  }
  const { error } = await supabase.from("profiles").update(payload).eq("user_id", userId);
  return { error: error ? new Error(error.message) : null };
}

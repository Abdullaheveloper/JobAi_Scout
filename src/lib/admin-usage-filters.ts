import type { UsageFeature } from "@/lib/usage-limits-client";

export type UsageFilterUser = {
  fullName: string | null;
  email: string | null;
  features: Array<{ feature: UsageFeature; used: number; maxCount: number | null }>;
};

export type UsageRatioFilters = Partial<Record<UsageFeature, string>>;

export function normalizedRatio(value: string): string | null {
  const compact = value.replace(/\s+/g, "");
  if (!compact) return null;
  return /^\d+\/\d+$/.test(compact) ? compact : "invalid";
}

export function matchesUsageFilters(user: UsageFilterUser, userQuery: string, ratios: UsageRatioFilters): boolean {
  const query = userQuery.trim().toLocaleLowerCase();
  if (query) {
    const name = (user.fullName || "").toLocaleLowerCase();
    const email = (user.email || "").toLocaleLowerCase();
    if (!name.includes(query) && !email.includes(query)) return false;
  }

  return Object.entries(ratios).every(([feature, raw]) => {
    const expected = normalizedRatio(raw || "");
    if (expected === null) return true;
    if (expected === "invalid") return false;
    const state = user.features.find((item) => item.feature === feature);
    return Boolean(state && state.maxCount !== null && `${state.used}/${state.maxCount}` === expected);
  });
}

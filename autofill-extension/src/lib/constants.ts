export const API_BASE = "https://okppdziaslsitmoqduqg.supabase.co";
export const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcHBkemlhc2xzaXRtb3FkdXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzE3MTUsImV4cCI6MjA4ODU0NzcxNX0.yAFcwtZL8P2W-gN8ZyBik_CSA8c84cgBo9qJYouvPkc";

export const STORAGE_KEYS = {
  AUTH: "auth",
  PROFILE: "profile",
} as const;

export const MIN_CONFIDENCE = 0.6;

export const COUNTRY_ALIASES: Record<string, string> = {
  us: "United States",
  usa: "United States",
  "united states": "United States",
  uk: "United Kingdom",
  "united kingdom": "United Kingdom",
  uae: "United Arab Emirates",
  "united arab emirates": "United Arab Emirates",
};

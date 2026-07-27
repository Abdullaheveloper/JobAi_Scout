import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type LandingHeroMetrics = {
  authenticated: boolean;
  profileStrength: number;
  profileLabel: string;
  profileStack: string;
  profileReady: boolean;
  matchPct: number | null;
  matchTitle: string;
  activeApplications: number | null;
  isLive: boolean;
};

const GUEST_FALLBACK: LandingHeroMetrics = {
  authenticated: false,
  profileStrength: 82,
  profileLabel: "Frontend Engineer",
  profileStack: "React · TypeScript",
  profileReady: true,
  matchPct: 89,
  matchTitle: "Product Designer",
  activeApplications: 3,
  isLive: false,
};

function hasValue(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return true;
  if (Array.isArray(v)) return v.length > 0;
  return Boolean(v);
}

function computeProfileStrength(profile: Tables<"profiles"> | null): number {
  if (!profile) return 0;
  if (typeof profile.profile_completion === "number" && profile.profile_completion >= 0) {
    return Math.round(Math.min(100, Math.max(0, profile.profile_completion)));
  }
  const checks = [
    profile.full_name,
    profile.email,
    profile.phone,
    profile.location,
    profile.bio,
    profile.skills,
    profile.desired_roles,
    profile.experience_years,
    profile.resume_url,
    profile.linkedin_url,
    profile.github_url,
    profile.portfolio_url,
    profile.current_company,
    profile.education,
  ];
  const done = checks.filter(hasValue).length;
  return Math.round((done / checks.length) * 100);
}

function profileDisplay(profile: Tables<"profiles"> | null) {
  const roles = (profile?.desired_roles || []).filter(Boolean);
  const skills = (profile?.skills || []).filter(Boolean).slice(0, 3);
  return {
    label: roles[0] || profile?.full_name || GUEST_FALLBACK.profileLabel,
    stack: skills.length ? skills.join(" · ") : GUEST_FALLBACK.profileStack,
  };
}

export function useLandingHeroMetrics(): LandingHeroMetrics {
  const { user, profile, loading } = useAuth();
  const [matchPct, setMatchPct] = useState<number | null>(null);
  const [matchTitle, setMatchTitle] = useState<string>(GUEST_FALLBACK.matchTitle);
  const [activeApplications, setActiveApplications] = useState<number | null>(null);

  const profileStrength = useMemo(() => computeProfileStrength(profile), [profile]);
  const display = useMemo(() => profileDisplay(profile), [profile]);

  useEffect(() => {
    if (!user) {
      setMatchPct(null);
      setMatchTitle(GUEST_FALLBACK.matchTitle);
      setActiveApplications(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const [recRes, appsRes] = await Promise.all([
        supabase
          .from("recommended_jobs")
          .select("title, match_score")
          .eq("user_id", user.id)
          .order("match_score", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("job_applications")
          .select("id, status")
          .eq("user_id", user.id),
      ]);

      if (cancelled) return;

      if (recRes.data) {
        const score = Number(recRes.data.match_score ?? 0);
        if (score > 0) {
          setMatchPct(Math.round(score));
          setMatchTitle(recRes.data.title || GUEST_FALLBACK.matchTitle);
        } else {
          setMatchPct(null);
        }
      } else {
        setMatchPct(null);
      }

      if (appsRes.data) {
        const terminal = new Set(["rejected", "accepted", "withdrawn", "closed"]);
        const active = appsRes.data.filter((row) => {
          const status = (row.status || "applied").toLowerCase();
          return !terminal.has(status);
        }).length;
        setActiveApplications(active);
      } else {
        setActiveApplications(0);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return GUEST_FALLBACK;
  }

  // While auth/profile hydrates, keep guest preview numbers to avoid layout flash.
  if (loading && !profile) {
    return GUEST_FALLBACK;
  }

  return {
    authenticated: true,
    profileStrength,
    profileLabel: display.label,
    profileStack: display.stack,
    profileReady: profileStrength >= 70,
    matchPct,
    matchTitle: matchPct != null ? matchTitle : tSafeRole(profile),
    activeApplications: activeApplications ?? 0,
    isLive: true,
  };
}

function tSafeRole(profile: Tables<"profiles"> | null): string {
  const role = profile?.desired_roles?.[0];
  return role || GUEST_FALLBACK.matchTitle;
}

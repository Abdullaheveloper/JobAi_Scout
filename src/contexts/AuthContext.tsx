import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type UserRole = "admin" | "user" | "recruiter";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: UserRole | null;
  profile: Tables<"profiles"> | null;
  recruiterProfile: Tables<"recruiter_profiles"> | null;
  approvalStatus: ApprovalStatus | null;
  isAccountApproved: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<Tables<"profiles"> | null>;
  clearApprovalNotice: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function resolveApprovalStatus(profile: Tables<"profiles"> | null, role: UserRole | null): ApprovalStatus | null {
  if (!profile) return null;
  // Admins are never gated behind approval
  if (role === "admin") return "approved";
  const status = (profile as Tables<"profiles"> & { approval_status?: string }).approval_status;
  if (
    status === "pending" ||
    status === "approved" ||
    status === "rejected" ||
    status === "expired"
  ) {
    return status;
  }
  // Pre-migration / missing column: treat as approved
  return "approved";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [recruiterProfile, setRecruiterProfile] = useState<Tables<"recruiter_profiles"> | null>(null);

  const fetchUserData = async (userId: string) => {
    const [profileRes, roleRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId).single(),
    ]);
    const nextRole = (roleRes.data?.role as UserRole) || null;
    if (profileRes.data) setProfile(profileRes.data);
    if (nextRole) setRole(nextRole);

    if (nextRole === "recruiter") {
      const { data } = await supabase.from("recruiter_profiles").select("*").eq("user_id", userId).single();
      if (data) setRecruiterProfile(data);
    } else {
      setRecruiterProfile(null);
    }

    return { profile: profileRes.data, role: nextRole };
  };

  const refreshProfile = async () => {
    if (!user) return null;
    const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    if (data) setProfile(data);
    return data ?? null;
  };

  const clearApprovalNotice = async () => {
    if (!user) return;
    await supabase.rpc("clear_approval_notice");
    setProfile((prev) => (prev ? { ...prev, approval_notice: null } : prev));
  };

  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        if (!nextSession?.user) {
          setProfile(null);
          setRole(null);
          setRecruiterProfile(null);
          setLoading(false);
          return;
        }
        // Defer fetch to avoid Supabase auth deadlock; keep loading until data arrives
        setTimeout(async () => {
          try {
            await fetchUserData(nextSession.user.id);
          } finally {
            if (!cancelled) setLoading(false);
          }
        }, 0);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: existing } }) => {
      if (cancelled) return;
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        try {
          await fetchUserData(existing.user.id);
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`profile-live-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        (payload) => setProfile(payload.new as Tables<"profiles">),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
    setRecruiterProfile(null);
  };

  const approvalStatus = resolveApprovalStatus(profile, role);
  const isAccountApproved = approvalStatus === "approved" || role === "admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        role,
        profile,
        recruiterProfile,
        approvalStatus,
        isAccountApproved,
        signOut,
        refreshProfile,
        clearApprovalNotice,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

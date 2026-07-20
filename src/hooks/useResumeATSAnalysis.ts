import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeResumeAtsAnalysis, type ResumeAtsAnalysis } from "@/lib/resume-ats";

const sessionKey = (id: string) => `jobai:ats-dismissed:${id}`;

export function useResumeATSAnalysis(userId?: string, resumePath?: string | null) {
  const [analysis, setAnalysis] = useState<ResumeAtsAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId || !resumePath) {
      setAnalysis(null);
      setLoaded(true);
      return;
    }
    setLoading(true);
    setLoaded(false);
    setError(null);
    const { data, error: queryError } = await supabase
      .from("resume_ats_analyses")
      .select("*")
      .eq("user_id", userId)
      .eq("resume_path", resumePath)
      .eq("analysis_status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (queryError) setError("Resume suggestions are temporarily unavailable.");
    setAnalysis(data ? normalizeResumeAtsAnalysis(data) : null);
    setLoading(false);
    setLoaded(true);
  }, [resumePath, userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const acceptResult = useCallback((value: unknown) => {
    const next = normalizeResumeAtsAnalysis(value);
    if (next) {
      setAnalysis(next);
      setError(null);
      if (next.id) sessionStorage.removeItem(sessionKey(next.id));
    }
    return next;
  }, []);

  const clear = useCallback(() => {
    setAnalysis(null);
    setError(null);
  }, []);

  const dismiss = useCallback(async () => {
    if (!analysis?.id) return;
    sessionStorage.setItem(sessionKey(analysis.id), "1");
    setAnalysis((current) => current ? { ...current, dismissed_at: new Date().toISOString() } : current);
    const { error: updateError } = await supabase
      .from("resume_ats_analyses")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", analysis.id)
      .eq("user_id", userId || "");
    if (updateError) console.warn("Could not persist ATS notification dismissal", updateError.message);
  }, [analysis?.id, userId]);

  const isDismissed = Boolean(
    analysis?.dismissed_at || (analysis?.id && sessionStorage.getItem(sessionKey(analysis.id)) === "1"),
  );

  return { analysis, loading, loaded, error, isDismissed, refresh, dismiss, acceptResult, clear, setError };
}

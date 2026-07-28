import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Target } from "lucide-react";
import { MatchPreferencesForm, type MatchPreferencesFormValue } from "@/components/match/MatchPreferencesForm";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  matchPreferencesFromProfile,
  saveMatchPreferences,
  shouldShowMatchPreferencesGate,
} from "@/lib/match-preferences";

type UseMatchPreferencesGateResult = {
  /** True while first-run setup is still required */
  needsSetup: boolean;
  /** Blocking overlay element to render (or null) */
  gateOverlay: ReactNode;
  minMatchThreshold: number;
  matchWeights: ReturnType<typeof matchPreferencesFromProfile>["matchWeights"];
  hasSetMatchPreferences: boolean;
  refresh: () => Promise<void>;
};

/**
 * Shared first-run gate for Automation, Browse Jobs, and Profile Settings.
 * No dismiss path — overlay closes only after a valid save.
 */
export function useMatchPreferencesGate(): UseMatchPreferencesGateResult {
  const { t } = useTranslation();
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [localComplete, setLocalComplete] = useState(false);

  const prefs = matchPreferencesFromProfile(profile as Record<string, unknown> | null);
  const needsSetup = Boolean(user) && !localComplete && shouldShowMatchPreferencesGate(prefs);

  useEffect(() => {
    if (prefs.hasSetMatchPreferences) setLocalComplete(true);
  }, [prefs.hasSetMatchPreferences]);

  // Trap focus / block Escape — no dismiss whatsoever.
  useEffect(() => {
    if (!needsSetup) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [needsSetup]);

  const handleSave = useCallback(async (value: MatchPreferencesFormValue) => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await saveMatchPreferences(user.id, {
        matchWeights: value.matchWeights,
        minMatchThreshold: value.minMatchThreshold,
        markComplete: true,
      });
      if (error) throw error;
      setLocalComplete(true);
      await refreshProfile();
      toast({ title: t("matchPreferences.toastSavedTitle"), description: t("matchPreferences.toastSavedBody") });
    } catch (error) {
      toast({
        title: t("matchPreferences.toastSaveFailed"),
        description: error instanceof Error ? error.message : t("common.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [refreshProfile, t, toast, user]);

  const refresh = useCallback(async () => {
    await refreshProfile();
  }, [refreshProfile]);

  const gateOverlay = needsSetup
    ? createPortal(
      <div
        data-testid="match-preferences-gate"
        className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 px-3 py-4 sm:px-[5vw] sm:py-[5vh] backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-preferences-gate-title"
        // No click-outside dismiss
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex max-h-[min(100dvh,100%)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="shrink-0 border-b border-border px-4 py-4 sm:px-6 sm:py-5">
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Target className="h-5 w-5 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]" dir="auto">
                {t("matchPreferences.eyebrow")}
              </span>
            </div>
            <h2 id="match-preferences-gate-title" className="font-display text-xl font-semibold text-foreground md:text-2xl" dir="auto">
              {t("matchPreferences.setupTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground" dir="auto">
              {t("matchPreferences.setupSubtitle")}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
            <MatchPreferencesForm
              mode="blocking"
              initialWeights={prefs.matchWeights}
              initialThreshold={prefs.minMatchThreshold}
              saving={saving}
              onSave={handleSave}
            />
          </div>
        </div>
      </div>,
      document.body,
    )
    : null;

  return {
    needsSetup,
    gateOverlay,
    minMatchThreshold: prefs.minMatchThreshold,
    matchWeights: prefs.matchWeights,
    hasSetMatchPreferences: prefs.hasSetMatchPreferences || localComplete,
    refresh,
  };
}

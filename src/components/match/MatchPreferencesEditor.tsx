import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchPreferencesForm, type MatchPreferencesFormValue } from "@/components/match/MatchPreferencesForm";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  matchPreferencesFromProfile,
  saveMatchPreferences,
  type MatchWeights,
} from "@/lib/match-preferences";

/**
 * Non-blocking editor for Profile Settings — same validation as the first-run gate.
 */
export function MatchPreferencesEditor() {
  const { t } = useTranslation();
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const prefs = matchPreferencesFromProfile(profile as Record<string, unknown> | null);
  const [draftKey, setDraftKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [weights, setWeights] = useState<MatchWeights>(prefs.matchWeights);
  const [threshold, setThreshold] = useState(prefs.minMatchThreshold);

  useEffect(() => {
    const next = matchPreferencesFromProfile(profile as Record<string, unknown> | null);
    setWeights(next.matchWeights);
    setThreshold(next.minMatchThreshold);
  }, [profile]);

  const handleSave = async (value: MatchPreferencesFormValue) => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await saveMatchPreferences(user.id, {
        matchWeights: value.matchWeights,
        minMatchThreshold: value.minMatchThreshold,
        markComplete: true,
      });
      if (error) throw error;
      setWeights(value.matchWeights);
      setThreshold(value.minMatchThreshold);
      setEditing(false);
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
  };

  const handleCancel = () => {
    setDraftKey((key) => key + 1);
    setEditing(false);
  };

  return (
    <Card className="border-border bg-card shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display" dir="auto">
          <Target className="h-5 w-5 text-primary" />
          {t("matchPreferences.editorTitle")}
        </CardTitle>
        <CardDescription dir="auto">{t("matchPreferences.editorSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {!editing ? (
          <div className="space-y-4">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p className="text-muted-foreground" dir="auto">
                {t("matchPreferences.thresholdSummary", { threshold })}
              </p>
              <p className="text-muted-foreground" dir="auto">
                {t("matchPreferences.weightsSummary", {
                  count: Object.keys(weights).length,
                  skills: Number(weights.skills) || 0,
                })}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              onClick={() => setEditing(true)}
            >
              {t("matchPreferences.editButton")}
            </button>
          </div>
        ) : (
          <MatchPreferencesForm
            key={draftKey}
            mode="edit"
            initialWeights={weights}
            initialThreshold={threshold}
            saving={saving}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        )}
      </CardContent>
    </Card>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { MixedDir } from "@/components/MixedDir";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Gauge, History, Loader2, RefreshCw, Search, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isRtlLocale, resolveLocale } from "@/i18n/languages";
import {
  FEATURE_LABELS,
  USAGE_FEATURES,
  type UsageFeature,
  type UsagePeriod,
} from "@/lib/usage-limits-client";
import { matchesUsageFilters, type UsageRatioFilters } from "@/lib/admin-usage-filters";

type FeatureState = {
  feature: UsageFeature;
  featureLabel: string;
  used: number;
  maxCount: number | null;
  period: UsagePeriod;
  source: "user" | "global" | "unlimited";
  hasOverride: boolean;
  overrideId: string | null;
  resetPeriod?: "fresh" | "none";
};

type UserRow = {
  userId: string;
  fullName: string | null;
  email: string | null;
  features: FeatureState[];
};

type GlobalDefault = {
  feature: UsageFeature;
  featureLabel: string;
  maxCount: number | null;
  period: UsagePeriod;
  limitId: string | null;
  hasDefault: boolean;
  resetPeriod?: "fresh" | "none";
};

type AuditRow = {
  id: string;
  admin_email: string | null;
  target_user_email: string | null;
  created_at: string;
  metadata: {
    kind?: string;
    feature?: string;
    featureLabel?: string;
    from?: { maxCount: number; period: string } | null;
    to?: { maxCount: number; period: string } | null;
    full_name?: string | null;
  };
};

type EditTarget =
  | { kind: "global"; feature: UsageFeature }
  | { kind: "user"; userId: string; feature: UsageFeature; name: string };

const PERIOD_KEYS: UsagePeriod[] = ["day", "week"];

function usageSummary(
  used: number,
  maxCount: number | null,
  period: UsagePeriod,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (maxCount == null) return t("admin.usageUnlimited");
  const periodLabel = t(`admin.usagePeriodWindow_${period}`, {
    defaultValue: period === "day" ? "today" : period === "month" ? "this month" : "this year",
  });
  return t("admin.usageUsedOf", { used, max: maxCount, period: periodLabel });
}

export default function AdminUsageLimits() {
  const { t, i18n } = useTranslation();
  const tableDir = isRtlLocale(resolveLocale(i18n.resolvedLanguage || i18n.language)) ? "rtl" : "ltr";
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [ratioFilters, setRatioFilters] = useState<UsageRatioFilters>({});
  const [users, setUsers] = useState<UserRow[]>([]);
  const [globals, setGlobals] = useState<GlobalDefault[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editMax, setEditMax] = useState("10");
  const [editPeriod, setEditPeriod] = useState<UsagePeriod>("day");
  const [editReset, setEditReset] = useState<"fresh" | "none">("fresh");
  const [editUsed, setEditUsed] = useState("0");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-usage-limits", {
        body: { action: "list" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setUsers(data.users || []);
      setGlobals(data.globalDefaults || []);
      setAudit(data.audit || []);
    } catch (err: unknown) {
      toast({
        title: t("admin.usageLoadFailed"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => matchesUsageFilters(user, search, ratioFilters));
  }, [users, search, ratioFilters]);

  const filteredAudit = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return audit;
    return audit.filter((row) => {
      const email = (row.target_user_email || "").toLowerCase();
      const name = (row.metadata?.full_name || "").toLowerCase();
      const feature = (row.metadata?.featureLabel || row.metadata?.feature || "").toLowerCase();
      const adminEmail = (row.admin_email || "").toLowerCase();
      return email.includes(q) || name.includes(q) || feature.includes(q) || adminEmail.includes(q);
    });
  }, [audit, search]);

  const openEdit = (target: EditTarget, currentMax: number | null, currentPeriod: UsagePeriod, resetPeriod: "fresh" | "none" = "fresh", used = 0) => {
    setEditTarget(target);
    setEditMax(currentMax == null ? "10" : String(currentMax));
    setEditPeriod(currentPeriod);
    setEditReset(resetPeriod);
    setEditUsed(String(used));
    setEditOpen(true);
  };

  const saveLimit = async () => {
    if (!editTarget) return;
    const maxCount = Number(editMax);
    if (!Number.isInteger(maxCount) || maxCount < 0) {
      toast({ title: t("admin.usageInvalidMax"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-usage-limits", {
        body: {
          action: "upsert",
          feature: editTarget.feature,
          maxCount,
          period: editPeriod,
          resetPeriod: editReset,
          targetUserId: editTarget.kind === "user" ? editTarget.userId : null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: t("admin.usageSaved") });
      setEditOpen(false);
      await load();
    } catch (err: unknown) {
      toast({
        title: t("admin.usageSaveFailed"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const removeOverride = async (userId: string, feature: UsageFeature) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-usage-limits", {
        body: { action: "remove_override", targetUserId: userId, feature },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: t("admin.usageOverrideRemoved") });
      await load();
    } catch (err: unknown) {
      toast({
        title: t("admin.usageSaveFailed"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetUsage = async (userId: string, feature: UsageFeature) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-usage-limits", { body: { action: "reset_usage", targetUserId: userId, feature } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (editTarget.kind === "user") {
        const used = Number(editUsed);
        if (!Number.isInteger(used) || used < 0) throw new Error("Current usage must be zero or greater");
        const usageResult = await supabase.functions.invoke("manage-usage-limits", { body: { action: "set_usage", targetUserId: editTarget.userId, feature: editTarget.feature, used } });
        if (usageResult.error) throw usageResult.error;
        if (usageResult.data?.error) throw new Error(usageResult.data.error);
      }
      toast({ title: "Usage reset to zero" });
      await load();
    } catch (err) {
      toast({ title: "Could not reset usage", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally { setSaving(false); }
  };

  const featureTitle = (feature: UsageFeature) =>
    t(`admin.usageFeature_${feature}`, { defaultValue: FEATURE_LABELS[feature] });

  // The frontend and Edge Function can briefly be on different deployment
  // versions. Never crash the whole admin route when a newly introduced meter
  // is absent from an older API response.
  const featureState = (user: UserRow, feature: UsageFeature): FeatureState =>
    user.features.find((item) => item.feature === feature) ?? {
      feature,
      featureLabel: FEATURE_LABELS[feature],
      used: 0,
      maxCount: null,
      period: "day",
      source: "unlimited",
      hasOverride: false,
      overrideId: null,
    };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl flex items-center gap-2">
              <Gauge className="h-8 w-8 text-primary" />
              <MixedDir>{t("admin.usageLimitsTitle")}</MixedDir>
            </h1>
            <p className="text-muted-foreground mt-1" dir="auto">
              <MixedDir>{t("admin.usageLimitsSubtitle")}</MixedDir>
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ms-2">{t("admin.refresh")}</span>
          </Button>
        </div>

        {/* Global defaults */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg" dir="auto">{t("admin.usageGlobalDefaults")}</CardTitle>
            <p className="text-sm text-muted-foreground" dir="auto">{t("admin.usageGlobalDefaultsHint")}</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(globals.length ? globals : USAGE_FEATURES.map((f) => ({
                feature: f,
                featureLabel: FEATURE_LABELS[f],
                maxCount: null as number | null,
                period: "day" as UsagePeriod,
                limitId: null,
                hasDefault: false,
              }))).map((g) => (
                <div key={g.feature} className="rounded-lg border border-border/60 p-3 space-y-2">
                  <div className="font-medium">{featureTitle(g.feature)}</div>
                  <div className="text-sm text-muted-foreground">
                    {g.maxCount == null
                      ? t("admin.usageUnlimited")
                      : t("admin.usageLimitValue", {
                          max: g.maxCount,
                          period: t(`admin.usagePeriod_${g.period}`),
                        })}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openEdit({ kind: "global", feature: g.feature }, g.maxCount, g.period, g.resetPeriod)}
                  >
                    {t("admin.usageEditLimit")}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Real-time combined filters */}
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">User</span>
              <div className="relative">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="ps-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or email" autoComplete="off" />
              </div>
            </label>
            {USAGE_FEATURES.map((feature) => (
              <label key={feature} className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">{featureTitle(feature)}</span>
                <Input
                  value={ratioFilters[feature] || ""}
                  onChange={(event) => setRatioFilters((current) => ({ ...current, [feature]: event.target.value }))}
                  placeholder="e.g. 1/4"
                  inputMode="text"
                  autoComplete="off"
                  aria-label={`${featureTitle(feature)} usage ratio`}
                />
              </label>
            ))}
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <Card className="hidden lg:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto" dir={tableDir}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin.usageColUser")}</TableHead>
                        {USAGE_FEATURES.map((f) => (
                          <TableHead key={f}>{featureTitle(f)}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.userId}>
                          <TableCell>
                            <div className="font-medium">{user.fullName || "—"}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </TableCell>
                          {USAGE_FEATURES.map((feature) => {
                            const state = featureState(user, feature);
                            return (
                              <TableCell key={feature} className="align-top">
                                <div className="space-y-2 min-w-[9rem]">
                                  <div className="text-sm">
                                    {usageSummary(state.used, state.maxCount, state.period, t)}
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {state.hasOverride ? (
                                      <Badge variant="outline">{t("admin.usageOverride")}</Badge>
                                    ) : (
                                      <Badge variant="secondary">{t("admin.usageFromGlobal")}</Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        openEdit(
                                          {
                                            kind: "user",
                                            userId: user.userId,
                                            feature,
                                            name: user.fullName || user.email || user.userId,
                                          },
                                          state.maxCount,
                                          state.period,
                                          state.resetPeriod,
                                          state.used,
                                        )
                                      }
                                    >
                                      {t("admin.usageEditLimit")}
                                    </Button>
                                    {state.hasOverride && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => void removeOverride(user.userId, feature)}
                                        disabled={saving}
                                      >
                                        <Undo2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    <Button size="sm" variant="ghost" onClick={() => void resetUsage(user.userId, feature)} disabled={saving}>Reset usage</Button>
                                  </div>
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                      {filteredUsers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={1 + USAGE_FEATURES.length} className="text-center text-muted-foreground py-10">
                            {t("admin.usageNoUsers")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Mobile stacked cards */}
            <div className="grid gap-3 lg:hidden">
              {filteredUsers.map((user) => (
                <Card key={user.userId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{user.fullName || "—"}</CardTitle>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {USAGE_FEATURES.map((feature) => {
                      const state = featureState(user, feature);
                      return (
                        <div key={feature} className="rounded-md border border-border/50 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm">{featureTitle(feature)}</span>
                            {state.hasOverride ? (
                              <Badge variant="outline">{t("admin.usageOverride")}</Badge>
                            ) : (
                              <Badge variant="secondary">{t("admin.usageFromGlobal")}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {usageSummary(state.used, state.maxCount, state.period, t)}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() =>
                                openEdit(
                                  {
                                    kind: "user",
                                    userId: user.userId,
                                    feature,
                                    name: user.fullName || user.email || user.userId,
                                  },
                                  state.maxCount,
                                  state.period,
                                  state.resetPeriod,
                                  state.used,
                                )
                              }
                            >
                              {t("admin.usageEditLimit")}
                            </Button>
                            {state.hasOverride && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void removeOverride(user.userId, feature)}
                                disabled={saving}
                              >
                                <Undo2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => void resetUsage(user.userId, feature)} disabled={saving}>Reset usage</Button>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
              {filteredUsers.length === 0 && (
                <p className="text-center text-muted-foreground py-8">{t("admin.usageNoUsers")}</p>
              )}
            </div>
          </>
        )}

        {/* Audit trail */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" />
              {t("admin.usageAuditTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredAudit.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {search.trim() ? t("admin.usageAuditFilteredEmpty") : t("admin.usageAuditEmpty")}
              </p>
            ) : (
              filteredAudit.slice(0, 40).map((row) => {
                const meta = row.metadata || {};
                const from = meta.from
                  ? `${meta.from.maxCount}/${meta.from.period}`
                  : "—";
                const to = meta.to
                  ? `${meta.to.maxCount}/${meta.to.period}`
                  : t("admin.usageFallbackGlobal");
                return (
                  <div key={row.id} className="text-sm border-b border-border/40 py-2 last:border-0">
                    <div className="font-medium">
                      {meta.featureLabel || meta.feature || "—"}
                      {meta.kind === "global_default"
                        ? ` · ${t("admin.usageGlobalDefaults")}`
                        : row.target_user_email
                          ? ` · ${row.target_user_email}`
                          : ""}
                    </div>
                    <div className="text-muted-foreground">
                      {row.admin_email || "admin"} · {new Date(row.created_at).toLocaleString()} · {from} → {to}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.usageEditLimit")}</DialogTitle>
            <DialogDescription dir="auto">
              {editTarget?.kind === "global"
                ? t("admin.usageEditGlobalDesc", { feature: editTarget ? featureTitle(editTarget.feature) : "" })
                : t("admin.usageEditUserDesc", {
                    feature: editTarget ? featureTitle(editTarget.feature) : "",
                    name: editTarget && editTarget.kind === "user" ? editTarget.name : "",
                  })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="usage-max">{t("admin.usageMaxCount")}</Label>
              <Input
                id="usage-max"
                type="number"
                min={0}
                step={1}
                value={editMax}
                onChange={(e) => setEditMax(e.target.value)}
              />
              <p className="text-xs text-muted-foreground" dir="auto">{t("admin.usageMaxHint")}</p>
            </div>
            <div className="space-y-2">
              <Label>Reset policy</Label>
              <Select value={editReset} onValueChange={(value) => setEditReset(value as "fresh" | "none")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fresh">Fresh — resets automatically</SelectItem>
                  <SelectItem value="none">No Fresh — admin resets manually</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">No Fresh usage remains locked until an administrator resets it or raises the limit.</p>
            </div>
            {editTarget?.kind === "user" && <div className="space-y-2">
              <Label htmlFor="usage-current">Current usage</Label>
              <Input id="usage-current" type="number" min={0} step={1} value={editUsed} onChange={(event) => setEditUsed(event.target.value)} />
              <p className="text-xs text-muted-foreground">Set 0 to reset completely, or enter another value such as 5 for 5/15.</p>
            </div>}
            {editReset === "fresh" && <div className="space-y-2">
              <Label>Refresh interval</Label>
              <Select value={editPeriod} onValueChange={(v) => setEditPeriod(v as UsagePeriod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_KEYS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`admin.usagePeriod_${p}`, { defaultValue: p === "day" ? "Daily" : "Weekly" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void saveLimit()} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("admin.usageSave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  FEATURE_LABELS,
  USAGE_FEATURES,
  countUsageInWindow,
  isUsageFeature,
  isUsagePeriod,
  resolveUsageLimit,
  windowStart,
  type UsageFeature,
  type UsageLimitRow,
  type UsagePeriod,
} from "../_shared/usage-limits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function counterKey(now: Date, reset: string, period: UsagePeriod): string {
  if (reset === "none") return "total";
  const local = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Karachi" }));
  if (period === "week") {
    const day = local.getDay() || 7;
    local.setDate(local.getDate() - day + 1);
    const first = new Date(local.getFullYear(), 0, 1);
    const week = Math.ceil((((local.getTime() - first.getTime()) / 86400000) + first.getDay() + 1) / 7);
    return `${local.getFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

type LimitAction = "list" | "upsert" | "remove_override" | "reset_usage" | "set_usage";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }

    const callerId = claimsData.claims.sub as string;
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .single();

    if (callerRole?.role !== "admin") {
      return json({ error: "Forbidden: admin only" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = (body.action || "list") as LimitAction;

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", callerId)
      .maybeSingle();

    if (action === "list") {
      const now = new Date();
      const [profilesRes, limitsRes, auditRes, countersRes, featuresRes] = await Promise.all([
        supabaseAdmin.from("profiles").select("user_id, full_name, email").order("full_name"),
        supabaseAdmin.from("feature_usage_limits").select("*"),
        supabaseAdmin
          .from("admin_audit_log")
          .select("*")
          .eq("action", "update_usage_limits")
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin.from("usage_counters").select("user_id,feature,period_key,used"),
        supabaseAdmin.from("usage_features").select("key,label,unit,feature_group,enabled,sort_order").eq("enabled", true).order("sort_order"),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (limitsRes.error) throw limitsRes.error;

      const limits = (limitsRes.data || []) as Array<UsageLimitRow & {
        id: string;
        updated_by: string | null;
        updated_at: string;
      }>;

      // Fetch usage logs once for the longest window we might need (1 year).
      const yearAgo = windowStart(now, "year").toISOString();
      const { data: logs, error: logsError } = await supabaseAdmin
        .from("feature_usage_log")
        .select("user_id, feature, created_at")
        .gte("created_at", yearAgo);
      if (logsError) throw logsError;

      const activeFeatures = (featuresRes.data || []).map((row) => row.key as UsageFeature);
      const globalDefaults = activeFeatures.map((feature) => {
        const row = limits.find((l) => l.user_id == null && l.feature === feature);
        return {
          feature,
          featureLabel: FEATURE_LABELS[feature],
          maxCount: row?.max_count ?? null,
          period: (row?.period as UsagePeriod | undefined) ?? "day",
          limitId: row?.id ?? null,
          hasDefault: Boolean(row),
          unit: featuresRes.data?.find((f) => f.key === feature)?.unit || "count",
          group: featuresRes.data?.find((f) => f.key === feature)?.feature_group || feature,
          resetPeriod: "fresh",
        };
      });

      const users = (profilesRes.data || []).map((profile) => {
        const features = activeFeatures.map((feature) => {
          const resolved = resolveUsageLimit(feature, profile.user_id, limits as UsageLimitRow[]);
          const override = limits.find((l) => l.user_id === profile.user_id && l.feature === feature);
          const timestamps = (logs || [])
            .filter((row) => row.user_id === profile.user_id && row.feature === feature)
            .map((row) => row.created_at as string);
          let used =
            resolved.source === "unlimited"
              ? timestamps.length
              : countUsageInWindow(timestamps, now, resolved.period);
          const resetPeriod = (override as { reset_period?: "fresh" | "none" } | undefined)?.reset_period || "fresh";
          const key = counterKey(now, resetPeriod, resolved.period);
          const counter = (countersRes.data || []).find((r) => r.user_id === profile.user_id && r.feature === feature && r.period_key === key);
          used = Number(counter?.used || 0);

          return {
            feature,
            featureLabel: FEATURE_LABELS[feature],
            used,
            maxCount: Number.isFinite(resolved.maxCount) ? resolved.maxCount : null,
            period: resolved.period,
            source: resolved.source,
            hasOverride: Boolean(override),
            overrideId: override?.id ?? null,
            resetPeriod,
            grantedAt: (override as { granted_at?: string } | undefined)?.granted_at || null,
            unit: featuresRes.data?.find((f) => f.key === feature)?.unit || "count",
            group: featuresRes.data?.find((f) => f.key === feature)?.feature_group || feature,
          };
        });

        return {
          userId: profile.user_id,
          fullName: profile.full_name,
          email: profile.email,
          features,
        };
      });

      return json({
        globalDefaults,
        users,
        audit: auditRes.data || [],
      });
    }

    if (action === "upsert") {
      const feature = body.feature;
      const period = body.period;
      const maxCount = Number(body.maxCount);
      const targetUserId = body.targetUserId == null || body.targetUserId === ""
        ? null
        : String(body.targetUserId);

      if (!isUsageFeature(feature) || !isUsagePeriod(period) || !Number.isInteger(maxCount) || maxCount < 0) {
        return json({ error: "Invalid feature, period, or maxCount" }, 400);
      }

      let previous: UsageLimitRow | null = null;
      if (targetUserId) {
        const { data } = await supabaseAdmin
          .from("feature_usage_limits")
          .select("user_id, feature, max_count, period, reset_period")
          .eq("user_id", targetUserId)
          .eq("feature", feature)
          .maybeSingle();
        previous = data as UsageLimitRow | null;
      } else {
        const { data } = await supabaseAdmin
          .from("feature_usage_limits")
          .select("user_id, feature, max_count, period, reset_period")
          .is("user_id", null)
          .eq("feature", feature)
          .maybeSingle();
        previous = data as UsageLimitRow | null;
      }

      const payload = {
        user_id: targetUserId,
        feature,
        max_count: maxCount,
        period,
        updated_by: callerId,
        updated_at: new Date().toISOString(),
        reset_period: body.resetPeriod === "none" ? "none" : "fresh",
        granted_at: targetUserId ? new Date().toISOString() : null,
      };

      let upsertError;
      if (previous) {
        const q = targetUserId
          ? supabaseAdmin
            .from("feature_usage_limits")
            .update(payload)
            .eq("user_id", targetUserId)
            .eq("feature", feature)
          : supabaseAdmin
            .from("feature_usage_limits")
            .update(payload)
            .is("user_id", null)
            .eq("feature", feature);
        ({ error: upsertError } = await q);
      } else {
        ({ error: upsertError } = await supabaseAdmin.from("feature_usage_limits").insert(payload));
      }
      if (upsertError) throw upsertError;
      if (targetUserId && previous && (previous as UsageLimitRow & { reset_period?: string }).reset_period !== payload.reset_period) {
        await supabaseAdmin.rpc("reset_metered_usage", { p_user: targetUserId, p_feature: feature });
      }

      const { data: targetProfile } = targetUserId
        ? await supabaseAdmin.from("profiles").select("email, full_name").eq("user_id", targetUserId).maybeSingle()
        : { data: null };

      await supabaseAdmin.from("admin_audit_log").insert({
        admin_id: callerId,
        admin_email: callerProfile?.email || null,
        action: "update_usage_limits",
        target_user_id: targetUserId,
        target_user_email: targetProfile?.email || null,
        metadata: {
          kind: targetUserId ? "user_override" : "global_default",
          feature,
          featureLabel: FEATURE_LABELS[feature as UsageFeature],
          from: previous
            ? { maxCount: previous.max_count, period: previous.period }
            : null,
          to: { maxCount, period },
          full_name: targetProfile?.full_name || null,
        },
      });

      return json({ success: true });
    }

    if (action === "remove_override") {
      const feature = body.feature;
      const targetUserId = String(body.targetUserId || "");
      if (!isUsageFeature(feature) || !targetUserId) {
        return json({ error: "Invalid feature or targetUserId" }, 400);
      }

      const { data: previous } = await supabaseAdmin
        .from("feature_usage_limits")
        .select("user_id, feature, max_count, period")
        .eq("user_id", targetUserId)
        .eq("feature", feature)
        .maybeSingle();

      if (!previous) {
        return json({ error: "No user override to remove" }, 404);
      }

      const { error: deleteError } = await supabaseAdmin
        .from("feature_usage_limits")
        .delete()
        .eq("user_id", targetUserId)
        .eq("feature", feature);
      if (deleteError) throw deleteError;
      await supabaseAdmin.rpc("reset_metered_usage", { p_user: targetUserId, p_feature: feature });

      const { data: targetProfile } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", targetUserId)
        .maybeSingle();

      await supabaseAdmin.from("admin_audit_log").insert({
        admin_id: callerId,
        admin_email: callerProfile?.email || null,
        action: "update_usage_limits",
        target_user_id: targetUserId,
        target_user_email: targetProfile?.email || null,
        metadata: {
          kind: "remove_override",
          feature,
          featureLabel: FEATURE_LABELS[feature],
          from: { maxCount: previous.max_count, period: previous.period },
          to: null,
          full_name: targetProfile?.full_name || null,
        },
      });

      return json({ success: true });
    }

    if (action === "reset_usage") {
      const targetUserId = String(body.targetUserId || "");
      const feature = body.feature == null ? null : body.feature;
      if (!targetUserId || (feature !== null && !isUsageFeature(feature))) return json({ error: "Invalid reset target" }, 400);
      const { error } = await supabaseAdmin.rpc("reset_metered_usage", { p_user: targetUserId, p_feature: feature });
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "set_usage") {
      const targetUserId = String(body.targetUserId || "");
      const feature = body.feature;
      const used = Number(body.used);
      if (!targetUserId || !isUsageFeature(feature) || !Number.isInteger(used) || used < 0) return json({ error: "Invalid usage value" }, 400);
      const { error } = await supabaseAdmin.rpc("set_metered_usage", { p_user: targetUserId, p_feature: feature, p_used: used });
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("manage-usage-limits error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const content = read("extension/content.js");
const endpoint = read("supabase/functions/track-extension-usage/index.ts");
const migration = read("supabase/migrations/20260804000100_extension_usage_live_telemetry.sql");
const backfill = read("supabase/migrations/20260804000200_backfill_real_extension_fill_attempts.sql");
const dashboard = read("src/pages/AdminDashboard.tsx");

describe("live extension usage telemetry", () => {
  it("reserves one fill event and completes it with actual fields", () => {
    expect(content).toContain("const usageEventId = await gateFormFillUsage()");
    expect(content).toContain("await completeFormFillUsage(usageEventId, completedFields)");
    expect(endpoint).toContain('phase === "complete"');
    expect(endpoint).toContain("field_count: safeFields.length");
    expect(endpoint).toContain('.eq("user_id", user_id)');
  });

  it("enables database updates to drive the admin tiles live", () => {
    expect(migration).toContain("ALTER PUBLICATION supabase_realtime ADD TABLE public.extension_usage");
    expect(dashboard).toContain('table: "extension_usage"');
    expect(dashboard).toContain("fillClicks: usage.length");
    expect(dashboard).toContain("fieldsFilled: totalFields");
  });

  it("backfills only genuine metered Form Fill attempts without inventing fields", () => {
    expect(backfill).toContain("usage.feature='form_fill'");
    expect(backfill).toContain("'{}'::TEXT[],0");
    expect(backfill).toContain("NOT EXISTS");
  });
});

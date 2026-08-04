import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260803000900_job_retention_archival.sql"), "utf8");
const assistantTool = readFileSync(resolve(process.cwd(), "supabase/functions/assistant-tool/index.ts"), "utf8");

describe("20-day job retention migration", () => {
  it("soft archives old jobs and never deletes jobs", () => {
    expect(migration).toContain("created_at < l_cutoff");
    expect(migration).toContain("SET is_archived=true");
    expect(migration).not.toMatch(/DELETE\s+FROM\s+(public\.)?jobs/i);
  });

  it("keeps saved archived jobs readable but excludes them from unified search", () => {
    expect(migration).toContain("saved.job_id=jobs.id AND saved.user_id=auth.uid()");
    expect(migration).toContain("posting.is_archived=false");
    expect(migration).toContain("posting.created_at >= now()-interval '20 days'");
  });

  it("schedules cleanup daily and records every run", () => {
    expect(migration).toContain("archive-expired-jobs-daily");
    expect(migration).toContain("'15 0 * * *'");
    expect(migration).toContain("INSERT INTO job_retention_runs");
  });

  it("applies retention explicitly in the service-role assistant search", () => {
    expect(assistantTool).toContain('.eq("is_archived", false)');
    expect(assistantTool).toContain('.gte("created_at", retentionCutoff)');
    expect(assistantTool).toContain("20 * 24 * 60 * 60 * 1000");
  });
});

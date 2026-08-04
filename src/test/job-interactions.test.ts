import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260803001000_job_user_interactions.sql"), "utf8");
const externalApplyMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260803001100_track_external_apply_clicks.sql"), "utf8");
const board = readFileSync(resolve(process.cwd(), "src/pages/JobBoard.tsx"), "utf8");

describe("durable job interaction history", () => {
  it("stores user-scoped viewed, opened, saved, and applied timestamps", () => {
    for (const field of ["first_viewed_at", "last_viewed_at", "opened_at", "first_saved_at", "applied_at"]) {
      expect(migration).toContain(field);
    }
    expect(migration).toContain('Users manage own job interactions');
    expect(migration).toContain("user_id=auth.uid()");
  });

  it("syncs current and future saves and applications without changing jobs", () => {
    expect(migration).toContain("sync_saved_job_interaction_trigger");
    expect(migration).toContain("sync_applied_job_interaction_trigger");
    expect(migration).toContain("Backfill current saves and applications");
    expect(migration).not.toMatch(/ALTER TABLE public\.jobs/i);
  });

  it("renders history-aware New, Viewed, Saved, and Applied states", () => {
    expect(board).toContain('markJobInteraction(job.id, "viewed")');
    expect(externalApplyMigration).toContain("p_action NOT IN ('viewed','opened','applied')");
    expect(board).toContain('markJobInteraction(job.id, "applied")');
    expect(board).toContain(">New</Badge>");
    expect(board).toContain(">Viewed</Badge>");
    expect(board).toContain(">Saved</Badge>");
    expect(board).toContain(">Applied</Badge>");
  });
});

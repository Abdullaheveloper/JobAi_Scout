import { describe, expect, it } from "vitest";
import { isStoredJobEligible, matchesStoredJobQuery, type SearchableStoredJob } from "@/lib/stored-job-search";

const jobs: SearchableStoredJob[] = [
  { title: "AI Engineer", company: "Acme", recruiter_id: "recruiter-1" },
  { title: "AI Executive", company: "Atlas", recruiter_id: null },
  { title: "AI Engineering Intern", company: "Labs", recruiter_id: null },
  { title: "Account Manager", company: "North", recruiter_id: "recruiter-2" },
  { title: "Backend Developer", company: "Beta", recruiter_id: null },
];

describe("live stored-job search", () => {
  it.each([
    ["A", ["AI Engineer", "AI Executive", "AI Engineering Intern", "Account Manager", "Backend Developer"]],
    ["AI", ["AI Engineer", "AI Executive", "AI Engineering Intern"]],
    ["AI E", ["AI Engineer", "AI Executive", "AI Engineering Intern"]],
    ["AI En", ["AI Engineer", "AI Engineering Intern"]],
    ["ai en", ["AI Engineer", "AI Engineering Intern"]],
  ])("narrows partial, prefix and case-insensitive query %s", (query, expected) => {
    expect(jobs.filter((job) => matchesStoredJobQuery(job, query)).map((job) => job.title)).toEqual(expected);
  });

  it("includes recruiter jobs and accepted saved scrape results only", () => {
    expect(isStoredJobEligible(jobs[0], null, 40)).toBe(true);
    expect(isStoredJobEligible(jobs[1], 67, 40)).toBe(true);
    expect(isStoredJobEligible(jobs[2], 39, 40)).toBe(false);
    expect(isStoredJobEligible(jobs[2], 67, 70)).toBe(false);
  });
});

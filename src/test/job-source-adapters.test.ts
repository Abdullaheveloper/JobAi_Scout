import { afterEach, describe, expect, it, vi } from "vitest";
import { collectRssJobs } from "../../supabase/functions/_shared/adapters/rss.adapter.ts";
import { collectCompanyCareerJobs, parseCompanyCareerJobPostings } from "../../supabase/functions/_shared/adapters/company-career.adapter.ts";

afterEach(() => vi.unstubAllGlobals());

describe("RSS job collection", () => {
  it("returns a bounded, relevant set and preserves scoring metadata", async () => {
    const unrelated = Array.from({ length: 507 }, (_, index) => `
      <item><title>Sales Representative ${index}</title><link>https://example.com/sales-${index}</link>
      <description>Retail sales role</description></item>`).join("");
    const xml = `<rss><channel>${unrelated}
      <item><title>AI Engineer</title><link>https://example.com/ai-engineer</link>
      <job:company>Acme AI</job:company><job:location>Karachi, Pakistan</job:location>
      <category>Python</category><category>Machine Learning</category>
      <description><![CDATA[Build AI products in Karachi]]></description></item>
      <item><title>AI Engineering Intern</title><link>https://example.com/ai-intern</link>
      <company>Beta Labs</company><location>Karachi</location></item>
    </channel></rss>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(xml, { status: 200 })));

    const jobs = await collectRssJobs("https://example.com/feed.xml", "Example Feed", undefined, {
      query: "AI Engineer", location: "Karachi", maxItems: 10,
    });

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      title: "AI Engineer", company: "Acme AI", location: "Karachi, Pakistan",
      skills: ["Python", "Machine Learning"], source_url: "https://example.com/ai-engineer",
    });
    expect(jobs.every((job) => job.title.toLowerCase().includes("ai"))).toBe(true);
  });
});

describe("company career collection", () => {
  it("reads JavaScript-only Workable boards from their public ATS API without Firecrawl", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{ title: "Full Stack Developer", shortcode: "ABC", url: "https://apply.workable.com/lucidya/j/ABC/", location: { city: "Riyadh" } }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const jobs = await collectCompanyCareerJobs("https://apply.workable.com/lucidya/", "Lucidya");
    expect(jobs).toEqual([expect.objectContaining({ title: "Full Stack Developer", company: "Lucidya", location: "Riyadh" })]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v3/accounts/lucidya/jobs");
  });

  it("extracts Schema.org JobPosting records from modern careers pages", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org", "@type": "JobPosting", title: "Senior AI Engineer",
      hiringOrganization: { name: "Example Ltd" },
      jobLocation: { address: { addressLocality: "Islamabad", addressCountry: "Pakistan" } },
      description: "<p>Build production AI systems.</p>", employmentType: "FULL_TIME",
      url: "/careers/ai-engineer", datePosted: "2026-08-01",
    })}</script>`;

    expect(parseCompanyCareerJobPostings(html, "https://example.com/jobs", "Fallback Co")).toEqual([
      expect.objectContaining({
        title: "Senior AI Engineer", company: "Example Ltd", location: "Islamabad, Pakistan",
        source_url: "https://example.com/careers/ai-engineer", job_type: "FULL_TIME",
      }),
    ]);
  });
});

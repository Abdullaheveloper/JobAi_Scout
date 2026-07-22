import type { NormalizedJob } from "../job-collection.ts";

const value = (xml: string, tag: string) => (xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"))?.[1] || "").replace(/<[^>]+>/g, "").trim();
const RSS_FEED_ATTEMPT_MS = 95_000;

export async function collectRssJobs(url: string, name: string): Promise<NormalizedJob[]> {
  const response = await fetch(url, { headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(RSS_FEED_ATTEMPT_MS) });
  if (!response.ok) throw new Error(`RSS feed failed (${response.status})`);
  const xml = await response.text();
  const entries = xml.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi) || [];
  return entries.map((entry) => {
    const link = value(entry, "link") || entry.match(/<link[^>]+href=["']([^"']+)/i)?.[1] || null;
    return { title: value(entry, "title"), company: name, location: null, description: value(entry, "description") || value(entry, "summary") || null, skills: [], job_type: null, work_mode: null, experience_level: null, salary_min: null, salary_max: null, salary_currency: null, source: "rss", source_job_id: value(entry, "guid") || value(entry, "id") || link, source_url: link, recruiter_id: null, posted_at: value(entry, "pubDate") || value(entry, "updated") || value(entry, "published") || null };
  });
}

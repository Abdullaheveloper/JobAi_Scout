import type { NormalizedJob } from "../job-collection.ts";

const decode = (input: string) => input
  .replace(/<!\[CDATA\[|\]\]>/g, "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#x2F;/gi, "/")
  .replace(/\s+/g, " ").trim();

const escapeTag = (tag: string) => tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const value = (xml: string, ...tags: string[]) => {
  for (const tag of tags) {
    const match = xml.match(new RegExp(`<${escapeTag(tag)}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapeTag(tag)}>`, "i"));
    if (match?.[1]) return decode(match[1]);
  }
  return "";
};

const terms = (input: string) => [...new Set(input.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, " ").split(/\s+/).filter((term) => term.length >= 2))];
const tokens = (input: string) => input.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, " ").split(/\s+/).filter(Boolean);
const hasTerm = (haystack: string[], term: string) => haystack.some((token) => token === term || (term.length >= 3 && token.startsWith(term)));

export async function collectRssJobs(
  url: string,
  name: string,
  signal?: AbortSignal,
  options: { query?: string; location?: string; maxItems?: number } = {},
): Promise<NormalizedJob[]> {
  const response = await fetch(url, { headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml", "User-Agent": "JobAI-Scout/1.0 (+job-feed-reader)" }, signal });
  if (!response.ok) throw new Error(`RSS feed failed (${response.status})`);
  const xml = await response.text();
  const entries = xml.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi) || [];
  const queryTerms = terms(options.query || "");
  const locationTerms = terms(options.location || "");
  const parsed = entries.map((entry) => {
    const link = value(entry, "link") || entry.match(/<link[^>]+href=["']([^"']+)/i)?.[1] || null;
    const title = value(entry, "title");
    const description = value(entry, "content:encoded", "description", "summary", "content") || null;
    const company = value(entry, "job:company", "job_listing:company", "company", "dc:creator", "author", "source") || name;
    const location = value(entry, "job:location", "job_listing:location", "location", "job:city", "region") || null;
    const categories = [...entry.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi)].map((match) => decode(match[1])).filter(Boolean);
    const evidence = `${title} ${company} ${location || ""} ${description || ""} ${categories.join(" ")}`.toLowerCase();
    const evidenceTokens = tokens(evidence);
    const titleTokens = tokens(title);
    const queryHits = queryTerms.filter((term) => hasTerm(evidenceTokens, term)).length;
    const locationHits = locationTerms.filter((term) => hasTerm(evidenceTokens, term)).length;
    const relevance = queryHits * 10 + locationHits * 3 + (queryTerms.length && queryTerms.every((term) => hasTerm(titleTokens, term)) ? 20 : 0);
    return {
      relevance,
      job: { title, company, location, description, skills: categories, job_type: value(entry, "job:type", "job_listing:job_type", "employmentType") || null, work_mode: /\bremote\b/i.test(evidence) ? "remote" : /\bhybrid\b/i.test(evidence) ? "hybrid" : null, experience_level: value(entry, "job:experience", "experienceLevel") || null, salary_min: null, salary_max: null, salary_currency: null, source: "rss", source_job_id: value(entry, "guid", "id") || link, source_url: link, recruiter_id: null, posted_at: value(entry, "pubDate", "updated", "published", "dc:date") || null } satisfies NormalizedJob,
    };
  }).filter(({ job, relevance }) => job.title && job.source_url && (!queryTerms.length || relevance > 0));

  return parsed.sort((left, right) => right.relevance - left.relevance).slice(0, Math.min(Math.max(options.maxItems || 25, 1), 50)).map(({ job }) => job);
}

import { createClient } from "npm:@supabase/supabase-js@2";
import { extractCvText, type ExtractionResult } from "../_shared/cv-extraction.ts";
import {
  buildCareerProfileFromExperience,
  buildExperienceFieldMetadata,
  clampExperienceYears,
  collectCredentialsFromExtracted,
  confidenceForCvReplacementField,
  mergeCareerProfileSections,
  normalizeExtractedData,
  resolveCvReplacementStatus,
} from "../_shared/cv-profile-merge.ts";
import { analyzeAndSaveResumeAts } from "../_shared/ats-resume-analysis.ts";
import { generateGeminiJson } from "../_shared/gemini.ts";
import {
  applyTaxonomyToExtractedData,
  jobTaxonomy,
  locationTaxonomy,
  normalizeListWithTaxonomy,
  normalizeWithTaxonomy,
  skillsTaxonomy,
} from "../_shared/taxonomy/normalizeTaxonomy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert CV/Resume data extractor. Extract ALL information from the CV exactly as written. Do NOT invent, assume, or add anything not present in the CV. Only return what is explicitly stated in the document.

Fuzzy section synonyms (treat misspellings as equivalent):
- Bio / summary: Professional Summary, Summary, About Me, Objective, Career Objective, Profile, Personal Profile → cvSummary
- Education: Education, Academic Background, Qualifications, Academic Qualifications, Studies → education
- Experience: Experience, Work Experience, Employment, Work History, Professional Background, Career History, Internships → experience entries with type "job" or "internship"
- Projects: Projects, Selected Projects, Personal Projects, Academic Projects → experience entries with type "project" when there is no dedicated work history (and also when listed separately)
- Skills: Skills, Technical Skills, Core Competencies, Expertise, Technologies, Tech Stack
- Certifications / Credentials: Certifications, Certificates, Credentials, Awards, Publications, Licenses, Achievements → certifications array AND structured credentials
- Awards / Publications / Achievements headers → credentials with type award or publication

Rules:
- Detect section labels fuzzily, not by exact spelling.
- When a label is absent, use positional and contextual evidence. A prominent person-like line near the top and next to contact details may be the name; concise comma-separated technologies near a skills-like region may be skills.
- Bio / cvSummary: Prefer text under Professional Summary / Summary / About Me / Objective / Career Objective / Profile. If no such header exists, a short 2–4 sentence paragraph directly under the name/contact block at the top is the bio — copy it into cvSummary as written (do not rewrite into a different narrative). Do not invent a first-person essay when a clear summary paragraph already exists; use that paragraph.
- Positional inference must remain conservative. If evidence is ambiguous, return the candidate value only when supported and mark it uncertain with lower confidence. Never use a company, reference, project, or document title as the candidate name.
- Extract the person's full name, email, phone, location exactly as written
- Extract LinkedIn and GitHub URLs if present
- Extract portfolio/personal website URL if present
- Company (currentCompany): Use the most recent employer/internship organization. Also search non-obvious places: internship lines inside Certifications, patterns like "[Role] at [Company]", "Internship from [Company]", "[Company] |", verification URLs next to an internship. Example: "Artificial Intelligence Internship from Kaizen Hive|http://..." → currentCompany = "Kaizen Hive".
- List all technical and soft skills mentioned
- List job titles/roles the person has held or is targeting (include headline roles like "AI Engineer")
- Experience years: If the CV explicitly states total experience (e.g. "3 years experience"), put that number in experienceYears. Otherwise leave experienceYears as 0 and still extract every internship/project/job with dates or duration phrases ("3 months", "6 weeks", "1 year") so the server can auto-calculate. Use fractional years when stated. Cap sensible values at 0–40.
- Education: Parse multi-line entries as ONE entry — e.g. degree+date on one line and institution (often italicized) on the next. Join with " — " or "; ". Include EVERY education entry. NEVER drop or reject education because dates look inconsistent (e.g. "2022 — 2026 Completed"). Extract raw text as-is into education AND also populate educationEntries with structured rows (degree, institution, startYear, endYear, status Completed|Ongoing).
- Extract all certifications / credentials / awards / publications / licenses / achievements into certifications[] AND structured credentials[] (title, issuer, date, verificationLink, type). Do NOT put internships into credentials[] — internship lines (even under a Certifications header, and even with verify-certificate URLs) belong only in experience with type "internship" (company + url when present). You may still list the raw internship line in certifications[] for company inference, but never as a credentials[] object.
- Capture verification URLs for real certificates/awards as credential verificationLink values. Internship verify links go on the experience.url field only.
- Extract all languages spoken if mentioned
- Experience array (required when any roles, internships, or projects exist):
  - Each item: title, company (empty string if none), description (bullets joined), dates (raw), type ("job" | "internship" | "project"), url (verification/project link if present)
  - If there is NO dedicated Work Experience / Employment section, treat Projects as experience-equivalent: each project → type "project", title = project name, description = bullets
  - Internship mentions anywhere (including Certifications) → type "internship" with company name and url when present
  - Traditional jobs → type "job"
- Handle both well-structured CVs and unstructured ones. Extract whatever data is available regardless of format.

You must respond with a JSON object matching this exact schema:
{
  "fullName": "string",
  "email": "string (empty if not found)",
  "phone": "string (empty if not found)",
  "location": "string (empty if not found)",
  "linkedinUrl": "string (empty if not found)",
  "githubUrl": "string (empty if not found)",
  "portfolioUrl": "string (empty if not found)",
  "currentCompany": "string (empty if not found)",
  "skills": ["string"],
  "suggestedRoles": ["string"],
  "experienceYears": 0,
  "education": "string (empty if not found; include all degrees/institutions/dates as raw text)",
  "educationEntries": [
    {
      "degree": "string",
      "institution": "string",
      "startYear": "string (YYYY or empty)",
      "endYear": "string (YYYY or empty)",
      "status": "Completed | Ongoing | empty",
      "fieldOfStudy": "string",
      "grade": "string"
    }
  ],
  "certifications": ["string"],
  "credentials": [
    {
      "title": "string",
      "issuer": "string",
      "date": "string or null",
      "verificationLink": "string (empty if not found)",
      "type": "certification | award | publication"
    }
  ],
  "languages": ["string"],
  "cvSummary": "string (Professional Summary / bio paragraph; empty if not found)",
  "experience": [
    {
      "title": "string",
      "company": "string (empty if not found)",
      "description": "string",
      "dates": "string",
      "type": "job | internship | project",
      "url": "string (empty if not found)"
    }
  ],
  "fieldStatus": {
    "fullName": "present | missing | uncertain",
    "email": "present | missing | uncertain",
    "phone": "present | missing | uncertain",
    "location": "present | missing | uncertain",
    "linkedinUrl": "present | missing | uncertain",
    "githubUrl": "present | missing | uncertain",
    "portfolioUrl": "present | missing | uncertain",
    "currentCompany": "present | missing | uncertain",
    "skills": "present | missing | uncertain",
    "suggestedRoles": "present | missing | uncertain",
    "experienceYears": "present | missing | uncertain",
    "education": "present | missing | uncertain",
    "certifications": "present | missing | uncertain",
    "languages": "present | missing | uncertain",
    "cvSummary": "present | missing | uncertain",
    "experience": "present | missing | uncertain"
  },
  "fieldConfidence": {
    "fullName": 0.0,
    "email": 0.0,
    "phone": 0.0,
    "location": 0.0,
    "linkedinUrl": 0.0,
    "githubUrl": 0.0,
    "portfolioUrl": 0.0,
    "currentCompany": 0.0,
    "skills": 0.0,
    "suggestedRoles": 0.0,
    "experienceYears": 0.0,
    "education": 0.0,
    "certifications": 0.0,
    "languages": 0.0,
    "cvSummary": 0.0,
    "experience": 0.0
  }
}`;

const SECTION_ALIASES: Record<string, string[]> = {
  skills: ["skills", "technical skills", "core competencies", "competencies", "expertise", "technologies", "tech stack"],
  experience: ["experience", "work experience", "employment", "work history", "professional background", "career history", "internships", "internship experience"],
  education: ["education", "academic background", "qualifications", "academic qualifications", "studies"],
  summary: ["summary", "professional summary", "profile", "objective", "about me", "career objective", "personal profile", "professional profile"],
  projects: ["projects", "selected projects", "personal projects", "academic projects", "key projects"],
  certifications: [
    "certifications", "certificates", "professional certifications", "credentials", "licenses",
    "awards", "publications", "achievements", "honors", "recognition",
  ],
};

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[right.length];
}

function normalizedLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

function buildExtractionHints(cvText: string): string {
  const lines = cvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const headers: Array<{ line: number; text: string; mapsTo: string; confidence: number }> = [];
  lines.forEach((line, index) => {
    if (line.length > 60) return;
    const candidate = normalizedLabel(line.replace(/:$/, ""));
    if (!candidate || candidate.split(" ").length > 5) return;
    let best: { field: string; distance: number; aliasLength: number } | null = null;
    for (const [field, aliases] of Object.entries(SECTION_ALIASES)) {
      for (const alias of aliases) {
        const distance = editDistance(candidate, alias);
        if (!best || distance < best.distance) best = { field, distance, aliasLength: alias.length };
      }
    }
    if (best && best.distance <= Math.max(2, Math.floor(best.aliasLength * 0.22))) {
      headers.push({ line: index + 1, text: line.slice(0, 60), mapsTo: best.field, confidence: Math.max(0.55, 1 - best.distance / Math.max(candidate.length, best.aliasLength)) });
    }
  });
  const top = lines.slice(0, 12);
  const contactIndex = top.findIndex((line) => /[\w.+-]+@[\w.-]+\.[a-z]{2,}|\+?\d[\d\s().-]{7,}/i.test(line));
  const possibleName = top.slice(0, contactIndex >= 0 ? contactIndex : 5)
    .find((line) => /^[A-Za-z][A-Za-z .'-]{1,60}$/.test(line) && line.split(/\s+/).length <= 5 && !/resume|curriculum|engineer|developer|manager|student/i.test(line));
  const skillsLikeLines = lines
    .map((line, index) => ({ line: index + 1, text: line }))
    .filter(({ text }) => text.length < 180 && (text.match(/[,|•·]/g)?.length || 0) >= 2)
    .slice(0, 6);

  const summaryHeaderIndex = headers.find((header) => header.mapsTo === "summary")?.line;
  const hasWorkExperienceHeader = headers.some((header) => header.mapsTo === "experience");
  const hasProjectsHeader = headers.some((header) => header.mapsTo === "projects");
  let positionalBioCandidate: { text: string; confidence: number; reason: string } | null = null;
  if (summaryHeaderIndex) {
    const after = lines.slice(summaryHeaderIndex, summaryHeaderIndex + 6)
      .filter((line) => line.length > 40 && !headers.some((header) => header.text === line));
    if (after[0]) {
      positionalBioCandidate = {
        text: after.slice(0, 3).join(" ").slice(0, 600),
        confidence: 0.86,
        reason: "paragraph_under_summary_header",
      };
    }
  } else {
    const start = Math.max(contactIndex >= 0 ? contactIndex + 1 : 1, possibleName ? top.indexOf(possibleName) + 1 : 1);
    const paragraph = lines.slice(start, start + 5).filter((line) => {
      const normalized = normalizedLabel(line.replace(/:$/, ""));
      if (headers.some((header) => header.text === line)) return false;
      if (normalized && Object.values(SECTION_ALIASES).some((aliases) => aliases.includes(normalized))) return false;
      return line.length >= 80 && /[.!?]/.test(line);
    });
    if (paragraph.length >= 1 && paragraph.length <= 4) {
      positionalBioCandidate = {
        text: paragraph.join(" ").slice(0, 600),
        confidence: 0.62,
        reason: "short_paragraph_under_contact",
      };
    }
  }

  const internshipCompanyHits = lines
    .map((line, index) => {
      const fromMatch = line.match(/internship(?:\s*[:\-–—]\s*|\s+).{0,80}?\bfrom\s+([^|/]+)/i);
      const atMatch = line.match(/\b(?:intern(?:ship)?|trainee)\b.{0,40}?\bat\s+([^|/]+)/i);
      const pipeMatch = line.match(/\b([A-Z][A-Za-z0-9 .&'-]{1,40})\s*\|\s*https?:\/\//);
      const company = (fromMatch?.[1] || atMatch?.[1] || pipeMatch?.[1] || "").replace(/\s+/g, " ").trim();
      const url = line.match(/https?:\/\/[^\s|]+/i)?.[0] || "";
      if (!company && !/internship/i.test(line)) return null;
      if (!company) return null;
      return { line: index + 1, company, url, snippet: line.slice(0, 160) };
    })
    .filter(Boolean)
    .slice(0, 8);

  const educationMultiLineHints = lines
    .map((line, index) => {
      if (!/\b(20\d{2}|19\d{2})\b/.test(line)) return null;
      if (!/\b(bs|ba|bsc|msc|ms|phd|intermediate|bachelor|master|diploma|degree|cs|computer)\b/i.test(line)) return null;
      const next = lines[index + 1] || "";
      if (!next || next.length > 120 || /https?:\/\//i.test(next)) return null;
      if (headers.some((header) => header.line === index + 2)) return null;
      return {
        line: index + 1,
        degreeLine: line.slice(0, 120),
        institutionLine: next.slice(0, 120),
        note: "Treat these two lines as ONE education entry; do not drop for date-logic inconsistencies.",
      };
    })
    .filter(Boolean)
    .slice(0, 6);

  return JSON.stringify({
    fuzzySectionHeaders: headers.slice(0, 20),
    positionalNameCandidate: possibleName ? { text: possibleName, confidence: contactIndex >= 0 ? 0.72 : 0.58 } : null,
    positionalBioCandidate,
    skillsLikeLines,
    internshipCompanyHits,
    educationMultiLineHints,
    projectsAsExperienceFallback: !hasWorkExperienceHeader && hasProjectsHeader,
  });
}

const CV_REPLACEMENT_FIELDS = [
  ["full_name", "fullName", null],
  ["phone", "phone", null],
  ["location", "location", null],
  ["bio", "cvSummary", null],
  ["skills", "skills", []],
  ["desired_roles", "suggestedRoles", []],
  ["experience_years", "experienceYears", 0],
  ["education", "education", null],
  ["current_company", "currentCompany", null],
  ["portfolio_url", "portfolioUrl", null],
  ["github_url", "githubUrl", null],
  ["linkedin_url", "linkedinUrl", null],
  ["certifications", "certifications", []],
  ["languages", "languages", []],
  ["cv_summary", "cvSummary", null],
] as const;

function cleanString(value: unknown): string | null {
  const cleaned = String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/^[\s:;,|•·-]+|[\s:;,|•·-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

function normalizeHumanText(value: unknown): string | null {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  if (/^[A-Z\s.'-]+$/.test(cleaned)) {
    return cleaned.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  }
  return cleaned;
}

function normalizePhone(value: unknown): string | null {
  const cleaned = cleanString(value);
  if (!cleaned || !/^\+?[\d\s().-]+$/.test(cleaned)) return null;
  return cleaned.replace(/\s+/g, " ").replace(/[.-]{2,}/g, "-").replace(/[^\d+().\s-]/g, "");
}

function titleCaseToken(value: string): string {
  if (/^(AI|ML|UI|UX|API|AWS|GCP|SQL|HTML|CSS|PHP|C\+\+|C#)$/i.test(value)) return value.toUpperCase();
  if (/^[A-Z0-9.+#-]{2,}$/.test(value)) return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  return value;
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(cleanString).filter((item): item is string => Boolean(item)).map((item) =>
    item.split(/\s+/).map(titleCaseToken).join(" ")
  ))];
}

function normalizeUrl(value: unknown): string | null {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  const candidate = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
  try {
    const parsed = new URL(candidate);
    return parsed.hostname.includes(".") ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function profileValueEquals(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function buildReplacement(extracted: ReturnType<typeof normalizeExtractedData>) {
  const raw = extracted as unknown as Record<string, unknown>;
  const replacement: Record<string, unknown> = {};
  const confidenceByProfileField: Record<string, number> = {};

  for (const [profileKey, extractionKey, emptyValue] of CV_REPLACEMENT_FIELDS) {
    const rawValue = raw[extractionKey];
    const fieldStatus = resolveCvReplacementStatus(extracted, extractionKey, rawValue);
    const score = confidenceForCvReplacementField(extracted, extractionKey, rawValue);
    let value: unknown = fieldStatus === "present" ? rawValue : emptyValue;
    if (["skills", "desired_roles", "certifications", "languages"].includes(profileKey)) {
      value = normalizeList(value);
      if (profileKey === "skills") value = normalizeListWithTaxonomy(value as string[], skillsTaxonomy);
      if (profileKey === "desired_roles") value = normalizeListWithTaxonomy(value as string[], jobTaxonomy);
    }
    else if (["portfolio_url", "github_url", "linkedin_url"].includes(profileKey)) value = normalizeUrl(value);
    else if (profileKey === "phone") value = normalizePhone(value);
    else if (["full_name", "current_company"].includes(profileKey)) value = normalizeHumanText(value);
    else if (profileKey === "location") {
      const cleaned = cleanString(value);
      value = cleaned ? normalizeWithTaxonomy(cleaned, locationTaxonomy) : cleaned;
    }
    else if (profileKey === "experience_years") {
      const clamped = clampExperienceYears(value);
      value = clamped.valid ? (clamped.value ?? 0) : 0;
    }
    else value = cleanString(value);
    replacement[profileKey] = value ?? emptyValue;
    confidenceByProfileField[profileKey] = score;
  }
  return { replacement, confidenceByProfileField };
}

async function extractStructuredData(
  cvText: string,
  fileName: string,
  geminiApiKey: string,
): Promise<Record<string, unknown>> {
  return generateGeminiJson<Record<string, unknown>>(geminiApiKey, [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Extract ALL data from this CV/Resume. Only include what is supported by the document—do not make up anything.

Deterministic fuzzy-label and positional hints (hints are evidence candidates, not guaranteed facts):
${buildExtractionHints(cvText)}

File name: ${fileName}

CV Content:
${cvText.substring(0, 15000)}` },
  ], { temperature: 0.1, maxOutputTokens: 4500 });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Privileged client must stay free of the caller's JWT. Attaching Authorization
    // makes PostgREST run as `authenticated`, so RLS applies and inserts into
    // cv_profile_replacements fail (only SELECT is granted to users).
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // User-scoped client for RPCs that require auth.uid() (approve).
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) throw new Error("Invalid auth token");

    const { fileName, filePath, forceAts = false, atsOnly = false } = await req.json();
    if (typeof filePath !== "string" || !filePath.trim()) throw new Error("No file path provided");
    const normalizedPath = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalizedPath.startsWith(`${user.id}/`)) {
      return new Response(JSON.stringify({ error: "You can only analyze a resume stored in your own account." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/\.(pdf|docx)$/i.test(fileName || normalizedPath)) {
      return new Response(JSON.stringify({ error: "Please upload a PDF or DOCX resume." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: fileData, error: downloadError } = await admin.storage
      .from("resumes")
      .download(normalizedPath);
    if (downloadError) throw new Error(`Download failed: ${downloadError.message}`);
    if (fileData.size <= 0) {
      return new Response(JSON.stringify({ error: "This resume file is empty. Please upload a PDF or DOCX that contains readable content." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (fileData.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Your resume is larger than 10 MB. Please upload a smaller PDF or DOCX file." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY not configured");

    const extractorUrl = Deno.env.get("CV_EXTRACTOR_URL");
    const resolvedFileName = fileName || normalizedPath;

    // Step 1: Text extraction (PyMuPDF / pdfplumber / OCR via Python service, or Deno fallback)
    const extraction: ExtractionResult = await extractCvText(fileData, resolvedFileName, {
      serviceUrl: extractorUrl || undefined,
      geminiApiKey,
    });

    if (!extraction.text || extraction.text.length < 30) {
      return new Response(JSON.stringify({
        error: "We could not read enough text from this resume. It may be scanned, corrupted, or password protected. Try an unlocked text-based PDF or DOCX.",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(
      `CV text extracted via ${extraction.method} (${extraction.charCount} chars, OCR=${extraction.ocrUsed})`,
    );

    // Step 2: AI structured extraction from plain text
    const result = await extractStructuredData(extraction.text, resolvedFileName, geminiApiKey);
    const extracted = applyTaxonomyToExtractedData(
      normalizeExtractedData(result as Record<string, unknown>),
    );

    // A newly analyzed CV is the source of truth for every CV-managed profile
    // field. Email remains account-owned and is intentionally excluded.
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, resume_url, full_name, phone, location, bio, linkedin_url, github_url, portfolio_url, current_company, skills, desired_roles, experience_years, education, certifications, languages, cv_summary, career_profile, field_metadata")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileError || !profile) throw new Error("Could not load your profile for CV review");

    let replacementProposal: Record<string, unknown> | null = null;
    if (!atsOnly) {
      // Prefer CV-stated years; otherwise use duration/date auto-calc (already in normalizeExtractedData).
      const experienceClamp = clampExperienceYears(extracted.experienceYears);
      if (experienceClamp.valid) {
        extracted.experienceYears = experienceClamp.value ?? 0;
      } else {
        extracted.experienceYears = undefined;
        if (extracted.fieldStatus) extracted.fieldStatus.experienceYears = "uncertain";
      }
      const { replacement, confidenceByProfileField } = buildReplacement(extracted);
      const diff = CV_REPLACEMENT_FIELDS.map(([profileKey]) => {
        const previous = (profile as Record<string, unknown>)[profileKey];
        const next = replacement[profileKey];
        const previousEmpty = previous === null || previous === undefined || previous === "" || (Array.isArray(previous) && previous.length === 0) || (profileKey === "experience_years" && Number(previous) === 0);
        const nextEmpty = next === null || next === "" || (Array.isArray(next) && next.length === 0) || (profileKey === "experience_years" && Number(next) === 0);
        const change = profileValueEquals(previous, next) ? "unchanged" : previousEmpty ? "added" : nextEmpty ? "removed" : "changed";
        return { field: profileKey, change, previous: previous ?? null, next, confidence: confidenceByProfileField[profileKey] || 0 };
      });
      const uploadTimestamp = Number(normalizedPath.split("/").pop()?.split("_")[0] || 0);
      const { data: existingPending } = await admin.from("cv_profile_replacements")
        .select("id, resume_path")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .maybeSingle();
      const existingTimestamp = Number(existingPending?.resume_path?.split("/").pop()?.split("_")[0] || 0);
      if (!existingPending || !existingTimestamp || uploadTimestamp >= existingTimestamp) {
        // Privileged writes must use the clean service-role client (RLS has no INSERT/UPDATE for users).
        await admin.from("cv_profile_replacements").update({ status: "superseded" }).eq("user_id", user.id).eq("status", "pending");
        const { data: proposal, error: proposalError } = await admin.from("cv_profile_replacements").insert({
          user_id: user.id,
          profile_id: profile.id,
          resume_path: normalizedPath,
          replacement_data: replacement,
          field_confidence: confidenceByProfileField,
          diff,
        }).select("id, status, diff, created_at").single();
        if (proposalError) throw new Error(`Could not prepare CV profile replacement: ${proposalError.message}`);
        // Approve RPC is SECURITY DEFINER but still gates on auth.uid() — use the user JWT client.
        const { error: replacementError } = await userClient.rpc("approve_cv_profile_replacement", {
          p_replacement_id: proposal.id,
        });
        if (replacementError) {
          throw new Error(`Could not replace your profile from the CV: ${replacementError.message}`);
        }
        replacementProposal = { ...proposal, status: "approved" };

        // Structured career sections are not in approve_cv_profile_replacement;
        // sync them into career_profile with the same service-role client (no JWT).
        const credentials = collectCredentialsFromExtracted(extracted);
        const careerFromCv = buildCareerProfileFromExperience(extracted.experience, {
          educationEntries: extracted.educationEntries,
          education: extracted.education,
          credentials,
        });
        const nextCareer = careerFromCv
          ? mergeCareerProfileSections(profile.career_profile, careerFromCv)
          : null;
        const nextFieldMetadata = buildExperienceFieldMetadata(
          (profile as { field_metadata?: unknown }).field_metadata,
          extracted.experienceCalcNote,
        );
        const careerPatch: Record<string, unknown> = {
          field_metadata: nextFieldMetadata,
        };
        if (nextCareer) careerPatch.career_profile = nextCareer;
        const { error: careerError } = await admin
          .from("profiles")
          .update(careerPatch)
          .eq("id", profile.id);
        if (careerError) {
          console.error("career_profile sync failed:", careerError.message);
        }
      }
    }

    // Step 3: ATS feedback is intentionally isolated from the upload/parser
    // result. A model, timeout, or persistence failure must never undo a
    // successful resume upload or prevent the merge review from opening.
    let atsResult: Record<string, unknown>;
    try {
      atsResult = await analyzeAndSaveResumeAts({
        db: admin,
        userId: user.id,
        resumePath: normalizedPath,
        cvText: extraction.text,
        structuredData: extracted as unknown as Record<string, unknown>,
        geminiApiKey,
        force: Boolean(forceAts),
      }) as unknown as Record<string, unknown>;
    } catch (atsError) {
      console.error("ATS suggestion analysis failed:", atsError instanceof Error ? atsError.message : atsError);
      atsResult = {
        analysis_status: "failed",
        error: "Your resume was uploaded successfully, but ATS suggestions could not be generated.",
      };
    }

    // Step 4: return the extracted data after the atomic profile replacement.
    return new Response(
      JSON.stringify({
        ...extracted,
        _extraction: {
          method: extraction.method,
          pages: extraction.pages,
          ocrUsed: extraction.ocrUsed,
          charCount: extraction.charCount,
        },
        _saved: {
          count: replacementProposal ? CV_REPLACEMENT_FIELDS.length : 0,
          keys: replacementProposal ? CV_REPLACEMENT_FIELDS.map(([profileKey]) => profileKey) : [],
        },
        _replacement: replacementProposal,
        _ats: atsResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    if (e instanceof Response) return e;

    console.error("analyze-cv error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

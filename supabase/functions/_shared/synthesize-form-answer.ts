/**
 * Grounding + prompt helpers for open-ended application question synthesis.
 * Pure logic — unit-tested without Deno.
 */

export type CareerExperienceGrounding = {
  title?: string | null;
  company?: string | null;
  summary?: string | null;
  highlights?: string[];
  skills?: string[];
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
};

export type CareerProjectGrounding = {
  name?: string | null;
  role?: string | null;
  description?: string | null;
  highlights?: string[];
  skills?: string[];
  url?: string | null;
};

export type SynthesisGrounding = {
  skills: string[];
  experiences: CareerExperienceGrounding[];
  projects: CareerProjectGrounding[];
};

export type SynthesisResult = {
  answer: string | null;
  insufficient_data: boolean;
};

export function compactLines(values: Array<string | null | undefined>): string[] {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

export function buildSynthesisGrounding(profile: Record<string, unknown>): SynthesisGrounding {
  const career = (profile.career_profile && typeof profile.career_profile === "object"
    ? profile.career_profile
    : {}) as Record<string, unknown>;

  const skills = compactLines([
    ...(Array.isArray(profile.skills) ? profile.skills : []),
  ]);

  const experiences = (Array.isArray(career.experiences) ? career.experiences : [])
    .slice(0, 8)
    .map((raw) => {
      const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      return {
        title: typeof item.title === "string" ? item.title : null,
        company: typeof item.company === "string" ? item.company : null,
        summary: typeof item.summary === "string" ? item.summary : null,
        highlights: compactLines(Array.isArray(item.highlights) ? item.highlights as string[] : []),
        skills: compactLines(Array.isArray(item.skills) ? item.skills as string[] : []),
        startDate: typeof item.startDate === "string" ? item.startDate
          : typeof item.start_date === "string" ? item.start_date : null,
        endDate: typeof item.endDate === "string" ? item.endDate
          : typeof item.end_date === "string" ? item.end_date : null,
        isCurrent: Boolean(item.isCurrent ?? item.is_current),
      };
    });

  const projects = (Array.isArray(career.projects) ? career.projects : [])
    .slice(0, 8)
    .map((raw) => {
      const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      return {
        name: typeof item.name === "string" ? item.name : null,
        role: typeof item.role === "string" ? item.role : null,
        description: typeof item.description === "string" ? item.description : null,
        highlights: compactLines(Array.isArray(item.highlights) ? item.highlights as string[] : []),
        skills: compactLines(Array.isArray(item.skills) ? item.skills as string[] : []),
        url: typeof item.url === "string" ? item.url : null,
      };
    });

  return { skills, experiences, projects };
}

export function hasSynthesisGrounding(grounding: SynthesisGrounding): boolean {
  if (grounding.skills.length > 0) return true;
  return grounding.experiences.some((item) =>
    item.title || item.company || item.summary || (item.highlights?.length ?? 0) > 0,
  ) || grounding.projects.some((item) =>
    item.name || item.description || (item.highlights?.length ?? 0) > 0,
  );
}

export function formatGroundingForPrompt(grounding: SynthesisGrounding): string {
  const sections: string[] = [];
  if (grounding.skills.length) {
    sections.push(`Skills: ${grounding.skills.join(", ")}`);
  }
  if (grounding.experiences.length) {
    sections.push("Work experience:");
    for (const exp of grounding.experiences) {
      const lines = compactLines([
        exp.title && exp.company ? `${exp.title} at ${exp.company}` : exp.title || exp.company,
        exp.startDate || exp.endDate
          ? `${exp.startDate || "?"} – ${exp.isCurrent ? "present" : exp.endDate || "?"}`
          : null,
        exp.summary,
        ...(exp.highlights || []),
        exp.skills?.length ? `Skills used: ${exp.skills.join(", ")}` : null,
      ]);
      if (lines.length) sections.push(`- ${lines.join(" | ")}`);
    }
  }
  if (grounding.projects.length) {
    sections.push("Projects:");
    for (const project of grounding.projects) {
      const lines = compactLines([
        project.name,
        project.role ? `Role: ${project.role}` : null,
        project.description,
        ...(project.highlights || []),
        project.skills?.length ? `Skills: ${project.skills.join(", ")}` : null,
        project.url ? `URL: ${project.url}` : null,
      ]);
      if (lines.length) sections.push(`- ${lines.join(" | ")}`);
    }
  }
  return sections.join("\n");
}

export const SYNTHESIS_SYSTEM_PROMPT = `You draft short job-application answers using ONLY the applicant facts supplied in the user message.

Rules:
- Use only skills, work experience, and projects explicitly listed in the grounding data.
- Never invent employers, projects, skills, degrees, metrics, or achievements.
- Write in first person, professional tone, 2–4 sentences unless the question clearly needs a brief list.
- If the grounding data cannot support a truthful, specific answer, set insufficient_data to true and answer to null.
- Do not apologize or mention missing data in the answer text — use insufficient_data instead.`;

export function buildSynthesisUserPrompt(question: string, groundingText: string): string {
  return `Application question:
${question.trim()}

Applicant grounding (only facts you may use):
${groundingText || "(none provided)"}

Return JSON: { "answer": string | null, "insufficient_data": boolean }`;
}

export function normalizeSynthesisResult(raw: unknown): SynthesisResult {
  const payload = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const insufficient = payload.insufficient_data === true;
  const answer = typeof payload.answer === "string" ? payload.answer.trim() : null;
  if (insufficient || !answer) {
    return { answer: null, insufficient_data: true };
  }
  return { answer, insufficient_data: false };
}

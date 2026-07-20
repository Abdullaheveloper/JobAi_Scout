-- Non-blocking ATS resume feedback. The profile row is the project's existing
-- resume owner record; resume_path identifies the exact uploaded version.
CREATE TABLE IF NOT EXISTS public.resume_ats_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resume_path TEXT NOT NULL,
  resume_fingerprint TEXT NOT NULL,
  knowledge_version TEXT NOT NULL,
  career_level TEXT NOT NULL CHECK (career_level IN ('fresher', 'early_career', 'mid_level', 'senior')),
  career_level_estimated BOOLEAN NOT NULL DEFAULT false,
  ats_score INTEGER NOT NULL CHECK (ats_score BETWEEN 0 AND 100),
  keyword_match_score INTEGER NOT NULL CHECK (keyword_match_score BETWEEN 0 AND 100),
  summary TEXT NOT NULL,
  suggestions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  strengths_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis_status TEXT NOT NULL DEFAULT 'completed' CHECK (analysis_status IN ('processing', 'completed', 'failed')),
  error_message TEXT,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, resume_fingerprint, knowledge_version)
);

CREATE INDEX IF NOT EXISTS resume_ats_analyses_latest_idx
  ON public.resume_ats_analyses (user_id, created_at DESC);

ALTER TABLE public.resume_ats_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own resume ATS analyses"
  ON public.resume_ats_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can dismiss own resume ATS analyses"
  ON public.resume_ats_analyses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT ON public.resume_ats_analyses TO authenticated;
GRANT UPDATE (dismissed_at) ON public.resume_ats_analyses TO authenticated;
GRANT ALL ON public.resume_ats_analyses TO service_role;

DROP TRIGGER IF EXISTS update_resume_ats_analyses_updated_at ON public.resume_ats_analyses;
CREATE TRIGGER update_resume_ats_analyses_updated_at
  BEFORE UPDATE ON public.resume_ats_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Searchable, server-only chunks derived from knowledge/ats_resume_guide.md.
-- Keeping the guide version with each analysis makes re-analysis deterministic.
CREATE TABLE IF NOT EXISTS public.ats_resume_knowledge_chunks (
  id TEXT PRIMARY KEY,
  knowledge_version TEXT NOT NULL,
  career_levels TEXT[] NOT NULL DEFAULT '{all}',
  search_terms TEXT[] NOT NULL DEFAULT '{}',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ats_resume_knowledge_chunks ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ats_resume_knowledge_chunks TO service_role;

INSERT INTO public.ats_resume_knowledge_chunks (id, knowledge_version, career_levels, search_terms, content) VALUES
('career-levels', 'ats-guide-2026-07-20', '{all}', '{experience,career,internship,graduation}', 'Career levels: Fresher 0-1 year; Early Career over 1-2.5 years; Mid Level over 2.5-4.5 years; Senior over 4.5 years. If years are uncertain, estimate from graduation, internships, work history, projects, and title and mark the level estimated.'),
('contact', 'ats-guide-2026-07-20', '{all}', '{contact,email,phone,location,linkedin,github,portfolio}', 'A resume needs a clear name, professional title, professional email, phone, city and country. LinkedIn is recommended. GitHub is required for software, AI, data, backend, frontend, and full-stack roles. Portfolio is recommended for frontend, UI/UX, AI, ML, and data roles.'),
('summary', 'ats-guide-2026-07-20', '{all}', '{summary,objective,title}', 'A professional summary should be 3-5 lines and include experience, primary technologies, industry, strength, and career direction. Avoid generic objective statements such as looking for a job to improve skills.'),
('skills', 'ats-guide-2026-07-20', '{all}', '{skills,technologies,tools,frameworks,cloud,database}', 'Technical skills should be categorized into useful groups. Minimum breadth: Fresher 8+, Early Career 12+, Mid Level 15+, Senior 20+. Evaluate relevant languages, frameworks, databases, AI tools, cloud platforms, and development tools without inventing skills.'),
('education-certifications', 'ats-guide-2026-07-20', '{fresher,early_career,all}', '{education,degree,university,certification,coursework}', 'Education should include degree, university, duration and expected graduation where relevant. Certifications from credible providers can strengthen a resume; their absence is normally a warning, not proof of low ability.'),
('projects', 'ats-guide-2026-07-20', '{fresher,early_career,all}', '{project,github,demo,academic,personal}', 'Projects are mandatory evidence for freshers. Strong project entries include name, description, technologies, responsibilities, outcome, and where available GitHub or demo links. Prefer 2-4 relevant technical projects over vague one-line entries.'),
('experience', 'ats-guide-2026-07-20', '{early_career,mid_level,senior,all}', '{experience,employment,role,company,responsibility,achievement}', 'Each experience should show company, role, duration, responsibilities, achievements, and technologies. Replace vague duties with outcomes. Early Career should show practical impact; Mid Level ownership, scalability and team contribution; Senior leadership, architecture, strategic decisions, mentoring and business outcomes.'),
('achievements', 'ats-guide-2026-07-20', '{all}', '{achievement,metric,percent,reduced,increased,users,revenue,cost,performance}', 'Achievements should combine action, metric and value. Useful evidence includes percentages, time saved, users served, APIs built, records processed, accuracy, revenue, cost reduction, scale, or performance improvements. Combine overlapping missing-metric feedback into one actionable suggestion.'),
('action-verbs', 'ats-guide-2026-07-20', '{all}', '{built,designed,developed,implemented,optimized,worked,responsible}', 'Prefer specific verbs such as Built, Designed, Developed, Implemented, Optimized, Automated, Scaled, Architected, Led and Delivered. Avoid weak phrases such as did, worked, helped, made, responsible for, participated, or involved in.'),
('formatting', 'ats-guide-2026-07-20', '{all}', '{format,table,column,header,footer,image,icon,font,pdf,docx}', 'ATS-friendly resumes use a simple one-column layout, standard readable fonts and bullets. Tables, text boxes, headers, footers, images, icons, logos, background colors, charts, multiple columns, graphics and WordArt can reduce parsing reliability. Never claim a visual issue unless the extracted evidence supports it.'),
('length-dates-grammar', 'ats-guide-2026-07-20', '{all}', '{page,length,date,grammar,spelling}', 'Recommended length: Fresher 1 page, Early Career 1-2 pages, Mid Level 2 pages, Senior 2-3 pages. Dates should use one consistent format. Flag grammar or spelling only when actual examples are evident.'),
('keywords', 'ats-guide-2026-07-20', '{all}', '{keyword,role,matching,ai,backend,frontend,data}', 'Keyword match should be based on the candidate target role when no job description is provided and clearly treated as a general role-readiness score. Never invent job-description requirements. Relevant terms should appear naturally in summary, skills, projects and experience.'),
('scoring', 'ats-guide-2026-07-20', '{all}', '{score,grade,formatting,sections,experience,projects,skills,keywords,grammar}', 'Score the resume out of 100 using the guide: formatting 15, sections 15, experience 20, projects 15, skills 15, keywords 10, achievements 10, grammar 5 and certifications 5, normalized to 100. Grades: 90-100 Excellent, 80-89 Very Good, 70-79 Good, 60-69 Needs Improvement, below 60 Poor.'),
('feedback', 'ats-guide-2026-07-20', '{all}', '{feedback,suggestion,critical,warning,positive}', 'Feedback must be specific, short, actionable, evidence-based, career-level relevant and deduplicated. Critical means parsing/contact or essential career-level evidence is missing, warning means quality can improve, and positive records a demonstrated strength. Prioritize 3-5 improvements in the compact notification.')
ON CONFLICT (id) DO UPDATE SET
  knowledge_version = EXCLUDED.knowledge_version,
  career_levels = EXCLUDED.career_levels,
  search_terms = EXCLUDED.search_terms,
  content = EXCLUDED.content;

export type NormalizedJob = {
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  skills: string[];
  job_type: string | null;
  work_mode: string | null;
  experience_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  source: string;
  source_job_id: string | null;
  source_url: string | null;
  recruiter_id: string | null;
  posted_at: string | null;
};

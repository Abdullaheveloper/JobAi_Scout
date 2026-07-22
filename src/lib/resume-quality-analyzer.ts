/**
 * Resume Quality Analysis Tool
 * Evaluates resume against ATS standards based on knowledge/ats_resume_guide.md
 */

export interface ResumeData {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  professionalSummary?: string;
  skills?: {
    category: string;
    items: string[];
  }[];
  experience?: {
    company: string;
    role: string;
    duration: string;
    achievements: string[];
    technologies: string[];
  }[];
  projects?: {
    name: string;
    description: string;
    technologies: string[];
    github?: string;
    demo?: string;
  }[];
  education?: {
    degree: string;
    university: string;
    graduation: string;
    cgpa?: string;
  }[];
  certifications?: string[];
  profileImage?: string;
}

export interface ResumeAnalysisResult {
  score: number;
  potentialScore: number;
  issues: {
    id: string;
    label: string;
    status: 'missing' | 'weak';
    weight: number;
  }[];
  strengths: string[];
  candidateLevel: 'fresher' | 'early-career' | 'mid-level' | 'senior';
}

export const calculateExperience = (experienceYears?: number): 'fresher' | 'early-career' | 'mid-level' | 'senior' => {
  if (!experienceYears || experienceYears < 1) return 'fresher';
  if (experienceYears < 2.5) return 'early-career';
  if (experienceYears < 4.5) return 'mid-level';
  return 'senior';
};

export const analyzeResumeQuality = (resume: ResumeData): ResumeAnalysisResult => {
  const issues: ResumeAnalysisResult['issues'] = [];
  const strengths: string[] = [];
  let score = 0;
  const maxScore = 100;

  // 1. Check GitHub (Required for developers)
  if (!resume.github) {
    issues.push({
      id: 'github',
      label: 'GitHub Profile',
      status: 'missing',
      weight: 8,
    });
  } else {
    strengths.push('GitHub profile linked');
    score += 8;
  }

  // 2. Check LinkedIn
  if (!resume.linkedin) {
    issues.push({
      id: 'linkedin',
      label: 'LinkedIn Profile',
      status: 'missing',
      weight: 7,
    });
  } else {
    strengths.push('LinkedIn profile linked');
    score += 7;
  }

  // 3. Check Portfolio
  if (!resume.portfolio) {
    issues.push({
      id: 'portfolio',
      label: 'Portfolio Website',
      status: 'missing',
      weight: 6,
    });
  } else {
    strengths.push('Portfolio website included');
    score += 6;
  }

  // 4. Check Professional Summary
  if (!resume.professionalSummary || resume.professionalSummary.length < 50) {
    issues.push({
      id: 'summary',
      label: 'Professional Summary',
      status: 'missing',
      weight: 8,
    });
  } else {
    strengths.push('Professional summary present');
    score += 8;
  }

  // 5. Check Skills Categorization
  const skillsCount = resume.skills?.reduce((acc, cat) => acc + cat.items.length, 0) || 0;
  const categorized = resume.skills && resume.skills.length > 1;

  if (!categorized || skillsCount < 8) {
    issues.push({
      id: 'skills',
      label: `Categorized Skills Section (${skillsCount}/8+ needed)`,
      status: 'weak',
      weight: 12,
    });
  } else {
    strengths.push(`${skillsCount} technical skills listed`);
    score += 12;
  }

  // 6. Check Project Descriptions
  let weakProjects = 0;
  resume.projects?.forEach((project) => {
    const hasMetrics = /\d+%|\d+x|improved|reduced|increased/i.test(project.description);
    if (!project.github || !hasMetrics || project.description.length < 100) {
      weakProjects++;
    }
  });

  if (!resume.projects || resume.projects.length === 0 || weakProjects > 0) {
    issues.push({
      id: 'projects',
      label: `Project Descriptions (${weakProjects || resume.projects?.length || 0} weak)`,
      status: 'weak',
      weight: 15,
    });
  } else {
    strengths.push(`${resume.projects.length} well-documented projects`);
    score += 15;
  }

  // 7. Check Work Experience
  let weakExperience = 0;
  resume.experience?.forEach((exp) => {
    const hasQuantifiedAchievements = exp.achievements?.some((ach) =>
      /\d+%|\d+x|improved|reduced|increased|built|developed/i.test(ach)
    );
    if (!hasQuantifiedAchievements || !exp.technologies?.length) {
      weakExperience++;
    }
  });

  if (!resume.experience || resume.experience.length === 0 || weakExperience > 0) {
    issues.push({
      id: 'experience',
      label: `Work Experience (${weakExperience || 'incomplete'})`,
      status: 'weak',
      weight: 18,
    });
  } else {
    strengths.push(`${resume.experience.length} roles with quantified achievements`);
    score += 18;
  }

  // 8. Check Profile Image
  if (!resume.profileImage) {
    issues.push({
      id: 'image',
      label: 'Profile Image',
      status: 'missing',
      weight: 4,
    });
  } else {
    strengths.push('Professional profile image added');
    score += 4;
  }

  // 9. Check Education
  if (!resume.education || resume.education.length === 0) {
    issues.push({
      id: 'education',
      label: 'Education Section',
      status: 'missing',
      weight: 3,
    });
  } else {
    strengths.push('Education section complete');
    score += 3;
  }

  // 10. Check Contact Info
  const hasContactInfo = resume.email && resume.phone && resume.city && resume.country;
  if (!hasContactInfo) {
    issues.push({
      id: 'contact',
      label: 'Complete Contact Information',
      status: 'missing',
      weight: 2,
    });
  } else {
    strengths.push('Complete contact information');
    score += 2;
  }

  // 11. Check Professional Title
  if (!resume.title || resume.title === 'Developer' || resume.title === 'Programmer') {
    issues.push({
      id: 'title',
      label: 'Professional Job Title',
      status: 'weak',
      weight: 2,
    });
  } else {
    strengths.push('Clear professional title');
    score += 2;
  }

  // Calculate potential score by adding all issue weights
  const potentialScore = Math.min(100, score + issues.reduce((acc, issue) => acc + issue.weight, 0));

  return {
    score: Math.max(0, Math.min(maxScore, score)),
    potentialScore,
    issues,
    strengths,
    candidateLevel: 'fresher', // Can be enhanced to calculate based on experience
  };
};

export default analyzeResumeQuality;

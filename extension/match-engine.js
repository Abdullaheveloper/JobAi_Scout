// match-engine.js - Algorithm for generating search keywords and matching jobs

export const matchEngine = {
  // Generate search keywords automatically from profile
  generateKeywords(profile) {
    const keywords = new Set();
    const desiredRole = profile.desired_role || "";
    const skills = profile.skills || [];

    if (desiredRole) {
      keywords.add(desiredRole.trim());
      // If it is like "Frontend Developer", also add "Frontend Engineer"
      if (desiredRole.toLowerCase().includes("developer")) {
        keywords.add(desiredRole.replace(/developer/i, "Engineer").trim());
      } else if (desiredRole.toLowerCase().includes("engineer")) {
        keywords.add(desiredRole.replace(/engineer/i, "Developer").trim());
      }
    }

    // Generate Skill Developer/Engineer keywords
    skills.forEach(skill => {
      if (skill.length > 1 && skill.length < 25) {
        keywords.add(`${skill} Developer`);
        keywords.add(`${skill} Engineer`);
      }
    });

    return [...keywords].slice(0, 15); // Limit to top 15 keywords
  },

  // Calculate Match Score between scraped job and user profile
  calculateMatchScore(job, profile) {
    const explanation = {
      roleMatch: { score: 0, matched: false, detail: "No match" },
      skillsMatch: { score: 0, matched: [], total: 0 },
      locationMatch: { score: 0, detail: "No match" },
      experienceMatch: { score: 0, detail: "No match" },
      jobTypeMatch: { score: 0, detail: "No match" }
    };

    const titleLower = (job.title || "").toLowerCase();
    const descLower = (job.description || "").toLowerCase();
    const jobLocLower = (job.location || "").toLowerCase();
    const jobTypeLower = (job.employment_type || "").toLowerCase();

    const userSkills = (profile.skills || []).map(s => s.toLowerCase());
    const userRole = (profile.desired_role || "").toLowerCase();
    const userLoc = (profile.location || "").toLowerCase();
    const userType = (profile.job_type || "").toLowerCase();
    const userExpStr = (profile.experience || "Mid Level").toLowerCase();

    // 1. Role Score (40%)
    let roleScore = 0;
    const keywords = this.generateKeywords(profile);
    
    if (!userRole) {
      roleScore = 50;
      explanation.roleMatch = { score: 50, matched: true, detail: "No preferred role set" };
    } else {
      const matchesTitle = titleLower.includes(userRole) || keywords.some(k => titleLower.includes(k.toLowerCase()));
      const matchesDesc = descLower.includes(userRole) || keywords.some(k => descLower.includes(k.toLowerCase()));

      if (matchesTitle) {
        roleScore = 100;
        explanation.roleMatch = { score: 100, matched: true, detail: `Title matches role / keywords` };
      } else if (matchesDesc) {
        roleScore = 70;
        explanation.roleMatch = { score: 70, matched: true, detail: `Description matches role / keywords` };
      } else {
        roleScore = 0;
        explanation.roleMatch = { score: 0, matched: false, detail: "Role keywords not found in job title or description" };
      }
    }

    // 2. Skills Score (30%)
    let skillsScore = 0;
    const matchedSkills = [];
    
    if (userSkills.length === 0) {
      skillsScore = 50;
      explanation.skillsMatch = { score: 50, matched: [], total: 0, detail: "No skills in profile" };
    } else {
      // Find user skills present in job title or description
      userSkills.forEach(skill => {
        const skillRegex = new RegExp(`\\b${skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        if (skillRegex.test(titleLower) || skillRegex.test(descLower)) {
          matchedSkills.push(skill);
        }
      });

      // If job has specific required skills listed (e.g. from structured page scrapers)
      const jobSkills = (job.skills_required || []).map(s => s.toLowerCase());
      if (jobSkills.length > 0) {
        const intersection = jobSkills.filter(s => userSkills.includes(s));
        skillsScore = Math.round((intersection.length / jobSkills.length) * 100);
        explanation.skillsMatch = {
          score: skillsScore,
          matched: intersection,
          total: jobSkills.length,
          detail: `${intersection.length} of ${jobSkills.length} job skills matched`
        };
      } else {
        // Fallback to text matching percentage
        const matchRatio = matchedSkills.length / Math.max(1, Math.min(5, userSkills.length));
        skillsScore = Math.round(Math.min(1.0, matchRatio) * 100);
        explanation.skillsMatch = {
          score: skillsScore,
          matched: matchedSkills,
          total: userSkills.length,
          detail: `${matchedSkills.length} profile skills found in job posting`
        };
      }
    }

    // 3. Location Score (10%)
    let locationScore = 0;
    if (!userLoc) {
      locationScore = 50;
      explanation.locationMatch = { score: 50, detail: "No location preference set" };
    } else {
      const isUserRemote = userLoc.includes("remote") || userLoc.includes("anywhere");
      const isJobRemote = jobLocLower.includes("remote") || jobLocLower.includes("anywhere") || jobLocLower.includes("work from home");

      if (isUserRemote && isJobRemote) {
        locationScore = 100;
        explanation.locationMatch = { score: 100, detail: "Remote preference match" };
      } else if (jobLocLower.includes(userLoc) || userLoc.includes(jobLocLower.split(",")[0].trim())) {
        locationScore = 100;
        explanation.locationMatch = { score: 100, detail: `Location matches: ${job.location}` };
      } else if (isJobRemote) {
        locationScore = 90;
        explanation.locationMatch = { score: 90, detail: "Job is remote (flexible)" };
      } else {
        locationScore = 0;
        explanation.locationMatch = { score: 0, detail: `Location differs: ${job.location || "unspecified"}` };
      }
    }

    // 4. Experience Score (10%)
    let experienceScore = 100; // Default if not specified
    let expDetail = "No experience requirements specified";

    // Convert string experience level to approx years
    const getApproxYears = (lvl) => {
      if (lvl.includes("senior") || lvl.includes("lead") || lvl.includes("sr")) return 5;
      if (lvl.includes("mid") || lvl.includes("intermediate")) return 3;
      if (lvl.includes("junior") || lvl.includes("entry") || lvl.includes("jr")) return 1;
      return 2;
    };

    const userYears = profile.experience_years ? Number(profile.experience_years) : getApproxYears(userExpStr);
    
    // Scan job description/title for years of experience (e.g. "3+ years", "5 years")
    const expMatch = descLower.match(/(\d+)\s*(?:-\d+)?\s*(?:to\s*\d+\s*)?years?\s+(?:of\s+)?experience/i) || 
                     titleLower.match(/(\d+)\s*(?:-\d+)?\s*(?:to\s*\d+\s*)?years?\s+(?:of\s+)?experience/i);

    if (expMatch) {
      const reqYears = parseInt(expMatch[1]);
      if (userYears >= reqYears) {
        experienceScore = 100;
        expDetail = `User (${userYears}y) meets required (${reqYears}y)`;
      } else if (userYears >= reqYears - 1) {
        experienceScore = 50;
        expDetail = `User (${userYears}y) is close to required (${reqYears}y)`;
      } else {
        experienceScore = 10;
        expDetail = `User (${userYears}y) has less than required (${reqYears}y)`;
      }
    } else {
      // Check keyword level matches
      const isJobSr = titleLower.includes("senior") || titleLower.includes("sr.") || descLower.includes("senior level");
      const isJobJr = titleLower.includes("junior") || titleLower.includes("entry") || descLower.includes("entry level");
      const isUserSr = userExpStr.includes("senior") || userYears >= 5;
      const isUserJr = userExpStr.includes("entry") || userExpStr.includes("junior") || userYears <= 2;

      if (isJobSr && !isUserSr) {
        experienceScore = 40;
        expDetail = "Job requires Senior level, user is not Senior";
      } else if (isJobJr && isUserSr) {
        experienceScore = 70; // User is overqualified
        expDetail = "Job is Junior level, user is Senior (overqualified)";
      } else if (isJobSr && isUserSr) {
        experienceScore = 100;
        expDetail = "Both Senior level";
      } else if (isJobJr && isUserJr) {
        experienceScore = 100;
        expDetail = "Both Junior level";
      }
    }
    explanation.experienceMatch = { score: experienceScore, detail: expDetail };

    // 5. Job Type Score (10%)
    let jobTypeScore = 50;
    if (!userType) {
      jobTypeScore = 50;
      explanation.jobTypeMatch = { score: 50, detail: "No preferred job type set" };
    } else {
      const jt = userType.replace(/[\s-_]/g, "").toLowerCase();
      const jtJob = jobTypeLower.replace(/[\s-_]/g, "").toLowerCase();

      if (jtJob.includes(jt) || jt.includes(jtJob)) {
        jobTypeScore = 100;
        explanation.jobTypeMatch = { score: 100, detail: `Job type matches: ${job.employment_type || "Full Time"}` };
      } else if (!jobTypeLower) {
        jobTypeScore = 70;
        explanation.jobTypeMatch = { score: 70, detail: "Job type unspecified" };
      } else {
        jobTypeScore = 0;
        explanation.jobTypeMatch = { score: 0, detail: `Job type mismatch: ${job.employment_type} vs ${profile.job_type}` };
      }
    }

    // Weighted Formula:
    // finalScore = (roleScore * 0.40) + (skillScore * 0.30) + (locationScore * 0.10) + (experienceScore * 0.10) + (jobTypeScore * 0.10)
    const finalScore = Math.round(
      (roleScore * 0.40) +
      (skillsScore * 0.30) +
      (locationScore * 0.10) +
      (experienceScore * 0.10) +
      (jobTypeScore * 0.10)
    );

    return {
      score: Math.max(0, Math.min(100, finalScore)),
      explanation
    };
  }
};

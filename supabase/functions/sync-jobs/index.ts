import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── AI Match Scoring Engine ──────────────────────────────
interface Profile {
  skills: string[] | null;
  desired_roles: string[] | null;
  experience_years: number | null;
  location: string | null;
  expected_salary: string | null;
  current_company: string | null;
  education: string | null;
}

interface ScannedJob {
  title: string;
  company: string;
  company_logo?: string;
  location?: string;
  salary?: string;
  experience_required?: string;
  employment_type?: string;
  skills_required?: string[];
  description?: string;
  job_url?: string;
  posted_date?: string;
  source_portal: string;
}

interface MatchExplanation {
  skillsMatch: { score: number; matched: string[]; total: number };
  roleMatch: { score: number; matched: boolean; detail: string };
  experienceMatch: { score: number; detail: string };
  locationMatch: { score: number; detail: string };
  salaryMatch: { score: number; detail: string };
  industryMatch: { score: number; detail: string };
}

function calculateMatchScore(
  job: ScannedJob,
  profile: Profile
): { score: number; explanation: MatchExplanation } {
  // 1. Skills Match (40%)
  const userSkills = new Set((profile.skills || []).map((s) => s.toLowerCase()));
  const jobSkills = (job.skills_required || []).map((s) => s.toLowerCase());
  const matchedSkills = jobSkills.filter((s) => userSkills.has(s));
  const skillPct = jobSkills.length > 0 ? (matchedSkills.length / jobSkills.length) * 100 : 50;

  // Also check if job title contains user skills (bonus)
  const titleLower = job.title.toLowerCase();
  const titleSkillMatches = (profile.skills || []).filter((s) =>
    titleLower.includes(s.toLowerCase())
  );
  const skillBonus = Math.min(20, titleSkillMatches.length * 5);
  const skillsScore = Math.min(100, skillPct + skillBonus);

  // 2. Role Match (20%)
  const desiredRoles = (profile.desired_roles || []).map((r) => r.toLowerCase());
  const jobTitleLower = job.title.toLowerCase();
  const jobDescLower = (job.description || "").toLowerCase().slice(0, 500);
  let roleMatched = false;
  let roleDetail = "No role preference set";
  if (desiredRoles.length > 0) {
    for (const role of desiredRoles) {
      if (jobTitleLower.includes(role) || jobDescLower.includes(role)) {
        roleMatched = true;
        roleDetail = `Matches "${role}"`;
        break;
      }
    }
    if (!roleMatched) roleDetail = "Doesn't match desired roles";
  }
  const roleScore = roleMatched ? 100 : (desiredRoles.length === 0 ? 50 : 20);

  // 3. Experience Match (15%)
  const userExp = profile.experience_years || 0;
  let expScore = 70;
  let expDetail = "No experience requirement listed";
  const expText = (job.experience_required || "").toLowerCase();
  const expMatch = expText.match(/(\d+)/);
  if (expMatch) {
    const requiredExp = parseInt(expMatch[1]);
    if (userExp >= requiredExp) {
      expScore = 100;
      expDetail = `${userExp}y >= ${requiredExp}y required`;
    } else if (userExp >= requiredExp - 1) {
      expScore = 75;
      expDetail = `${userExp}y ~ ${requiredExp}y required`;
    } else {
      expScore = 30;
      expDetail = `${userExp}y < ${requiredExp}y required`;
    }
  }

  // 4. Location Match (10%)
  let locScore = 50;
  let locDetail = "Location not specified";
  const userLoc = (profile.location || "").toLowerCase();
  const jobLoc = (job.location || "").toLowerCase();
  if (userLoc && jobLoc) {
    if (jobLoc.includes(userLoc) || userLoc.includes(jobLoc.split(",")[0].trim())) {
      locScore = 100;
      locDetail = "Location matches";
    } else if (jobLoc.includes("remote") || jobLoc.includes("anywhere")) {
      locScore = 90;
      locDetail = "Remote position";
    } else {
      locScore = 20;
      locDetail = `Location differs: ${job.location}`;
    }
  } else if (jobLoc.includes("remote")) {
    locScore = 90;
    locDetail = "Remote position";
  }

  // 5. Salary Match (10%)
  let salScore = 50;
  let salDetail = "No salary information";
  const userSalary = profile.expected_salary;
  if (job.salary && userSalary) {
    const jobSalNum = parseInt((job.salary.match(/\d+/) || ["0"])[0]);
    const userSalNum = parseInt((userSalary.match(/\d+/) || ["0"])[0]);
    if (jobSalNum > 0 && userSalNum > 0) {
      const ratio = jobSalNum / userSalNum;
      if (ratio >= 0.9 && ratio <= 1.3) {
        salScore = 100;
        salDetail = "Salary matches expectations";
      } else if (ratio >= 0.7) {
        salScore = 60;
        salDetail = "Salary slightly below expectations";
      } else {
        salScore = 20;
        salDetail = "Salary below expectations";
      }
    }
  }

  // 6. Industry Match (5%)
  let indScore = 50;
  let indDetail = "Industry analysis unavailable";
  const companyLower = job.company.toLowerCase();
  if (profile.current_company) {
    const sameCompany = companyLower === profile.current_company.toLowerCase();
    if (sameCompany) {
      indScore = 100;
      indDetail = "Your current company";
    } else {
      indScore = 60;
      indDetail = "Different industry/company";
    }
  }

  // Weighted total
  const totalScore = Math.round(
    skillsScore * 0.4 +
    roleScore * 0.2 +
    expScore * 0.15 +
    locScore * 0.1 +
    salScore * 0.1 +
    indScore * 0.05
  );

  const explanation: MatchExplanation = {
    skillsMatch: {
      score: Math.round(skillsScore),
      matched: matchedSkills,
      total: jobSkills.length,
    },
    roleMatch: { score: roleScore, matched: roleMatched, detail: roleDetail },
    experienceMatch: { score: expScore, detail: expDetail },
    locationMatch: { score: locScore, detail: locDetail },
    salaryMatch: { score: salScore, detail: salDetail },
    industryMatch: { score: indScore, detail: indDetail },
  };

  return { score: Math.max(0, Math.min(100, totalScore)), explanation };
}

// ── Main handler ─────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // Verify user from auth header
    const supabaseUser = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { jobs: scannedJobs, portal } = await req.json();
    if (!Array.isArray(scannedJobs) || scannedJobs.length === 0) {
      return new Response(
        JSON.stringify({ error: "No jobs provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user profile for matching
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const userProfile: Profile = {
      skills: profile?.skills || null,
      desired_roles: profile?.desired_roles || null,
      experience_years: profile?.experience_years || null,
      location: profile?.location || null,
      expected_salary: profile?.expected_salary || null,
      current_company: profile?.current_company || null,
      education: profile?.education || null,
    };

    // Fetch existing recommended jobs for deduplication
    const { data: existingJobs } = await supabaseAdmin
      .from("recommended_jobs")
      .select("source_url, company, title")
      .eq("user_id", user.id);

    const existingSet = new Set(
      (existingJobs || []).map((j: any) =>
        j.source_url ? `url:${j.source_url}` : `ct:${j.company.toLowerCase()}|${j.title.toLowerCase()}`
      )
    );

    let jobsFound = scannedJobs.length;
    let jobsMatched = 0;
    let jobsSynced = 0;
    const results: any[] = [];

    for (const job of scannedJobs) {
      // Deduplication check
      const urlKey = job.job_url ? `url:${job.job_url}` : "";
      const ctKey = `ct:${job.company.toLowerCase()}|${job.title.toLowerCase()}`;
      if ((urlKey && existingSet.has(urlKey)) || existingSet.has(ctKey)) {
        continue;
      }

      // Calculate match score
      const { score, explanation } = calculateMatchScore(job, userProfile);

      // Apply matching rules
      const skillMatchPct = explanation.skillsMatch.score;
      let qualifies = false;

      // Rule 1: Match Score >= 60%
      if (score >= 60) qualifies = true;
      // Rule 2: Skill Match >= 80%, save even if location differs
      if (skillMatchPct >= 80) qualifies = true;
      // Rule 3: < 60% → ignore
      if (score < 60 && skillMatchPct < 80) qualifies = false;

      if (!qualifies) continue;
      jobsMatched++;

      // Insert into recommended_jobs
      const insertData = {
        user_id: user.id,
        title: job.title || "Untitled Position",
        company: job.company || "Unknown Company",
        company_logo: job.company_logo || null,
        location: job.location || null,
        description: (job.description || "").slice(0, 5000) || null,
        salary: job.salary || null,
        employment_type: job.employment_type || null,
        experience_required: job.experience_required || null,
        skills_required: job.skills_required || [],
        source_portal: job.source_portal || portal || "unknown",
        source_url: job.job_url || null,
        match_score: score,
        match_explanation: explanation,
        posted_date: job.posted_date || null,
        synced_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabaseAdmin
        .from("recommended_jobs")
        .insert(insertData);

      if (!insertError) {
        jobsSynced++;
        existingSet.add(urlKey || ctKey);
        results.push({ title: job.title, company: job.company, score });
      } else {
        console.error("Insert error:", insertError.message);
      }
    }

    // Record scan history
    await supabaseAdmin.from("scan_history").insert({
      user_id: user.id,
      portal: portal || "unknown",
      jobs_found: jobsFound,
      jobs_matched: jobsMatched,
      jobs_synced: jobsSynced,
    });

    return new Response(
      JSON.stringify({
        success: true,
        jobs_found: jobsFound,
        jobs_matched: jobsMatched,
        jobs_synced: jobsSynced,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-jobs error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

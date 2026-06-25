// job-sync-service.js - Service for job scanning, matching, and syncing with Supabase backend
import { api } from "./api.js";
import { matchEngine } from "./match-engine.js";
import { profileService } from "./profile-service.js";

export const jobSyncService = {
  // Sync scraped jobs with the backend database
  async syncJobs(session, rawJobs, portal, useProfile, onProgress) {
    let profile = null;
    if (useProfile) {
      if (onProgress) onProgress("Loading profile...", 10);
      try {
        profile = await profileService.loadProfile(session);
      } catch (e) {
        console.warn("[job-sync] Profile load failed, proceeding without profile matching:", e.message);
        profile = null;
      }
    }

    if (onProgress) onProgress("Matching jobs...", 30);
    
    const matchedJobs = [];
    const jobsFound = rawJobs.length;

    // Limit scanning to maximum 500 jobs per sync
    const jobsToProcess = rawJobs.slice(0, 500);

    for (let i = 0; i < jobsToProcess.length; i++) {
      const job = jobsToProcess[i];
      let score = 100; // default if not using profile matching
      let explanation = null;

      if (useProfile && profile) {
        try {
          const match = matchEngine.calculateMatchScore(job, profile);
          score = match.score;
          explanation = match.explanation;
        } catch (e) {
          console.warn("[job-sync] Match calculation failed for job:", job.title, e.message);
          score = 50; // Assign a default mid score on match error
        }
      }

      // Requirement: Only save jobs with score >= 60
      if (score >= 60) {
        matchedJobs.push({
          ...job,
          match_score: score,
          match_explanation: explanation
        });
      }
    }

    // Deduplicate matching jobs locally by company + title before upload
    const uniqueMatches = [];
    const seenKeys = new Set();
    
    matchedJobs.forEach(job => {
      const key = `${(job.company || "").toLowerCase()}|${(job.title || "").toLowerCase()}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueMatches.push(job);
      }
    });

    // Sort highest score first
    uniqueMatches.sort((a, b) => b.match_score - a.match_score);

    const jobsMatched = uniqueMatches.length;
    let jobsSynced = 0;
    const results = [];

    if (onProgress) onProgress(`Syncing ${jobsMatched} jobs...`, 60);

    // Batch uploads to avoid hitting limits
    const BATCH_SIZE = 5;
    for (let i = 0; i < uniqueMatches.length; i += BATCH_SIZE) {
      const batch = uniqueMatches.slice(i, i + BATCH_SIZE);
      const uploadPromises = batch.map(async (job) => {
        try {
          // Pass ALL scraped job fields to the API for a complete insert
          const payload = {
            user_id: session.user.id,
            title: job.title,
            company: job.company,
            company_logo: job.company_logo || null,
            location: job.location || "",
            description: job.description || "",
            salary: job.salary || null,
            employment_type: job.employment_type || null,
            experience_required: job.experience_required || null,
            skills_required: Array.isArray(job.skills_required) ? job.skills_required : [],
            job_url: job.source_url || "",
            source: job.source_portal || portal || "unknown",
            source_portal: job.source_portal || portal || "unknown",
            match_score: job.match_score,
            match_explanation: job.match_explanation || null,
            posted_date: job.posted_date || null,
          };
          
          const uploadRes = await api.uploadDiscoveredJob(session, payload);
          if (uploadRes.success && !uploadRes.is_duplicate) {
            jobsSynced++;
            results.push({ title: job.title, company: job.company, score: job.match_score });
          }
        } catch (err) {
          console.error("[job-sync] Failed to upload job:", job.title, err.message);
        }
      });

      await Promise.all(uploadPromises);
      
      const pct = 60 + Math.round(((i + BATCH_SIZE) / uniqueMatches.length) * 35);
      if (onProgress) onProgress(`Uploaded ${jobsSynced}/${jobsMatched} jobs...`, Math.min(pct, 95));
    }

    if (onProgress) onProgress("Recording scan history...", 95);

    // Record scan history in Supabase
    try {
      await api.recordScanHistory(session, portal, jobsFound, jobsMatched, jobsSynced);
    } catch (e) {
      console.warn("[job-sync] Failed to record scan history:", e.message);
    }

    if (onProgress) onProgress("Success!", 100);

    return {
      jobs_found: jobsFound,
      jobs_matched: jobsMatched,
      jobs_synced: jobsSynced,
      results
    };
  }
};

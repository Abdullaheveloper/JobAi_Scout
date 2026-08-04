# i18n route coverage

Generated: 2026-08-03T05:57:54.549Z

Source router: `src/App.tsx`
Audit input: `scripts/i18n-untranslated-report.txt` (attr-aware scan)

| Route | Audited | Components scanned | Attr findings | Notes |
| --- | --- | --- | ---: | --- |
| `/` | yes | `src/pages/Index.tsx` | 0 | scanned; no open attr findings |
| `/login` | yes | `src/pages/Login.tsx` | 0 | scanned; no open attr findings |
| `/register` | yes | `src/pages/Register.tsx` | 0 | scanned; no open attr findings |
| `/waiting-approval` | yes | `src/pages/WaitingApproval.tsx` | 0 | scanned; no open attr findings |
| `/forgot-password` | yes | `src/pages/ForgotPassword.tsx` | 0 | scanned; no open attr findings |
| `/reset-password` | yes | `src/pages/ResetPassword.tsx` | 0 | scanned; no open attr findings |
| `/about` | yes | `src/pages/About.tsx` | 1 | 1 hardcoded attr(s) still open |
| `/contact` | yes | `src/pages/Contact.tsx` | 1 | 1 hardcoded attr(s) still open |
| `/privacy` | yes | `src/pages/Privacy.tsx` | 1 | 1 hardcoded attr(s) still open |
| `/dashboard` | yes | `src/pages/Dashboard.tsx` | 0 | scanned; no open attr findings |
| `/dashboard/cv` | yes | `src/pages/CVUpload.tsx` | 1 | 1 hardcoded attr(s) still open |
| `/dashboard/jobs` | yes | `src/pages/JobBoard.tsx` | 0 | scanned; no open attr findings |
| `/dashboard/automation` | yes | `src/pages/Automation.tsx` | 0 | scanned; no open attr findings |
| `/dashboard/saved` | yes | `src/pages/SavedJobs.tsx` | 0 | scanned; no open attr findings |
| `/dashboard/applications` | yes | `src/pages/Applications.tsx` | 0 | scanned; no open attr findings |
| `/dashboard/auto-fill` | yes | `src/pages/AutoFormFill.tsx` | 1 | 1 hardcoded attr(s) still open |
| `/dashboard/assistant` | yes | `src/pages/VoiceAssistant.tsx` | 1 | 1 hardcoded attr(s) still open |
| `/dashboard/voice-agent` | yes | `src/pages/VoiceAgent.tsx` | 1 | 1 hardcoded attr(s) still open |
| `/dashboard/settings` | yes | `src/pages/ProfileSettings.tsx` | 1 | 1 hardcoded attr(s) still open |
| `/dashboard/extension` | n/a | — | 0 | Redirect → /dashboard/auto-fill |
| `/recruiter` | n/a | — | 0 | Redirect → /recruiter/jobs |
| `/recruiter/profile` | yes | `src/pages/recruiter/RecruiterProfile.tsx`, `src/pages/recruiter/RecruiterApplicationStatus.tsx`, `src/pages/recruiter/RecruiterCandidates.tsx` | 0 | 1 other literal(s) flagged |
| `/recruiter/jobs` | yes | `src/pages/recruiter/RecruiterJobs.tsx`, `src/pages/recruiter/RecruiterApplicationStatus.tsx`, `src/pages/recruiter/RecruiterCandidates.tsx` | 0 | 1 other literal(s) flagged |
| `/recruiter/candidates` | yes | `src/pages/recruiter/RecruiterCandidates.tsx`, `src/pages/recruiter/RecruiterApplicationStatus.tsx`, `src/pages/recruiter/RecruiterJobs.tsx` | 0 | 1 other literal(s) flagged |
| `/recruiter/application-status` | yes | `src/pages/recruiter/RecruiterApplicationStatus.tsx`, `src/pages/recruiter/RecruiterCandidates.tsx`, `src/pages/recruiter/RecruiterJobs.tsx` | 0 | 1 other literal(s) flagged |
| `/admin` | yes | `src/pages/AdminDashboard.tsx` | 0 | scanned; no open attr findings |
| `/admin/users` | yes | `src/pages/AdminUsers.tsx` | 0 | scanned; no open attr findings |
| `/admin/jobs` | yes | `src/pages/AdminJobs.tsx` | 0 | scanned; no open attr findings |
| `/admin/analytics` | yes | `src/pages/AdminAnalytics.tsx` | 0 | scanned; no open attr findings |
| `/admin/usage-limits` | yes | `src/pages/AdminUsageLimits.tsx` | 0 | scanned; no open attr findings |
| `/admin/voice` | yes | `src/pages/AdminVoice.tsx` | 1 | 1 hardcoded attr(s) still open |
| `*` | yes | `src/pages/NotFound.tsx` | 0 | scanned; no open attr findings |

## Summary

- Routes total: **32**
- Page routes audited: **30**
- Routes still with hardcoded attr findings: **9**

Re-run: `node scripts/i18n-route-coverage.mjs`

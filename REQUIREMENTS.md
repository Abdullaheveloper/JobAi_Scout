# JobAI Scout — Functional Requirements

Requirements below describe **implemented** behavior only. Items marked **in-progress** are partially built, orphaned from navigation, or backed by server code without a current UI caller. Ambiguities are noted where the code does not settle behavior.

---

## 1. Authentication and account approval

1. Visitors can register with email, password (minimum 8 characters), and full name.
2. Registration offers exactly two account types: job seeker (`user`) and recruiter; admin cannot be self-selected at signup.
3. Recruiter registration requires a company name.
4. After signup with an active session, the user is sent to the waiting-approval screen with pending status.
5. After signup without a session (e.g. email confirmation path), the user is sent to login with an email-confirmation pending indicator.
6. Users can sign in with email and password.
7. After successful login, destination depends on role: admin → admin home; recruiter → recruiter jobs; job seeker → dashboard.
8. Non-admin users whose approval status is not `approved` cannot access protected app routes and are redirected to waiting-approval.
9. Admins are treated as approved for access gating regardless of profile approval fields.
10. Waiting-approval shows distinct messaging for pending, rejected, and expired states and allows sign-out.
11. Users with rejected or expired approval can renew an approval request on login (`renew_approval_request`) and are returned to waiting-approval.
12. Approved users may see a one-time approval notice that is cleared (`clear_approval_notice`).
13. Users can request a password-reset email and set a new password via the recovery flow; after reset they are signed out.
14. **Ambiguity:** Whether email confirmation is required depends on Supabase Auth project settings; the UI handles both “session immediately” and “no session” signup outcomes. Local `config.toml` has email confirmations disabled, but hosted settings may differ.

---

## 2. Authorization and portals

1. Protected routes require an authenticated user.
2. Routes declare a required role (`user`, `recruiter`, or `admin`); mismatched roles are redirected to that role’s home area.
3. Job seeker portal routes live under `/dashboard/*`.
4. Recruiter portal routes live under `/recruiter/*`.
5. Admin portal routes live under `/admin/*`.
6. Sidebar navigation differs by role (seeker / recruiter / admin item sets).

---

## 3. Job seeker — dashboard

1. Dashboard shows the user’s name (when present), skills, and desired roles from the profile.
2. Dashboard provides quick links to CV, jobs, automation, saved jobs, voice assistant, and form fill.
3. **in-progress:** “Profile score” and “AI matches” metric values are hardcoded (85%/24 when a profile has skills; otherwise 20%/0), not computed from live data.

---

## 4. Job seeker — CV upload and analysis

1. User can upload a PDF or DOCX CV up to 10MB.
2. Upload stores the file and invokes CV analysis.
3. UI shows extraction metadata when returned (method, pages, OCR indicators) and extracted field summary.
4. Profile readiness percentage is derived from a fixed set of profile fields.
5. ATS / resume suggestions can be shown and retried (including force/ATS-only modes when supported by the analysis response).
6. User can navigate from CV flow to profile settings to edit results.
7. **Ambiguity:** Whether analysis auto-applies to the profile depends on server merge / replacement / approval rules; UI may report analysis success without a fully applied profile update.

---

## 5. Job seeker — profile and career passport

1. User can edit personal fields (name, phone, location, bio, education, salary, social links, skills, desired roles, work preferences).
2. User can upload an avatar to profile asset storage.
3. User can maintain structured `career_profile` content: experience, education entries, projects, achievements, references.
4. User can maintain autofill preferences (work authorization, relocate, commute, work type, availability, confidence thresholds, review-sensitive toggle).
5. User can store free-form application Q&A lines in profile `application_answers` (question = answer format validation in UI).
6. Saving may report partial success if some extended columns fail (migration mismatch path).
7. Field provenance can be updated via `update_profile_data_sources` when fields change.
8. Language switcher and theme toggle are available on settings (and portal chrome).

---

## 6. Job seeker — job board and discovery

1. User must enter a keyword to scrape/collect jobs; location and filters (job type, remote/hybrid, include remote / PK-wide) are supported.
2. User can start and stop a scrape session; UI shows adapter status and session progress.
3. Collected session results are paginated via `search_scrape_session_jobs`.
4. Recommended jobs with match score ≥ 40 are listed with save, open apply URL, and match explanation when available.
5. Saving bookmarks writes to `saved_jobs`.
6. For jobs with a recruiter owner, Apply can insert a `job_applications` row; otherwise Apply opens the external URL.
7. User can generate, regenerate, and copy a cover letter for a selected job; generation does not submit an application.
8. “Visited” job tracking is client-only (`localStorage`), not server-persisted.
9. **in-progress:** External Apply does not create platform application records or call `track-applied-job`.
10. **in-progress:** Edge functions `scrape-jobs`, `sync-jobs`, `send-application`, `track-applied-job`, and `track-extension-usage` exist but have no current callers from the web app or extension.

---

## 7. Job seeker — saved jobs

1. User can list saved jobs, distinguishing extension-scan recommendations vs job-board saves when those foreign keys are present.
2. User can unsave and open external apply URLs.
3. Saved list does not create application tracking records.

---

## 8. Job seeker — applications

1. User can list their `job_applications` with status badge, salary display, cover letter preview, and job URL.
2. List is read-only (no withdraw, status edit, or filters in UI).
3. **in-progress:** Route `/dashboard/applications` is registered but omitted from seeker sidebar and dashboard quick actions.
4. **in-progress:** Applications only reflect platform inserts (e.g. recruiter-posted Apply); external/extension applications are not shown here. Separate `applied_jobs` table is not read by this page.
5. **in-progress:** `src/pages/Analytics.tsx` implements seeker analytics UI using applications/applied jobs but is not routed in `App.tsx`.

---

## 9. Job seeker — automation (scheduled scrapes)

1. User can create, update, activate/deactivate, and delete scrape schedules.
2. Supported UI recurrence modes: once, daily, weekly, specific days, monthly (mapped to DB recurrence types).
3. Schedule runs use profile-derived query (desired role / location); the schedule form does not store a free-text query.
4. UI warns when desired role or location needed for scheduling is missing.
5. Due schedules are claimed and executed by a cron-backed `run-scheduled-scrapes` path using the same scrape orchestration as manual collect.

---

## 10. Job seeker — form fill / extension

1. Auto Form Fill page provides download of the packaged extension zip and install instructions.
2. `/dashboard/extension` redirects to `/dashboard/auto-fill`.
3. Extension (MV3 “Job Form Fill”) allows sign-in, profile load, resume/avatar handling in popup, and form fill on permitted ATS/job hosts.
4. Extension fills using profile facts and autofill preferences; sensitive fields can be left for review per decision engine rules.
5. **in-progress:** Extension does not invoke `track-applied-job` or `track-extension-usage` in current code.
6. **Ambiguity:** Both `extension/` and `autofill-extension/` trees exist in the repo; the in-app download points at `public/job-form-fill.zip`—which source built that zip is not asserted by the page itself.

---

## 11. Job seeker — voice

1. Voice Assistant (`/dashboard/assistant`, in nav) supports microphone permission handling, listening, transcription (browser speech and/or server STT), AI answer via `voice-chat`, TTS playback, history, pause/end, and optional knowledge-document upload (`kb-ingest-document`).
2. Conversations/messages persist in voice tables and related storage.
3. Voice Agent (`/dashboard/voice-agent`) starts an ElevenLabs conversational session using a conversation token; requires `VITE_ELEVENLABS_AGENT_ID`.
4. **in-progress:** Voice Agent is not linked in the sidebar.
5. **in-progress:** `VoiceWidget`, chat container path, and `career-chat` edge function are not mounted/called from routed UI.
6. **in-progress:** Admin voice control room exists at `/admin/voice` but is not in admin nav.

---

## 12. Recruiter

1. Recruiter can upsert company profile fields on `recruiter_profiles`.
2. Recruiter can CRUD own jobs with `source: "recruiter"` and standard listing fields including `job_url`.
3. `?new=1` on jobs route opens create flow.
4. Recruiter can list applications to owned jobs and set status to `new` | `shortlisted` | `rejected` | `hired`.
5. Recruiter can add private candidate notes (`candidate_notes`, `is_private: true`).
6. Recruiter can view limited candidate profile fields for applicants.
7. Application Status page shows read-only counts and rows for owned-job applications (no status edits, no candidate names in that list).
8. Recruiters are subject to the same approval gate as job seekers.
9. **Ambiguity / gap:** No recruiter UI to toggle `jobs.is_active` (status may display but not be edited).
10. **Ambiguity:** `application_questions` / `application_answers` tables exist in schema; recruiter UI does not expose question CRUD in the pages reviewed—profile-level `application_answers` JSON is seeker-side only.

---

## 13. Admin

1. Admin dashboard shows counts for users, pending approvals, jobs, applications, and extension usage aggregates (from recent `extension_usage` rows).
2. Admin can filter users by approval status (including URL `?filter=pending`).
3. Admin can approve or reject pending accounts via `admin_set_account_approval`.
4. Admin can promote/demote between `admin` and `user` via `manage-role` (not recruiter).
5. Admin can edit selected profile fields and permanently delete users via `delete-user` with confirmation; cannot perform destructive role/approval actions on self; last-admin protection is enforced server-side.
6. Admin can CRUD `job_sources` of types `rss` and `company_career`, and paginate/delete `jobs`.
7. Admin analytics loads `get_platform_analytics` for selectable day ranges and charts KPIs.
8. Admin voice page can load/save voice settings, inspect KB sources and search logs, test hybrid KB search, and clear search logs.
9. Pending approvals expire after the configured window (48 hours in migration/cron design); `expire-pending-approvals` edge wraps the RPC.
10. **in-progress:** Admin Voice omitted from sidebar; Document Ingestion tab is read-only (no ingest UI on that page).
11. **in-progress:** Admin Voice stats generation injects placeholder sample data when empty; test search uses a dummy zero embedding vector.
12. **Gap:** Promoting a recruiter to admin (or demoting admin to user) can drop recruiter role permanently; `manage-role` does not support `recruiter`.

---

## 14. Internationalization

1. Supported UI locales: English, French, German, Hindi.
2. Locale preference persists in `localStorage` and, when logged in, on `profiles.preferred_locale`.
3. Language switcher is available in portal chrome and auth/settings surfaces that mount it.
4. **in-progress:** Some screens retain hardcoded English (e.g. Voice Agent, parts of admin, Reset Password).
5. **Ambiguity:** Migration comment historically said Phase 1 English-only; runtime supports four locales.

---

## 15. Theme

1. Supported themes: light and dark only.
2. Resolution order: profile `preferred_theme` → localStorage → OS preference → default dark.
3. Theme toggle updates document classes and persists preference for signed-in users when profile update succeeds.
4. **in-progress:** Sonner toaster still references `next-themes` while the app uses a custom ThemeProvider (potential theme desync for toasts).

---

## 16. Cookie consent and analytics

1. Banner appears until user accepts or rejects cookies; choice stored in localStorage.
2. Analytics bootstrap is gated on consent.
3. **in-progress:** Analytics module is a placeholder (no real analytics SDK wired).

---

## 17. Public marketing pages

1. Landing page presents product pitch, CTAs to register/login, and links to about/contact/privacy.
2. Signed-in landing metrics can use live profile strength, top recommended jobs, and application count; guests see static fallback numbers.
3. About page content and statistics are static marketing copy.
4. Contact form simulates success after a client delay; **does not** persist or email the message (**in-progress** / non-functional backend).
5. Privacy page displays policy sections and a privacy contact address.

---

## 18. Cross-cutting non-functional (observed)

1. App shell uses lazy-loaded routes with a loading spinner.
2. i18n completeness/parity and theme hardcode audits exist as npm scripts/CI checks (see Architecture).
3. Vitest unit tests cover selected domains (CV sync, job scrape UI/plan, etc.).

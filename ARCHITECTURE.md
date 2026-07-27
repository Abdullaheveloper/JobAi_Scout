# JobAI Scout — Architecture

Technical documentation derived from the repository as of the analysis date. Describes what exists in code; incomplete areas are called out explicitly.

---

## 1. Stack

| Layer | Technology |
|-------|------------|
| UI | React 18, TypeScript, Vite 5 (`@vitejs/plugin-react-swc`) |
| Routing | `react-router-dom` v6, lazy route chunks in `src/App.tsx` |
| Data fetching / cache | TanStack Query (provider present); much data still fetched with direct Supabase client calls |
| UI kit | Tailwind CSS 3, Radix/shadcn-style components under `src/components/ui`, Framer Motion, Recharts |
| Forms / validation | react-hook-form, Zod (where used) |
| Auth & backend | Supabase Auth, Postgres, Storage, Edge Functions (Deno), RLS |
| AI | Gemini / OpenRouter via edge `_shared` helpers; ElevenLabs TTS + Conversational AI |
| i18n | i18next, react-i18next, `i18next-browser-languagedetector` |
| Theme | Custom `ThemeProvider` (`src/theme/*`); `next-themes` still imported by Sonner only |
| Tests | Vitest + Testing Library |
| Deploy | Vercel SPA (`vercel.json`: Vite build → `dist`, SPA rewrite to `index.html`) |
| Extension | Chrome MV3 under `extension/` (packaged zip served from `public/`); alternate source tree `autofill-extension/` also present |
| Optional CV service | Python FastAPI under `services/cv-extractor` when `CV_EXTRACTOR_URL` is set |

**Dev scripts (root `package.json`):** `dev` syncs env to Supabase + extension config then runs Vite (port **5181** per Vite config); `build`, `lint`, i18n/theme audit scripts, `extension:test`, `cv-extractor`.

---

## 2. High-level system design

```
┌─────────────────────────────────────────────────────────────┐
│  Browser: Vite SPA (job seeker / recruiter / admin portals) │
│  + CookieConsent + LocaleProvider + ThemeProvider + Auth     │
└─────────────┬───────────────────────────────┬───────────────┘
              │ Supabase JS (Auth/DB/Storage) │ HTTPS invoke/fetch
              ▼                               ▼
┌──────────────────────────┐    ┌─────────────────────────────┐
│  Supabase Postgres + RLS │    │  Edge Functions (Deno)      │
│  Storage buckets         │◄───│  analyze-cv, collect-jobs,  │
│  pg_cron → RPCs/HTTP     │    │  voice-*, manage-role, …    │
└──────────────────────────┘    └─────────────┬───────────────┘
                                              │
                    ┌─────────────────────────┼──────────────────┐
                    ▼                         ▼                  ▼
              Gemini/OpenRouter          ElevenLabs      Optional CV extractor
              (LLM, embeddings, STT)     (TTS, Agent)    (Python /extract)

┌──────────────────────────────────────┐
│  Chrome extension (Job Form Fill)    │──► extension-profile + Supabase Auth
└──────────────────────────────────────┘
```

---

## 3. Repository map (real paths)

```
E:/JobAi_Scout/
├── src/
│   ├── App.tsx                 # Routes + providers
│   ├── main.tsx
│   ├── pages/                  # Route screens (incl. recruiter/, Admin*, Voice*)
│   ├── components/             # Layout, automation, voice, profile, chat, ui, brand
│   ├── contexts/AuthContext.tsx
│   ├── hooks/
│   ├── i18n/                   # LocaleProvider, languages.ts, index.ts
│   ├── locales/                # en.json, fr.json, de.json, hi.json
│   ├── theme/                  # ThemeProvider, theme.ts
│   ├── integrations/supabase/  # client.ts, types.ts
│   ├── lib/                    # job-scrape*, career-profile, voice/, analytics placeholder
│   └── test/
├── extension/                  # MV3 Job Form Fill (manifest, content, popup, tests)
├── autofill-extension/         # Alternate/parallel extension source tree
├── public/                     # Static assets, job-form-fill.zip
├── services/cv-extractor/      # Optional Python extraction service
├── supabase/
│   ├── config.toml             # project_id, auth, per-function verify_jwt
│   ├── migrations/             # Schema evolution
│   └── functions/              # Edge functions + _shared/
├── scripts/                    # i18n/theme audits, extension config sync, HTTPS setup
├── vercel.json
└── package.json
```

---

## 4. Routing and role gates

Defined in `src/App.tsx`. Wrap with `ProtectedRoute` + `requiredRole`.

| Path | Role | Page |
|------|------|------|
| `/` | public | `Index` |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/waiting-approval` | public | auth flows |
| `/about`, `/contact`, `/privacy` | public | static/marketing |
| `/dashboard` … `/dashboard/settings` | `user` | seeker portal |
| `/dashboard/extension` | `user` | redirect → `/dashboard/auto-fill` |
| `/recruiter/*` | `recruiter` | recruiter portal (`/recruiter` → jobs) |
| `/admin/*` | `admin` | admin portal |
| `*` | — | `NotFound` |

**`ProtectedRoute` (`src/components/ProtectedRoute.tsx`):**

1. Wait for auth loading.
2. No user → `/login`.
3. Non-admin and not approved → `/waiting-approval`.
4. Role mismatch → role home (`/admin`, `/recruiter/jobs`, or `/dashboard`).

**Roles:** `UserRole = "admin" | "user" | "recruiter"` from `user_roles.role` (`app_role` enum).

**Nav inconsistency:** Seeker nav omits Applications; omits Voice Agent. Admin nav omits `/admin/voice`.

---

## 5. Auth and approval data flow

```
signUp(metadata: full_name, role[, company_name])
    → Auth user
    → DB trigger handle_new_user
         • profiles row: approval_status = pending
         • user_roles: user | recruiter (admin metadata forced to user)
         • recruiter_profiles row if recruiter
    → UI: /waiting-approval or login (email confirm pending)

signInWithPassword
    → AuthContext loads profiles + user_roles (+ recruiter_profiles if recruiter)
    → If rejected/expired: renew_approval_request → waiting
    → Else destinationForRole

ProtectedRoute / Admin approve
    → admin_set_account_approval RPC
    → Optional expire_pending_approvals (48h) via cron + expire-pending-approvals function
```

**Key files:** `src/contexts/AuthContext.tsx`, `src/pages/Login.tsx`, `Register.tsx`, `WaitingApproval.tsx`, migration `20260727000100_account_approval.sql`, functions `manage-role`, `delete-user`, `expire-pending-approvals`.

**Admin delete:** `delete-user` cleans storage buckets (`resumes`, `profile-assets`, `voice-history`, `voice_audio`), related rows, recruiter jobs, writes `admin_audit_log`, then `auth.admin.deleteUser`.

---

## 6. Feature data flows

### 6.1 CV upload / parsing

```
CVUpload / ProfileSettings
  → Storage: resumes/{userId}/{timestamp}_{name}
  → functions.invoke("analyze-cv")
       → Prefer CV_EXTRACTOR_URL POST /extract (services/cv-extractor)
       → Else local unpdf/mammoth + Gemini OCR (_shared/cv-extraction.ts)
       → Gemini JSON extraction
       → Profile merge / replacement queue RPCs / ATS (resume_ats_analyses)
  → UI: ExtractedDataCard, ResumeSuggestion* components
```

### 6.2 Job scrape / automation

```
JobBoard "Scrape Jobs"
  → collect-jobs → _shared/scrape-orchestrator
       → adapters (LinkedIn, Indeed, RSS, company careers via job_sources)
       → job_scrape_sessions, job_scrape_results, jobs, matching → recommended_jobs
  → RPC search_scrape_session_jobs for pagination

Automation schedules
  → CRUD job_scrape_schedules (client casts as never; missing from types.ts)
  → pg_cron → run-scheduled-scrapes (x-cron-secret)
       → claim_due_job_scrape_schedules → same orchestrator (query from profile)

Cover letter
  → generate-cover-letter (profiles + jobs) → copy in UI only
```

**Legacy / unused by current UI:** `scrape-jobs`, `sync-jobs`, `send-application`, `track-applied-job`, `track-extension-usage`.

### 6.3 Auth / route protection

See §4–§5. Client gate only supplements RLS; privileged mutations use RPCs/edge with admin checks.

### 6.4 Form fill (extension)

```
AutoFormFill page → download /job-form-fill.zip (install docs only)

Extension popup → Supabase Auth (email/password or Google identity)
  → background: GET_APPLICATION_PROFILE / GET_PROFILE_FILE
  → edge extension-profile (verify_jwt = true)
  → content scripts on ATS hosts → decision-engine fill / review / skip
```

Hosts (from `extension/manifest.json`): Greenhouse, Lever, Workday, Ashby, SmartRecruiters, Jobvite, iCIMS, Workable, LinkedIn, Indeed, Google Forms + project Supabase host.

### 6.5 Voice assistant vs voice agent

**Assistant** (`VoiceAssistant` → `VoiceMode`):

```
Mic / MediaRecorder (+ optional Web Speech)
  → voice-transcribe (Gemini) if needed
  → voice-chat (RAG + Gemini personalities/KB)
  → elevenlabs-tts (fallback speechSynthesis)
  → persist voice_conversations / voice_messages + voice-history storage
  → optional kb-ingest-document
```

**Agent** (`VoiceAgent`): `@elevenlabs/react` session via `elevenlabs-conversation-token`; needs `VITE_ELEVENLABS_AGENT_ID`. Server helpers `voice-agent-llm` / `voice-agent-guard` are for ElevenLabs-side tooling, not called from React directly.

**Unused parallels:** `career-chat`, `voice-tts` (Gemini TTS), `VoiceWidget`, `ChatContainer`/`useChat` not routed.

### 6.6 i18n

- Locales: `en` | `fr` | `de` | `hi` (`src/i18n/languages.ts`, JSON under `src/locales/`).
- Bootstrap: `localStorage` key `jobai_preferred_locale`.
- `LocaleProvider`: profile `preferred_locale` wins when logged in; switcher writes localStorage + profile update.
- Migration: `20260727000600_preferred_locale.sql`.
- Tooling: `i18next-parser.config.mjs`, `scripts/verify-i18n-completeness.mjs`, `verify-locale-parity.mjs`, `audit-untranslated.mjs`, `.github/workflows/i18n-checks.yml`.

### 6.7 Theme

- Modes: `light` | `dark` (`src/theme/theme.ts`); default **dark**.
- Order: profile `preferred_theme` → `jobai_theme` localStorage → `prefers-color-scheme` → dark.
- Applies `dark`/`light` classes on `<html>`.
- Migration: `20260727000700_preferred_theme.sql`.
- Inconsistency: `src/components/ui/sonner.tsx` uses `next-themes` without an app-level NextThemesProvider.

---

## 7. Database schema (evidence)

### 7.1 Tables in generated `src/integrations/supabase/types.ts`

| Table | Role |
|-------|------|
| `profiles` | Seeker/user profile, approval, locale/theme, skills, prefs |
| `user_roles` | `app_role` assignment |
| `recruiter_profiles` | Company profile |
| `jobs` | Listings (scraped + recruiter) |
| `job_applications` | Applications to platform jobs |
| `application_questions` / `application_answers` | Per-job Q&A (schema present; limited UI use) |
| `saved_jobs` | Bookmarks |
| `recommended_jobs` | Per-user matched listings |
| `job_scrape_sessions` / `job_scrape_results` | Scrape runs |
| `job_preferences` | Search prefs table |
| `applied_jobs` | External URL application tracking (little/no current client use) |
| `extension_usage` | Extension telemetry |
| `scan_history` | Portal scan counters |
| `candidate_notes` | Recruiter notes |
| `resume_ats_analyses` | ATS scores/suggestions |
| `kb_sources` / `kb_chunks` | Voice RAG |
| `voice_conversations` / `voice_messages` / `voice_analytics` / `voice_search_logs` / `voice_settings` | Voice |
| `messages` | User messaging (job-linked); no primary portal UI found |
| `security_alerts` | Security alert records |
| `admin_audit_log` | Admin delete/actions audit |

**Enum:** `app_role`: `admin` | `user` | `recruiter`.

### 7.2 Present in migrations/runtime but missing or incomplete in `types.ts`

| Object | Evidence |
|--------|----------|
| `job_sources` | Migration `20260716000100_*`; used in `AdminJobs` via `(supabase as any)` |
| `job_scrape_schedules` | Migration `20260721000400_*`; `src/lib/job-scrape-schedule.ts` documents types gap |
| `job_searches` | Referenced in scrape pipeline migrations |
| `voice_cache` | Voice agent LLM path / migrations |
| `profiles.career_profile`, `autofill_preferences`, `commute_to_office` | Migrations `20260719000100_*`, `20260719000200_*`; UI uses `(profile as any)` |
| `voice_messages.audio_url` / `audio_path` | Migration + VoiceMode types; may lag generated Row type |
| KB `document_type` / `metadata` | Migrations vs types lag |

**Conclusion:** `types.ts` is **stale** relative to later migrations; many call sites use `as any` / `as never`.

### 7.3 Notable RPCs (typed and/or used)

`admin_set_account_approval`, `clear_approval_notice`, `expire_pending_approvals`, `renew_approval_request`, `has_role`, `get_platform_analytics`, `search_scrape_session_jobs`, `hybrid_search_kb` / `match_kb_chunks`, `update_profile_data_sources`, CV replacement approval RPCs, `claim_due_job_scrape_schedules` (schedules migration).

### 7.4 Storage buckets (from delete-user / feature code)

`resumes`, `profile-assets`, `voice-history`, `voice_audio` (naming as in delete-user cleanup).

---

## 8. Edge functions (`supabase/functions/`)

| Function | Purpose | JWT verify (`config.toml`) | Called from SPA/extension today? |
|----------|---------|----------------------------|----------------------------------|
| `analyze-cv` | CV extract + AI profile/ATS | true | Yes |
| `collect-jobs` | Manual scrape orchestration | false | Yes |
| `run-scheduled-scrapes` | Cron dispatcher | false | Cron |
| `generate-cover-letter` | Cover letter | false | Yes |
| `extension-profile` | Profile payload for extension | true | Extension |
| `manage-role` | Admin role upsert | false | AdminUsers |
| `delete-user` | Admin hard delete | false | AdminUsers |
| `expire-pending-approvals` | Cron RPC wrapper | false | Cron |
| `voice-transcribe` | STT | (see config remainder) | VoiceMode |
| `voice-chat` | Voice RAG chat | | VoiceMode |
| `elevenlabs-tts` | TTS | false | VoiceMode |
| `elevenlabs-conversation-token` | Agent token | false | VoiceAgent |
| `voice-settings` | Admin voice config | | AdminVoice |
| `kb-ingest-document` | KB upload | false | VoiceMode |
| `kb-ingest-pdf` / `kb-reindex` | KB pipeline | false | Admin/ops oriented |
| `voice-agent-llm` / `voice-agent-guard` | Agent tooling | false | ElevenLabs-side (not React) |
| `scrape-jobs` | Legacy scrape | false | **No current callers** |
| `sync-jobs` | Scan → recommended | false | **No callers** |
| `send-application` | Application package insert | false | **No callers** |
| `track-applied-job` | Upsert applied_jobs | false | **No callers** |
| `track-extension-usage` | Usage insert | false | **No callers** |
| `career-chat` | Text career chat | false | **No callers** |
| `voice-tts` | Alternate TTS | | Unused by Assistant (uses elevenlabs-tts) |
| `security-alert` | Alerts | false | Ops |
| `api` | Aggregate/misc API | false | Check before assuming |

Shared logic lives under `supabase/functions/_shared/` (e.g. scrape orchestrator, CV extraction).

**Supabase project id** in `supabase/config.toml`: `uhvjleclbpseveyeajap`.

---

## 9. Config and deployment

| Item | Location / notes |
|------|------------------|
| Env | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ELEVENLABS_AGENT_ID`, edge secrets (Gemini/OpenRouter/ElevenLabs/cron) |
| Vite | Port 5181; optional local HTTPS PFX scripts |
| `sync-env-to-supabase.js` | Runs on `npm run dev` |
| `scripts/sync-extension-config.mjs` | Writes extension local config |
| Vercel | `vercel.json` SPA; live URL referenced historically as `https://job-ai-scout.vercel.app` |
| CI | `.github/workflows/i18n-checks.yml` |
| Auth email confirmations | `config.toml` local: `enable_confirmations = false`; hosted may differ |

Many edge functions set `verify_jwt = false` and implement their own auth/secret checks—treat as a security review surface.

---

## 10. Incomplete / inconsistent areas (honest)

1. **Generated types lag migrations** (`job_sources`, `job_scrape_schedules`, career/autofill profile columns, voice audio fields, etc.).
2. **Orphan routes / pages:** `/dashboard/applications` (no nav), `/dashboard/voice-agent` (no nav), `/admin/voice` (no nav), `Analytics.tsx` (no route).
3. **Dashboard metrics** hardcoded profile score / AI match counts.
4. **Contact form** client-only fake submit.
5. **Application tracking gap:** external Apply and extension do not populate `job_applications` / `applied_jobs` via current clients; track edge functions unused.
6. **Legacy edge functions** still in repo without UI callers (`scrape-jobs`, `sync-jobs`, `send-application`, track-*, `career-chat`).
7. **Dual extension trees** (`extension/` vs `autofill-extension/`) plus zip artifact—packaging source of truth unclear from page alone.
8. **Admin Voice** placeholder stats and dummy embedding for test search; ingestion UI incomplete.
9. **Role management** cannot assign/restore `recruiter` via `manage-role`.
10. **Theme:** custom provider vs Sonner `next-themes`.
11. **i18n uneven** across Voice Agent / some admin / reset password.
12. **Cookie analytics** consent gates a no-op analytics module.
13. **`WaitingApproval`** contains a no-op `useEffect` stub.
14. **Tables with little/no UI:** `messages`, `job_preferences`, `application_questions` (as recruiter feature), `security_alerts`.

---

## 11. Relationship sketch (core)

```
auth.users
   ├── profiles (1:1 by user_id) ── approval_*, preferred_locale/theme, career_profile JSON, …
   ├── user_roles (role)
   ├── recruiter_profiles (if recruiter)
   ├── jobs (recruiter_id nullable; scraped rows too)
   │     └── job_applications ←→ profiles (applicants)
   │           └── candidate_notes (recruiter)
   ├── saved_jobs → jobs | recommended_jobs
   ├── recommended_jobs (user-scoped matches)
   ├── job_scrape_sessions → job_scrape_results
   ├── job_scrape_schedules (user)
   ├── job_sources (admin-managed feeds)
   ├── resume_ats_analyses
   ├── voice_conversations → voice_messages
   └── kb_sources → kb_chunks (embeddings)
```

This document should be regenerated when migrations or edge entrypoints change materially; prefer regenerating `types.ts` from Supabase before treating it as the schema source of truth.

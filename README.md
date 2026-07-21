<p align="center">
  <img src="public/jobai-scout-mark.png" alt="JobAI Scout logo" width="112" />
</p>

<h1 align="center">JobAI Scout</h1>

<p align="center">
  An AI career copilot for CV intelligence, job discovery, application tracking, voice guidance, recruiter operations, and evidence-led form filling.
</p>

<p align="center">
  <a href="https://job-ai-scout.vercel.app"><strong>Open the live application</strong></a>
  ·
  <a href="#local-development">Local setup</a>
  ·
  <a href="#browser-extension">Browser extension</a>
  ·
  <a href="#project-documentation">Documentation</a>
</p>

---

## Product overview

JobAI Scout brings the main stages of a job search into one role-aware platform. Job seekers can build a detailed Career Passport, analyze a CV, discover suitable jobs, generate tailored cover letters, track applications, ask career questions by voice, and safely fill supported application fields through a browser extension.

Recruiters receive a dedicated hiring workspace for company profiles, job publishing, applicant review, pipeline status, and private notes. Administrators can monitor platform activity, manage users and job sources, inspect analytics, and operate the voice/RAG control room.

## Core capabilities

- **Career Passport** — structured identity, education, work history, skills, projects, certifications, links, preferences, resume, and profile photo.
- **CV analysis** — extracts career evidence from an uploaded CV and lets the user review the results.
- **Job discovery** — browses collected and recruiter-posted roles with search, saving, and matching workflows.
- **Tailored cover letters** — combines the selected job description with approved profile evidence.
- **Voice assistant** — microphone permission handling, live transcription, silence detection, AI responses, speech playback, history, and RAG grounding.
- **Form Fill extension** — signs in to JobAI Scout, loads verified profile facts, attaches supported documents, fills safe fields, and leaves legal or sensitive decisions to the applicant.
- **Recruiter workspace** — company profile, job creation, applicant pipeline, status management, and recruiter-private notes.
- **Admin workspace** — platform totals, extension activity, user/role management, job-source operations, analytics, and voice knowledge inspection.
- **Original brand system** — responsive JobAI Scout signal mark with SVG/CSS motion, reduced-motion support, favicon, social PNG, and extension icon sizes.

## User roles

| Role | Main access |
| --- | --- |
| Job seeker | Dashboard, Upload CV, Browse Jobs, Saved Jobs, Applications, Form Fill, Voice Assistant, Profile Settings |
| Recruiter | Company Profile, Post a Job, My Jobs, Applicants, Application Status |
| Administrator | Admin Dashboard, Manage Users, Manage Jobs, Platform Analytics, Voice Control Room |

Role-specific routes are protected in React and sensitive data access is enforced through Supabase Row Level Security and protected Edge Functions.

## Technology

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS, shadcn/ui, Radix UI, Lucide, Framer Motion |
| Backend | Supabase PostgreSQL, Auth, Storage, Edge Functions |
| AI orchestration | Gemini API (CV upload and ATS suggestions); OpenRouter for legacy optional flows |
| Speech-to-text | Whisper-compatible transcription through the configured provider |
| Text-to-speech | ElevenLabs and browser speech synthesis fallback |
| Retrieval | pgvector, hybrid knowledge search, chunk metadata, RAG thresholds |
| Charts | Recharts |
| Browser extension | Chrome Manifest V3, vanilla JavaScript, Shadow DOM review panels |
| Deployment | Vercel for the Vite SPA; Supabase for data and serverless functions |

## Local development

### Requirements

- Node.js 18 or newer
- npm 9 or newer
- Git
- A Supabase project
- Chrome or Edge for extension and microphone testing

### 1. Clone and install

```bash
git clone https://github.com/Abdullaheveloper/JobAi_Scout.git
cd JobAi_Scout
npm install
```

### 2. Configure local environment

Create `.env` in the repository root. Do not commit this file.

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_ANON_KEY
VITE_SUPABASE_PROJECT_ID=YOUR_PROJECT_REFERENCE

OPENROUTER_API_KEY=YOUR_OPENROUTER_KEY
GEMINI_API_KEY=YOUR_GEMINI_KEY
ELEVENLABS_API_KEY=YOUR_ELEVENLABS_KEY
VITE_ELEVENLABS_AGENT_ID=YOUR_OPTIONAL_AGENT_ID
```

Frontend variables beginning with `VITE_` are included in the browser bundle and must never contain service-role or private backend secrets. Provider keys belong in Supabase Edge Function secrets for production.

The CV upload parser and its ATS suggestions use `GEMINI_API_KEY` directly and do not require `OPENROUTER_API_KEY`.

### 3. Apply the database schema

Apply SQL files from `supabase/migrations/` in chronological order, or use the Supabase CLI against the intended project. The migrations define profiles, roles, jobs, applications, recruiter data, extension usage, voice history, knowledge sources, vector search, storage policies, and Row Level Security.

### 4. Configure Edge Function secrets

Add the required provider keys in **Supabase Dashboard → Edge Functions → Secrets**. Never place `SUPABASE_SERVICE_ROLE_KEY` in frontend code, extension files, or Git.

### 5. Start the app

```bash
npm run dev
```

The development server uses port `5181`:

- `http://localhost:5181` when no local certificate exists.
- `https://localhost:5181` after running `npm run setup:https`.

Use HTTPS for microphone testing through a LAN address. Browsers treat ordinary `localhost` as a secure development context, but a raw LAN IP requires HTTPS.

## Browser extension

The maintained extension is in `extension/` and uses Manifest V3.

1. Open `chrome://extensions/` or `edge://extensions/`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the repository's `extension/` directory.
5. Open the JobAI Scout extension and sign in.
6. Upload or confirm the application resume and profile photo if required.
7. Refresh any application page that was already open before installation.

After changing extension files, press **Reload** on the extension card and refresh the target job-application page.

### Extension safety model

- Safe factual fields require matching profile evidence.
- Low-confidence mappings remain suggestions for user review.
- Legal consent, diversity, disability, veteran status, CAPTCHA, signatures, and final submission remain manual.
- A standard resume or image file input can be filled when the private file is available.
- Google Forms file upload uses Google's protected picker, so the user must choose the saved file manually.
- The extension never submits an application automatically.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Sync local extension configuration and start Vite on port 5181 |
| `npm run setup:https` | Generate the local HTTPS development certificate |
| `npm run dev:https` | Start the certificate-aware development server |
| `npm run build` | Create the production Vite build in `dist/` |
| `npm run preview` | Preview the production bundle locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run the Vitest suite |
| `npm run extension:test` | Run decision-engine, content, Google Forms, and resume-upload extension regressions |
| `npm run extension:config` | Synchronize the Supabase extension host configuration |

## Project structure

```text
JobAi_Scout/
├── src/
│   ├── components/              Shared layout, brand, voice, and UI components
│   ├── contexts/                Authentication and role state
│   ├── integrations/supabase/   Typed Supabase client
│   ├── lib/                     Voice and application utilities
│   └── pages/
│       ├── recruiter/           Recruiter profile, jobs, candidates, and status
│       ├── Admin*.tsx           Administrative workspaces
│       └── *.tsx                Public and job-seeker experiences
├── extension/                   Manifest V3 form-filling extension
├── public/                      Brand assets and downloadable public files
├── supabase/
│   ├── functions/               Authentication-aware Edge Functions
│   └── migrations/              Schema, storage, search, and RLS policies
├── Project_plan/                Generated project reports and source generators
├── scripts/                     Local HTTPS and extension configuration tools
├── vercel.json                  Vercel Vite and SPA rewrite configuration
└── package.json                 Commands and dependencies
```

## Project documentation

Detailed Word and PDF reports are stored in `Project_plan/`:

- [Project report](Project_plan/JobAI_Scout_Project_Report.pdf)
- [Authentication explained](Project_plan/JobAI_Scout_Authentication_Explained.docx)
- [CV Upload explained](Project_plan/JobAI_Scout_CV_Upload_Explained.docx)
- [Browse and Saved Jobs explained](Project_plan/JobAI_Scout_Browse_and_Saved_Jobs_Explained.docx)
- [Form Fill and extension explained](Project_plan/JobAI_Scout_Form_Fill_and_Extension_Explained.docx)
- [Voice Assistant explained](Project_plan/JobAI_Scout_Voice_Assistant_Explained.docx)
- [Recruiter Panel explained](Project_plan/JobAI_Scout_Recruiter_Panel_Explained.docx)
- [Admin Panel explained](Project_plan/JobAI_Scout_Admin_Panel_Explained.docx)

The matching Python generators are kept beside the documents so reports can be reproduced after implementation changes.

## Deployment

Production: **https://job-ai-scout.vercel.app**

`vercel.json` configures the Vite build and rewrites application routes to `index.html`, allowing React Router pages such as `/dashboard/assistant`, `/recruiter/jobs`, and `/admin` to load directly.

Required `VITE_*` values must be configured in the Vercel project environment settings. Private AI/provider keys remain in Supabase Edge Function secrets rather than Vercel's client build.

## Testing checklist

Before publishing an important change:

```bash
npm run extension:test
npm run test
npm run build
```

For microphone changes, also verify permission granted, permission denied, listening, three-second silence submission, stop listening, stop speaking, session end, API failure, localhost, and production HTTPS.

## Troubleshooting

### Localhost refuses the connection

Confirm `npm run dev` is still running and open port `5181`. Do not use `https://localhost:5181` until the local certificate has been generated.

### Microphone access is denied

Use `localhost` or HTTPS, allow microphone permission in the browser's site settings, select the correct input device, and close other applications holding exclusive microphone access.

### Extension changes are missing

Reload the unpacked extension from the browser's extensions page, then refresh the application tab.

### Profile or resume fields remain empty

Complete and save the relevant Career Passport section, refresh the extension profile, and run Form Fill again. Protected or uncertain questions intentionally remain under user control.

### Vercel build fails

Confirm the project uses Node.js 18+, `npm ci`, `npm run build`, and `dist` as the output directory. Python dependencies belong to their own service and must not be mixed into Vercel's frontend install step.

## Security

- `.env`, `.env.local`, certificates, local Vercel metadata, and extension runtime configuration are ignored by Git.
- Never commit Supabase service-role keys, AI provider tokens, passwords, or private user documents.
- Revoke and replace any secret that has been exposed in a screenshot, terminal log, commit, or chat.
- Preserve Row Level Security when adding new recruiter, administrator, storage, or extension features.

## License and project context

JobAI Scout is an educational Final Year Project. Review third-party provider terms, privacy requirements, employment law, and data-retention obligations before operating it as a commercial recruitment service.

Built by **Abdullah Waheed** — [GitHub profile](https://github.com/Abdullaheveloper)

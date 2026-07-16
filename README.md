# 🤖 JobAI Scout

> An AI-powered job hunting platform with voice assistant, CV analysis, smart job matching, and browser extension autofill.

---

## ✨ Features

- 🎤 **Voice Assistant** — Talk to an AI that answers from your indexed knowledge base (RAG)
- 📄 **CV Upload & Analysis** — AI extracts skills, experience, and education automatically
- 💼 **Job Board** — Browse and save jobs with smart matching
- 🧩 **Browser Extension** — Autofills job application forms using your profile
- 👤 **Profile Settings** — Complete career profile with certifications, languages, education
- 🔐 **Role-based Access** — Separate dashboards for Job Seekers and Admins
- 📊 **Admin Panel** — Manage users, jobs, and view platform analytics

---

## 🚀 Quick Start (One Command)

```bash
git clone https://github.com/Abdullaheveloper/JobAi_Scout.git
cd JobAi_Scout
npm install
npm run dev
```

Then open **http://localhost:8080** in your browser.

---

## 📋 System Requirements

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | 18.0.0 or higher | https://nodejs.org |
| **npm** | 9.0.0 or higher | Comes with Node.js |
| **Git** | Latest | https://git-scm.com |
| **Browser** | Chrome / Edge (for mic and extension) | — |

---

## ⚙️ Full Setup Guide

### Step 1 — Clone the repository
```bash
git clone https://github.com/Abdullaheveloper/JobAi_Scout.git
cd JobAi_Scout
```

### Step 2 — Install all dependencies
```bash
npm install
```

### Step 3 — Create your `.env.local` file

Create a file named `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

> Get these from: **Supabase Dashboard → Project Settings → API**

### Step 4 — Set up Supabase Edge Function Secrets

Go to: **Supabase Dashboard → Edge Functions → Manage Secrets** and add:

| Secret Name | Where to Get It |
|-------------|----------------|
| `OPENROUTER_API_KEY` | https://openrouter.ai → API Keys |
| `GEMINI_API_KEY` | Google AI Studio → API Keys |
| `ELEVENLABS_API_KEY` | https://elevenlabs.io → Profile → API Keys |

### Step 5 — Run the database migrations

Go to **Supabase Dashboard → SQL Editor** and run each `.sql` file from `supabase/migrations/` in date order (oldest first).

### Step 6 — Start the development server
```bash
npm run dev
```

Open **http://localhost:8080** 🎉

---

## 🧩 Browser Extension Setup

1. Open Chrome/Edge → go to `chrome://extensions/`
2. Enable **Developer Mode** (toggle top-right)
3. Click **Load unpacked**
4. Select the `extension/` folder from this project
5. The JobAI extension icon will appear in your toolbar

---

## 📁 Project Structure

```
JobAi_Scout/
├── src/
│   ├── pages/                   # All page components
│   │   ├── VoiceAssistant.tsx   # Voice chat with AI
│   │   ├── ProfileSettings.tsx  # User profile
│   │   ├── Dashboard.tsx        # Job seeker dashboard
│   │   ├── AdminDashboard.tsx   # Admin panel
│   │   ├── CVUpload.tsx         # CV analysis
│   │   ├── JobBoard.tsx         # Browse jobs
│   │   └── Extension.tsx        # Browser extension guide
│   ├── components/
│   │   ├── DashboardLayout.tsx  # Role-based sidebar
│   │   └── ui/                  # Shadcn/ui components
│   ├── contexts/
│   │   └── AuthContext.tsx      # Authentication state
│   └── integrations/
│       └── supabase/            # Supabase client and types
│
├── supabase/
│   ├── functions/               # Edge Functions (Deno runtime)
│   │   ├── voice-chat/          # AI chat with RAG
│   │   ├── voice-transcribe/    # Speech-to-text (Whisper)
│   │   ├── elevenlabs-tts/      # Text-to-speech
│   │   ├── analyze-cv/          # CV parsing with AI
│   │   ├── kb-reindex/          # Knowledge base indexing
│   │   └── extension-profile/   # Profile API for extension
│   └── migrations/              # Database schema SQL files
│
├── extension/                   # Chrome/Edge browser extension
│   ├── manifest.json
│   ├── content.js               # Form autofill logic
│   ├── popup.html
│   └── popup.js
│
├── .env.local                   # Your env variables (NOT in git)
├── requirements.txt             # Full dependency reference
├── package.json                 # npm dependencies
└── README.md
```

---

## 🛠️ Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server at localhost:8080 |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests |

---

## 🗄️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **UI Library** | Shadcn/ui + Radix UI + Tailwind CSS |
| **Backend** | Supabase (PostgreSQL + Auth + Edge Functions) |
| **AI / LLM** | Gemini 2.5 Flash via OpenRouter (google/gemini-2.5-flash) |
| **Speech-to-Text** | OpenAI Whisper via OpenRouter |
| **Text-to-Speech** | ElevenLabs API |
| **Embeddings** | Gemini Embeddings via OpenRouter |
| **Vector Search** | pgvector (Supabase) |
| **State Management** | TanStack Query + React Context |
| **Routing** | React Router DOM v6 |
| **Forms** | React Hook Form + Zod |
| **Charts** | Recharts |
| **Animations** | Framer Motion + Tailwind Animate |

---

## 🔑 API Keys Reference

| Key | Required | Purpose |
|-----|----------|---------|
| `VITE_SUPABASE_URL` | ✅ Yes | Connect to Supabase database |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ Yes | Supabase anonymous client key |
| `OPENROUTER_API_KEY` | ✅ Yes | AI chat, CV analysis, and embeddings via OpenRouter |
| `GEMINI_API_KEY` | ✅ Yes | Google Gemini API key (for Gemini models via OpenRouter) |
| `ELEVENLABS_API_KEY` | Optional | Voice text-to-speech |

---

## 👥 User Roles

| Role | Access |
|------|--------|
| **Job Seeker** | Dashboard, Upload CV, Browse Jobs, Saved Jobs, Voice Assistant, Job Form Fill, Profile Settings |
| **Admin** | Admin Dashboard, Manage Users, Manage Jobs, Platform Analytics, Voice Assistant |

---

## 🐛 Troubleshooting

**Microphone not working?**
- Allow microphone permission in browser settings
- Use Chrome or Edge for best compatibility
- Make sure no other app is using the mic

**Profile save failing?**
- Run `supabase/migrations/20260622_fix_profiles_missing_columns.sql` in Supabase SQL Editor

**Voice assistant giving errors?**
- Make sure `OPENROUTER_API_KEY` and `GEMINI_API_KEY` are set in Supabase Edge Function secrets

**Extension not finding profile?**
- Log into the web app first — the extension uses the same session

---

## 📝 License

This project is for educational / FYP (Final Year Project) purposes.

---

## 🙋 Developer

Built by **Abdullah** — Final Year Project (FYP)
GitHub: [@Abdullaheveloper](https://github.com/Abdullaheveloper)

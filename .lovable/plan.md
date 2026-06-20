# Voice Assistant with RAG

Replaces the current AI Assistant page with a real voice-first agent, plus a floating glass mic widget on every dashboard page. Knowledge comes from your own website (default: the published URL of this app — you'll be able to add more URLs and reindex anytime).

## What you'll see

- **Floating mic button** (bottom-right) on all `/dashboard/*` pages — glassmorphic, with idle/listening/thinking/speaking states and a waveform animation.
- **Expandable chat panel** — live transcript while you speak, AI answer (text + speech), conversation history, "stop" button, and an "interrupt" behavior: if you start talking while the AI is speaking, TTS stops instantly and recording resumes.
- **Assistant page** (`/dashboard/assistant`) becomes a full-screen version of the same widget plus a **Knowledge Base** tab where you can:
  - Add website URLs to index
  - Trigger a re-crawl
  - See indexed pages and chunk counts
- Mobile-responsive, keyboard-accessible.

## How it answers (RAG)

```text
mic → STT (Whisper via Lovable AI)
    → embed question (Gemini embeddings)
    → pgvector similarity search over crawled site chunks
    → Gemini answer constrained to retrieved context
        ├─ site-specific question, no matches → "I couldn't find that information on this website."
        └─ general career question → answered freely (your "strict + career fallback" choice)
    → ElevenLabs TTS → streamed audio with waveform
```

## Backend (Lovable Cloud / Supabase)

Replaces the FastAPI + ChromaDB + Docker stack from the spec with the project's existing infra:

- **`pgvector`** extension enabled; tables:
  - `kb_sources(id, url, title, status, last_crawled_at, user_id)`
  - `kb_chunks(id, source_id, content, embedding vector(1536), chunk_index, url, title)` with HNSW cosine index
  - `voice_conversations(id, user_id, created_at)` + `voice_messages(id, conversation_id, role, content, created_at)`
  - RLS: every table scoped to `auth.uid()`; KB is per-user.
- **Edge functions** (replace the FastAPI endpoints 1:1):
  - `voice-transcribe` → POST audio blob → Whisper transcript (`POST /voice/transcribe`)
  - `voice-chat` → POST `{question, conversationId}` → embed → pgvector match → Gemini → returns `{answer, sources, conversationId}` (`POST /voice/chat`)
  - `voice-speak` → POST `{text}` → ElevenLabs MP3 stream (`POST /voice/speak`) — reuses existing `elevenlabs-tts`
  - `kb-reindex` → POST `{urls?: string[]}` → fetch sitemap.xml + crawl internal links (depth 2, same-origin, max 50 pages), strip HTML → chunk (~800 chars, 100 overlap) → embed via Lovable AI `text-embedding-3-small` → upsert into `kb_chunks` (`POST /website/reindex`)
- **System prompt** for `voice-chat`:
  > You are a website assistant. Answer only from the retrieved website context below. Never invent pricing, services, or policies. If the context does not contain the answer AND the question is about this website/company, reply exactly: "I couldn't find that information on this website." General career-advice questions (resumes, interviews, job search) may be answered from general knowledge.

## Frontend

- New `src/components/VoiceWidget.tsx` — floating bottom-right button, expandable panel, mounted inside `DashboardLayout` so it appears on every dashboard route.
- Rewrite `src/pages/VoiceAssistant.tsx` to host the full-screen voice UI + Knowledge Base management tab.
- Uses browser `MediaRecorder` (webm/mp4 auto-detect) for capture, `AudioContext` analyser for the waveform, and standard `<audio>` for playback so interruption = `audio.pause()` + immediate re-record.
- All glassmorphism via existing design tokens (no hardcoded colors).

## Things from the original spec I'm intentionally swapping

| Requested | Using instead | Why |
|---|---|---|
| FastAPI backend | Supabase Edge Functions (Deno) | This stack has no Python runtime; edge functions deploy automatically. |
| ChromaDB | Postgres + pgvector | Native to Lovable Cloud; no extra service. |
| Whisper self-hosted | `openai/gpt-4o-mini-transcribe` via Lovable AI | No API key needed, same quality, lower latency. |
| Kokoro / Edge TTS | ElevenLabs (already connected) | Kokoro/Edge TTS aren't available server-side here; ElevenLabs is already wired. |
| Next.js + Docker | Existing React + Vite app | Migration is out of scope and would replace the whole project. |

## After approval I'll build

1. Migration (pgvector + 4 tables + RLS + GRANTs + HNSW index).
2. Edge functions: `kb-reindex`, `voice-transcribe`, `voice-chat`. (`voice-speak` = existing `elevenlabs-tts`.)
3. `VoiceWidget` component + mount in `DashboardLayout`.
4. Rewrite `VoiceAssistant` page with chat + Knowledge Base management.
5. Trigger an initial crawl of your published URL so the assistant has something to answer from on first use.
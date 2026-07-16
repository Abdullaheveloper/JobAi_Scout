# JobAI Scout - Codebase Review & Cleanup Plan

## Executive Summary

An AI-powered job hunting platform (React + Supabase) with significant code duplication and dead code issues across frontend, edge functions, and browser extensions.

## Critical Findings

### 1. BUG: VoiceAgent.tsx auth token always undefined
- **File**: `src/pages/VoiceAgent.tsx` line 87
- **Issue**: Incorrect `getSession()` destructuring means auth token is always undefined
- **Fix**: Change `const { data: session }` to `const { data: { session } }`

### 2. Dead Code in supabase/functions/
- `openaiToGemini()` defined 4 times, NEVER called (send-application, generate-cover-letter, voice-agent-llm, voice-chat)
- `GEMINI_API_KEY` fetched but never used in `kb-ingest-document:277`, `kb-reindex:208`
- `voice-settings` stats endpoint unreachable (line 122 after general GET returns at line 28)

### 3. Hardcoded Supabase Credentials in 3 extension files
- `extension/api.js` lines 4-5
- `extension/content.js` lines 326-327
- `autofill-extension/src/lib/constants.ts` lines 1-3

## Duplication Analysis

### Frontend (src/pages/) - 14 duplicated patterns

| # | Pattern | Files | Lines Saved |
|---|---------|-------|-------------|
| 1 | AnimatedCounter | About.tsx, Dashboard.tsx, Index.tsx | ~120 |
| 2 | InputField | Login.tsx, Register.tsx | ~60 |
| 3 | Profile Completeness | CVUpload.tsx, ProfileSettings.tsx, AdminUsers.tsx | ~80 |
| 4 | Loading Spinner | 6 files | ~30 |
| 5 | Empty State Card | 4 files | ~40 |
| 6 | Extension Download | AutoFormFill.tsx, Extension.tsx, JobBoard.tsx | ~50 |
| 7 | Extension Setup Guide | 3 files | ~100 |
| 8 | Job Card | JobBoard.tsx, SavedJobs.tsx | ~80 |
| 9 | Auth Layout | 4 auth pages | ~200 |
| 10 | Public Footer | About.tsx, Contact.tsx | ~20 |
| 11 | Public Navbar | About.tsx, Contact.tsx | ~30 |
| 12 | Route Preloading | 3 files | ~30 |
| 13 | Salary Formatting | Applications.tsx, RecruiterJobs.tsx | ~10 |
| 14 | Source Type | AdminVoice.tsx, VoiceAssistant.tsx | ~20 |

### Components (src/components/) - 6 issues

| # | Issue | Files |
|---|-------|-------|
| 1 | Waveform duplication | VoiceWidget.tsx vs WaveformVisualizer.tsx |
| 2 | Chat bubble duplication | VoiceMode.tsx vs MessageBubble.tsx |
| 3 | Dead file: use-toast.ts wrapper | components/ui/use-toast.ts |
| 4 | Dead barrel: 3d/index.ts | components/3d/index.ts |
| 5 | Dead audioElRef | VoiceWidget.tsx:33 |
| 6 | Unused Source interface | SourceCitations.tsx:5 |

### Unused Imports - 33 across 10 files

- VoiceAssistant.tsx: 7 unused imports
- AdminVoice.tsx: 7 unused imports
- DashboardLayout.tsx: 5 unused imports
- Index.tsx: 4 unused imports
- Register.tsx: 4 unused imports
- About.tsx: 3 unused imports
- VoiceWidget.tsx: 1 unused ref

### Integrations/Contexts - 9 patterns

| # | Pattern | Copies |
|---|---------|--------|
| 1 | Auth token extraction | 5 files, 8 call sites |
| 2 | FUNCTIONS_URL constant | 3 files |
| 3 | Supabase key access | 3 variants |
| 4 | Email validation regex | 3 files |
| 5 | Source type definition | 4 places |
| 6 | SSE parsing | 2 implementations |
| 7 | onAuthStateChange | 2 listeners |
| 8 | InputField component | 2 near-identical copies |
| 9 | VoiceState type | 2 copies |

### Supabase Edge Functions - massive duplication

| # | Function | Copies |
|---|----------|--------|
| 1 | openaiToGemini() | 4 (DEAD) |
| 2 | cleanText() | 3 |
| 3 | chunkTextSemantic() | 3 |
| 4 | parsePagesAndChunk() | 2 |
| 5 | embed() (batch) | 3 (identical) |
| 6 | embedOne() | 2 (identical) |
| 7 | sanitizeInput() | 3 |
| 8 | rewriteQuery() | 2 |
| 9 | CORS headers | 22 |
| 10 | Dynamic context prompt | 2 |
| 11 | Voice cache pattern | 3 |
| 12 | Voice message persist | 4 |
| 13 | SSE stream parsing | 3 |
| 14 | Base64 encoding | 5 |

### Browser Extensions

- `extension/` and `autofill-extension/` are TWO implementations of the same product
- 7 out of 9 React components in autofill-extension are dead code
- Dead methods in `extension/`: `trackUsage`, `getUseProfile`, `setUseProfile`, `getProfileData`, `updateProfile`, `getProfileCompletionDetails`, `missingProfileFields`
- Dead file: `extension/test-form.html`

## Migration Issues

- Duplicate migrations: `20260622000001` and `20260622000002` add same columns
- `match_kb_chunks()` defined twice (`20260618192408` and `20260618192441`)
- `handle_new_user()` defined three times
- Missing `IF NOT EXISTS` in `20260409125211`
- Hardcoded user UUID in `20260308153058`

## Cleanup Priority Order

### Phase 1: Critical Fixes (Do First)

1. Fix VoiceAgent.tsx auth token bug
2. Remove `openaiToGemini()` dead code from 4 edge functions
3. Remove `GEMINI_API_KEY` false guards
4. Fix `voice-settings` unreachable stats endpoint

### Phase 2: Dead Code Removal (High Impact)

1. Remove 33 unused imports from 10 page files
2. Delete dead files: `components/ui/use-toast.ts`, `components/3d/index.ts`
3. Delete dead `audioElRef` in VoiceWidget.tsx
4. Delete dead `Source` interface in SourceCitations.tsx
5. Delete 7 dead components in autofill-extension
6. Delete dead methods in `extension/` files
7. Delete `extension/test-form.html`
8. Remove unused named exports from 3D components

### Phase 3: Shared Utilities (Medium Impact)

1. Create shared `InputField` component (Login + Register)
2. Create shared `AnimatedCounter` component (3 files)
3. Create shared `LoadingSpinner` component (6 files)
4. Extract `calculateProfileCompleteness` utility
5. Extract `getAuthHeader()` utility
6. Extract `FUNCTIONS_URL` constant
7. Extract email validation regex
8. Create shared `Source` types

### Phase 4: Supabase Function Consolidation (High Impact)

1. Create `_shared/` module for CORS headers
2. Create `_shared/` for `cleanText`, `chunkTextSemantic`, `embed`
3. Create `_shared/` for `sanitizeInput`, `rewriteQuery`
4. Create `_shared/` for base64 encoding
5. Consolidate `voice-agent-llm` and `voice-chat` pipelines
6. Standardize auth patterns across functions

### Phase 5: Extension Cleanup

1. Decide which extension to keep (`extension/` vs `autofill-extension/`)
2. Remove the other or properly consolidate
3. Move hardcoded credentials to environment variables

## Estimated Impact

| Category | Lines Saved |
|----------|-------------|
| Dead code removal | ~500 lines |
| Deduplication across frontend | ~800 lines |
| Deduplication across edge functions | ~1500 lines |
| **Total estimated reduction** | **~2800 lines** |
| Bug fix | VoiceAgent auth token |

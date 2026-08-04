# QA verification report — item 5

**Date:** 2026-07-28  
**Repo:** `E:/JobAi_Scout`  
**Base used for live nav:** `https://localhost:5181`  
**Auth:** No `I18N_*` / `RTL_*` / `NAV_*` credentials in process env or `.env` / `.env.local` → authenticated Profile Settings / Dashboard / Admin / Recruiter screenshots **not run**.

---

## Summary

| Item | Result | Notes |
|------|--------|--------|
| **A. i18n screenshots (hi / ur / ar)** | **FAIL** (partial) | Career Passport + contact **labels/titles** largely translated; remaining English UI chrome listed below. Live React route blocked (no auth). Locale-proof screenshots saved. |
| **B. Navbar mobile (375 / 390 / 414)** | **PASS** (public) / **GAP** (auth) | Landing / Login / About 9/9 OK. Dashboard / Profile / Admin / Recruiter skipped (no credentials). |
| **C. Duplicate certification** | **PASS** (unit + code) | `cv-profile-sync` 21/21; internship skip + title/URL dedupe confirmed in merge code. **E2E CV re-upload not run.** |
| **D. Autofill warning contrast** | **PASS** | Light **13.45:1**; dark samples **12.05–14.42:1** (≥4.5:1). |

---

## A. i18n — Career Passport + Profile contact form

### Method
- Script: `scripts/verify-career-passport-i18n.mjs`
- Mode: **locale-proof** HTML rendered from the same `careerPassport.*` / `settings.*` keys used by `CareerProfileWorkspace` / `ProfileSettings` / field schemas (no live `/dashboard/settings` without auth).
- Output dir: `scripts/verify-career-passport-i18n/`
- Machine audit: `scripts/verify-career-passport-i18n/report.json`

### Screenshots

| Locale | Contact form | Career Passport | Full proof |
|--------|--------------|-----------------|------------|
| hi | `hi-contact-proof.png` | `hi-career-passport-proof.png` | `hi-profile-settings-proof-full.png` |
| ur | `ur-contact-proof.png` | `ur-career-passport-proof.png` | `ur-profile-settings-proof-full.png` |
| ar | `ar-contact-proof.png` | `ar-career-passport-proof.png` | `ar-profile-settings-proof-full.png` |

### What passes
- **Career Passport** section chrome (title, subtitle, work/education/projects/credentials/references headings, add buttons, empty states, application autofill title + always-manual notice) is translated in **hi / ur / ar**; RTL layout correct for ur/ar.
- **Contact form** card title/description and field **labels** are translated in **hi / ur / ar** (`settings.contactBackground`, `settings.personalDesc`, name/email/phone/etc.).

### Remaining English UI chrome (FAIL drivers)
| Locale | Hard / soft | Evidence |
|--------|-------------|----------|
| **ur, ar** | Hard | `settings.saveChanges` = `"Save changes"`; `settings.desiredRoles` = `"Desired roles"`. |
| **hi, ur** | Soft (labels) | `careerPassport.fields.linkedinUrl` / `githubUrl` = `"LinkedIn URL"` / `"GitHub URL"`. |
| **ar** | Soft (brand) | Labels are `رابط LinkedIn` / `رابط GitHub` (localized prefix + brand); auditor still flags Latin brand tokens. |
| **ur, ar** | Soft (placeholders) | Multiple `settings.placeholder*` still English (name, location, bio, skills, roles, certs, languages, …). |
| **hi** | Soft (placeholders) | `settings.placeholderCompany` (`Acme Inc.`), `settings.placeholderCerts` (AWS/PMP…). |
| All | Auth gap | Live Profile Settings route not captured — set `I18N_EMAIL` / `I18N_PASSWORD` (or `RTL_*`) and re-run against a running app. |

**Verdict A:** **FAIL** — ur/ar still have English save CTA + desired-roles chrome and English placeholders; hi mostly good with LinkedIn/GitHub URL labels + placeholder soft gaps. Wiring uses `t()` correctly; leftovers are locale strings, not hardcoded React English.

---

## B. Navbar screenshots (375 / 390 / 414)

### Method
- Extended `scripts/nav-mobile-check.mjs` to optionally audit Dashboard / Profile Settings / Admin / Recruiter when credentials exist.
- Ran against `NAV_BASE_URL=https://localhost:5181`.

### Public results — **PASS** (9/9)

| Page | 375 | 390 | 414 | Screenshots |
|------|-----|-----|-----|-------------|
| Landing | OK (CTA + menu + appearance) | OK | OK | `scripts/nav-mobile-screenshots/landing-{375,390,414}.png` |
| Login | OK | OK | OK | `login-*.png` |
| About | OK | OK | OK | `about-*.png` |

Report: `scripts/nav-mobile-screenshots/report.json`

### Auth-gated — **GAP**
- Dashboard, Profile Settings, Admin, Recruiter **not** screenshot/audited.
- Gap message: no `NAV_` / `I18N_` / `RTL_` seeker/admin/recruiter credentials.

**Verdict B:** **PASS** for public Landing/Login/About; **incomplete** for authenticated shells.

---

## C. Duplicate certification fix

### Code path (reviewed)
- `supabase/functions/_shared/cv-profile-merge.ts`
  - `isInternshipLikeCredential()` — drops internship-shaped credential rows.
  - `collectCredentialsFromExtracted()` — skips `experience.type === "internship"` (even with verify-certificate URLs); collects real credentials from `credentials[]` + certification lines; dedupes via `dedupeCredentialEntries()` on normalized **title** and shared **verification URL**.
- `supabase/functions/analyze-cv/index.ts` — prompt contract: internships must not be promoted into `credentials[]`.

### Tests
```
npx vitest run src/test/cv-profile-sync.test.ts
→ 21 passed (incl. “collects real credentials and skips internship duplicates”)
```

### E2E
- Fresh CV re-upload against a live account: **not run** (no auth fixtures).

**Verdict C:** **PASS** on unit tests + code review; E2E outstanding.

---

## D. Application Autofill warning contrast

### Classes (`src/pages/ProfileSettings.tsx`)
```
border-amber-600/35 bg-amber-100 text-amber-950
dark:border-amber-400/35 dark:bg-amber-500/20 dark:text-amber-50
```

### Approximate WCAG (script: `scripts/verify-autofill-contrast.mjs` → `contrast-report.json`)

| Mode | FG | BG (effective) | Ratio | ≥4.5:1 |
|------|----|----------------|-------|--------|
| Light | `#451a03` (amber-950) | `#fef3c7` (amber-100) | **13.45** | PASS |
| Dark on slate-950 | `#fffbeb` (amber-50) | `#332415` (amber-500 @ 20%) | **14.42** | PASS |
| Dark on zinc-950 | `#fffbeb` | `#38270b` | **13.84** | PASS |
| Dark on slate-900 card | `#fffbeb` | `#3d3224` | **12.05** | PASS |

**Verdict D:** **PASS**

---

## Remaining gaps (actionable)

1. Translate **ur/ar** `settings.saveChanges` (and preferably remaining English `settings.*` on the same page: work authorization, placeholders, uploading, desired roles, etc.).
2. Localize **hi/ur** `careerPassport.fields.linkedinUrl` / `githubUrl` (and English placeholders) if zero-English chrome is required.
3. Provide seeker (and optionally admin/recruiter) credentials → re-run:
   - `I18N_EMAIL=… I18N_PASSWORD=… I18N_BASE_URL=https://localhost:5181 node scripts/verify-career-passport-i18n.mjs`
   - `NAV_EMAIL=… NAV_PASSWORD=… NAV_BASE_URL=https://localhost:5181 node scripts/nav-mobile-check.mjs`
4. Optional: E2E CV re-upload to confirm internship credentials do not reappear in Credentials & recognition.

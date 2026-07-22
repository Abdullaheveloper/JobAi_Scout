# CV Upload Feature - Complete Workflow

## Overview
The CV Upload feature performs three critical tasks:

### 1️⃣ **Extract Data from CV & Auto-Fill Profile**
### 2️⃣ **Provide Resume Quality Suggestions**
### 3️⃣ **Smart CV Update Logic (New CV Override)**

---

## Feature 1: Extract Data from CV & Auto-Fill Profile

### Flow
```
User Uploads CV (PDF)
    ↓
Parse CV (extract text)
    ↓
AI Extraction (Claude/GPT)
    ↓
Extract these fields:
    • Name
    • Email
    • Phone
    • Location (City, Country)
    • Professional Title
    • Professional Summary
    • Skills (categorized)
    • Experience (company, role, duration, achievements)
    • Projects (name, description, tech stack)
    • Education (degree, university, graduation year)
    • Certifications
    • GitHub, LinkedIn, Portfolio URLs
    ↓
Auto-fill User Profile in Supabase
    ↓
Show Extracted Data to User for Review
```

### Extracted Data Example
```json
{
  "name": "Abdullah Waheed",
  "email": "abdullah@example.com",
  "phone": "+1-555-1234",
  "city": "San Francisco",
  "country": "USA",
  "title": "AI Engineer",
  "professionalSummary": "AI Engineer with 2 years of experience...",
  "skills": {
    "languages": ["Python", "TypeScript", "JavaScript"],
    "frameworks": ["FastAPI", "React", "Next.js"],
    "ai_ml": ["OpenAI", "LangChain", "ChromaDB"]
  },
  "experience": [
    {
      "company": "JobAi Scout",
      "role": "AI Engineer",
      "duration": "Jul 2024 - Present",
      "achievements": [
        "Built voice AI assistant reducing form filling by 80%",
        "Developed job scraping pipeline collecting 10,000+ listings"
      ],
      "technologies": ["Python", "OpenAI", "FastAPI"]
    }
  ]
}
```

---

## Feature 2: Resume Quality Suggestions

### Automatic Analysis
After extraction, the **Resume Quality Alert** automatically analyzes:

```
Extracted Data
    ↓
Run Against ATS Standards (knowledge/ats_resume_guide.md)
    ↓
Detect Missing/Weak Items:
    ❌ GitHub Profile
    ❌ LinkedIn Profile  
    ❌ Portfolio Website
    ❌ Professional Summary
    ❌ Categorized Skills
    ❌ Weak Project Descriptions
    ❌ Missing Work Experience
    ❌ Profile Image
    ↓
Generate Score: 37/100 → 90/100
    ↓
Display Notification with:
    • Current Score
    • Potential Score
    • Specific Issues to Fix
    • Improvement Points
```

### Score Calculation
```
Based on ATS Standards:
- GitHub Profile: +8 points
- LinkedIn Profile: +7 points
- Portfolio Website: +6 points
- Professional Summary: +8 points
- Categorized Skills: +12 points
- Project Descriptions: +15 points
- Work Experience: +18 points
- Profile Image: +4 points
- Education Section: +3 points
- Contact Information: +2 points
- Professional Title: +2 points

Total: 100 points maximum
```

### User Sees
```
📋 Resume Quality Issues Detected

❌ GitHub Profile — Missing
❌ LinkedIn Profile — Missing
❌ Portfolio Website — Missing
✅ Professional Summary — Present
✅ Skills — Categorized
❌ Project Descriptions — Weak (1 weak)
✅ Work Experience — Present
❌ Profile Image — Missing

Current Score: 45/100
Potential Score: 90/100
```

---

## Feature 3: Smart CV Update Logic

### Problem Scenario

#### Old CV Data (Already in Profile)
```json
{
  "name": "Abdullah Waheed",
  "email": "abdullah@example.com",
  "phone": "+1-555-1234",
  "linkedin": "https://linkedin.com/in/abdullah",
  "github": "https://github.com/abdullaheveloper",
  "title": "AI Engineer",
  "summary": "Experienced AI Engineer...",
  "city": "San Francisco"
}
```

#### User Uploads NEW CV

**Scenario 1: Field is UPDATED in new CV**
```
Old CV: name = "Abdullah Waheed"
New CV: name = "Abdullah W. Developer"
Result: Profile updates to "Abdullah W. Developer" ✅
```

**Scenario 2: Field is EMPTY in new CV (CRITICAL)**
```
Old CV: city = "San Francisco"
New CV: city = "" (empty/missing in CV)
Result: Profile should be cleared to "" ✅

Old CV: linkedin = "https://linkedin.com/in/abdullah"
New CV: linkedin = "" (not mentioned in new CV)
Result: Profile should be cleared to "" ✅
```

**Scenario 3: Field is NOT MENTIONED in new CV (TRICKY)**
```
Problem: How do we know if field was intentionally removed or just not in the CV?

Solution: 
- If field appears in OLD CV → but NOT in NEW CV
- AND field is "extracted" field (from ATS parsing)
- → CLEAR the field in profile

BUT:
- User manually entered fields (like GitHub, Portfolio)
- → PRESERVE them (don't clear if not in CV)

Decision Logic:
  If (field was extracted from CV before) AND (field is empty in new CV) 
    → Clear the field
  Else if (field was manually added by user) 
    → Preserve the field
```

### Implementation Algorithm

```typescript
interface CVUpdateLogic {
  extractedFields: string[]; // Fields that came from CV parsing
  userManualFields: string[]; // Fields user entered manually
  
  updateProfile(oldProfile, newCVData) {
    let updatedProfile = { ...oldProfile };
    
    for (const field of allProfileFields) {
      if (newCVData[field] !== undefined) {
        // New CV has explicit value (empty or filled)
        updatedProfile[field] = newCVData[field];
        markAsExtracted(field);
      } else {
        // Field not mentioned in new CV
        if (isExtractedField(field)) {
          // It came from old CV, but not in new CV
          // Clear it only if it was explicitly empty in new CV
          // If truly not mentioned, keep asking user's intent
          updatedProfile[field] = null; // or ask user
        }
        // If manual field → don't touch it
      }
    }
    
    return updatedProfile;
  }
}
```

### User Experience Flow

```
User Uploads NEW CV
    ↓
System Extracts Data from NEW CV
    ↓
Compare with OLD Profile:
    • Fields that changed → Update automatically
    • Fields that are empty in new CV → Show warning
      "These fields exist in your old profile but are empty in new CV:
       - Location (Old: San Francisco, New: empty)
       - LinkedIn (Old: https://..., New: empty)
       
       Should we clear them or keep them?"
    ↓
User Confirms (Yes/No for each field)
    ↓
Update Profile in Supabase
    ↓
Re-run Resume Quality Analysis
    ↓
Show Updated Score & Suggestions
```

### Example Walkthrough

**Step 1: User's Current Profile**
```
Name: Abdullah Waheed
Email: abdullah@example.com
Phone: +1-555-1234
Title: Software Engineer
GitHub: https://github.com/abdullaheveloper
LinkedIn: https://linkedin.com/in/abdullah
Location: San Francisco
Summary: "I am a software engineer..."
```

**Step 2: User Uploads NEW CV (with different content)**

New CV contains:
```
Name: Abdullah W.
Email: aw@newemail.com
Phone: +1-666-5678
Title: AI Engineer
Location: New York
Summary: "AI Engineer with expertise..."
(GitHub, LinkedIn NOT mentioned in new CV)
```

**Step 3: System Analysis**
```
Extracted from new CV:
✅ name: "Abdullah W." → UPDATE
✅ email: "aw@newemail.com" → UPDATE
✅ phone: "+1-666-5678" → UPDATE
✅ title: "AI Engineer" → UPDATE
✅ location: "New York" → UPDATE
✅ summary: "AI Engineer with expertise..." → UPDATE

NOT in new CV (but in old profile):
⚠️ github: OLD="https://github.com/abdullaheveloper", NEW=empty → ASK USER
⚠️ linkedin: OLD="https://linkedin.com/in/abdullah", NEW=empty → ASK USER
```

**Step 4: Ask User**
```
📋 CV Update Confirmation

These links exist in your profile but aren't mentioned in your new CV.
Should we remove them or keep them?

⚠️ GitHub
  Current: https://github.com/abdullaheveloper
  Options: [Remove] [Keep]

⚠️ LinkedIn  
  Current: https://linkedin.com/in/abdullah
  Options: [Remove] [Keep]
```

**Step 5: User Decides**
```
User selects:
- GitHub: [Keep] ✅
- LinkedIn: [Remove] ❌
```

**Step 6: Profile Updated**
```
Name: Abdullah W. ✅ (updated)
Email: aw@newemail.com ✅ (updated)
Phone: +1-666-5678 ✅ (updated)
Title: AI Engineer ✅ (updated)
Location: New York ✅ (updated)
Summary: "AI Engineer with expertise..." ✅ (updated)
GitHub: https://github.com/abdullaheveloper ✅ (kept)
LinkedIn: (empty) ✅ (removed)
```

**Step 7: New Resume Quality Score**
```
Previous Score: 72/100
New Score: 68/100 (-4 points because LinkedIn removed)

Suggestion: Add LinkedIn profile to improve score
```

---

## Technical Implementation

### Database Schema for Tracking

```sql
CREATE TABLE profile_fields (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  field_name TEXT,
  field_value TEXT,
  source TEXT, -- 'extracted_from_cv' | 'manual_entry' | 'mixed'
  last_cv_upload_id UUID REFERENCES cv_uploads(id),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE cv_uploads (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  file_name TEXT,
  extracted_data JSONB,
  extraction_timestamp TIMESTAMP,
  processed_at TIMESTAMP
);
```

### Extraction Process

```typescript
// 1. Upload CV
async function uploadCV(file: File, userId: string) {
  const cvUpload = await supabase.storage
    .from('cv-uploads')
    .upload(`${userId}/${file.name}`, file);
  
  return cvUpload;
}

// 2. Extract Data from CV (call Python service or use Supabase function)
async function extractCVData(cvPath: string) {
  const response = await fetch('/api/extract-cv', {
    method: 'POST',
    body: JSON.stringify({ cvPath }),
  });
  
  return response.json(); // Returns extracted fields
}

// 3. Analyze Against Profile
async function analyzeAndUpdateProfile(userId: string, extractedData: any) {
  // Get current profile
  const oldProfile = await getProfile(userId);
  
  // Get Resume Quality Score
  const analysis = analyzeResumeQuality(extractedData);
  
  // Determine which fields to clear
  const fieldsToConfirm = findFieldDifferences(oldProfile, extractedData);
  
  return {
    analysis,
    fieldsToConfirm,
    extractedData,
  };
}

// 4. Apply Updates
async function applyProfileUpdates(
  userId: string,
  updates: any,
  userConfirmations: any
) {
  const finalData = {
    ...updates,
    ...userConfirmations, // User's yes/no decisions
  };
  
  await updateProfile(userId, finalData);
  
  // Re-analyze
  const newAnalysis = analyzeResumeQuality(finalData);
  
  return newAnalysis;
}
```

---

## UI Components Needed

### 1. CV Upload Component
```tsx
<CVUploadComponent 
  onSuccess={(extractedData) => handleExtraction(extractedData)}
  onAnalysis={(analysis) => showResumeAlert(analysis)}
/>
```

### 2. Extraction Preview
```tsx
<ExtractionPreview 
  extractedData={data}
  onConfirm={() => applyUpdates()}
/>
```

### 3. Field Confirmation Dialog
```tsx
<FieldDifferenceDialog
  oldProfile={old}
  newProfile={new}
  onConfirm={(decisions) => applyProfileUpdates(decisions)}
/>
```

### 4. Resume Quality Alert (Already Built ✅)
```tsx
<ResumeQualityAlert
  currentScore={analysis.score}
  potentialScore={analysis.potentialScore}
  issues={analysis.issues}
/>
```

---

## Summary: Three Key Features

| Feature | What It Does | User Sees |
|---------|-------------|-----------|
| **Extract & Fill** | Parses CV, extracts all fields, auto-fills profile | Profile populated with CV data |
| **Quality Suggestions** | Analyzes data against ATS standards | Resume Quality Alert notification |
| **Smart Update** | Handles new CV uploads intelligently, asks before clearing fields | Confirmation dialog for field changes |

---

## Next Steps

1. Build CV Upload component with file parsing
2. Implement AI extraction (Claude or GPT API)
3. Create field difference detection logic
4. Build confirmation dialog UI
5. Integrate with existing Resume Quality Alert
6. Test with sample CVs

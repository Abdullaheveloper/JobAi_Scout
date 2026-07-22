# Resume Quality Alert System

Complete UI system for displaying resume quality issues based on ATS standards.

## Components

### 1. **ResumeQualityAlert.tsx**
Main visual component that displays the notification checklist.

**Features:**
- ❌ Clear missing/weak issue indicators
- 📊 Current score vs. potential score
- 🎯 Improvement tracking (+X points)
- 🎨 Dark theme matching JobAi Scout design
- ⚡ Interactive and dismissible

**Props:**
```typescript
interface ResumeQualityAlertProps {
  currentScore: number;           // e.g., 37
  potentialScore: number;         // e.g., 90
  issues: ResumeIssue[];          // Array of issues to display
  onDismiss?: () => void;         // Handle dismissal
  onIssueClick?: (issueId: string) => void; // Handle issue clicks
}
```

## Utilities

### 2. **resume-quality-analyzer.ts**
Core analysis engine that evaluates resume against ATS standards.

**Main Function:**
```typescript
analyzeResumeQuality(resume: ResumeData): ResumeAnalysisResult
```

**Returns:**
```typescript
{
  score: number;                // Current score (0-100)
  potentialScore: number;       // Achievable score
  issues: {                     // Array of issues
    id: string;
    label: string;
    status: 'missing' | 'weak';
    weight: number;
  }[];
  strengths: string[];          // Things done well
  candidateLevel: string;       // fresher | early-career | mid-level | senior
}
```

**Scoring Categories:**
- GitHub Profile: 8 points
- LinkedIn Profile: 7 points
- Portfolio Website: 6 points
- Professional Summary: 8 points
- Categorized Skills: 12 points
- Project Descriptions: 15 points
- Work Experience: 18 points
- Profile Image: 4 points
- Education Section: 3 points
- Contact Information: 2 points
- Professional Title: 2 points

**Total Possible: 100 points**

## Hooks

### 3. **useResumeAnalysis.ts**
React hook for easy component integration.

**Usage:**
```typescript
const { analysis, isLoading, isDismissed, handleDismiss, handleReanalyze } = useResumeAnalysis({
  resumeData,
  autoAnalyze: true,
});
```

**Returns:**
```typescript
{
  analysis: ResumeAnalysisResult | null;
  isLoading: boolean;
  isDismissed: boolean;
  handleDismiss: () => void;
  handleReanalyze: () => void;
}
```

## Integration Example

### Basic Usage

```tsx
import { ResumeQualityAlert } from '@/components/profile/ResumeQualityAlert';
import { useResumeAnalysis } from '@/hooks/useResumeAnalysis';

export function ProfileSettings() {
  // Your profile data from Supabase
  const profileData = {
    name: 'John Doe',
    email: 'john@example.com',
    linkedin: 'https://linkedin.com/in/johndoe',
    github: 'https://github.com/johndoe',
    // ... more fields
  };

  const { analysis, isDismissed, handleDismiss } = useResumeAnalysis({
    resumeData: profileData,
    autoAnalyze: true,
  });

  if (!analysis || isDismissed) return null;

  return (
    <div className="p-6">
      <ResumeQualityAlert
        currentScore={analysis.score}
        potentialScore={analysis.potentialScore}
        issues={analysis.issues}
        onDismiss={handleDismiss}
        onIssueClick={(issueId) => {
          // Scroll to relevant section or open edit modal
          console.log('Fix issue:', issueId);
        }}
      />
    </div>
  );
}
```

### With ProfileSettings Page

Place the alert at the top of your `src/pages/ProfileSettings.tsx`:

```tsx
export function ProfileSettingsPage() {
  const { profileData } = useProfileData(); // Your existing hook
  const { analysis, isDismissed, handleDismiss } = useResumeAnalysis({
    resumeData: profileData,
  });

  return (
    <div className="space-y-6">
      {!isDismissed && analysis && (
        <ResumeQualityAlert
          currentScore={analysis.score}
          potentialScore={analysis.potentialScore}
          issues={analysis.issues}
          onDismiss={handleDismiss}
        />
      )}

      {/* Rest of your profile settings form */}
      <ProfileEditForm data={profileData} />
    </div>
  );
}
```

## Data Structure

The analyzer expects a `ResumeData` object:

```typescript
interface ResumeData {
  // Basic Info
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;

  // Links
  linkedin?: string;
  github?: string;
  portfolio?: string;
  profileImage?: string;

  // Content
  professionalSummary?: string;
  
  skills?: {
    category: string;
    items: string[];
  }[];
  
  experience?: {
    company: string;
    role: string;
    duration: string;
    achievements: string[];
    technologies: string[];
  }[];
  
  projects?: {
    name: string;
    description: string;
    technologies: string[];
    github?: string;
    demo?: string;
  }[];
  
  education?: {
    degree: string;
    university: string;
    graduation: string;
    cgpa?: string;
  }[];
  
  certifications?: string[];
}
```

## Styling

The component uses Tailwind CSS classes compatible with your existing setup:

- **Color Scheme:** Red/Orange warning gradient with green action button
- **Icons:** Lucide React (already in your dependencies)
- **Responsive:** Mobile-friendly with proper spacing
- **Theme:** Dark mode (matches your JobAi Scout design)

## Dismissal Behavior

- Alert can be dismissed by clicking X button or "Dismiss" button
- Dismissal state is saved to localStorage
- Can be re-triggered by calling `handleReanalyze()`
- Shows again when profile data changes

## ATS Scoring Based On

Based on `knowledge/ats_resume_guide.md`:
- Missing GitHub: -8 points
- Missing LinkedIn: -7 points
- Missing Portfolio: -6 points
- Missing Professional Summary: -8 points
- Uncategorized Skills: -12 points
- Weak Project Descriptions: -15 points
- Missing Work Experience: -18 points
- Missing Profile Image: -4 points
- Missing Education: -3 points
- Incomplete Contact Info: -2 points
- Weak Professional Title: -2 points

## Next Steps

1. Import components in your ProfileSettings page
2. Connect to your profile data from Supabase
3. Add click handlers to navigate to edit sections
4. Test with sample data
5. Deploy to production

## Files Created

- ✅ `src/components/profile/ResumeQualityAlert.tsx` - Main component
- ✅ `src/lib/resume-quality-analyzer.ts` - Analysis logic
- ✅ `src/hooks/useResumeAnalysis.ts` - React hook
- ✅ `src/components/profile/ResumeQualityAlertExample.tsx` - Usage example

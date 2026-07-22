/**
 * Quick Integration Guide for Resume Quality Alert
 * Add this to your ProfileSettings or Dashboard component
 */

// Step 1: Import the component and hook
import { ResumeQualityAlert } from '@/components/profile/ResumeQualityAlert';
import { useResumeAnalysis } from '@/hooks/useResumeAnalysis';

// Step 2: In your component function, use the hook
export function YourProfileComponent() {
  // Get profile data from your existing Supabase query
  const { data: profile } = useQuery(['profile'], fetchProfile);

  // Initialize the resume analysis
  const { analysis, isDismissed, handleDismiss } = useResumeAnalysis({
    resumeData: profile, // Pass your profile data
    autoAnalyze: true,   // Auto-analyze on mount
  });

  // Step 3: Render the alert (place it at the top of your profile section)
  return (
    <div className="space-y-6">
      {/* ✅ Add this alert at the TOP */}
      {!isDismissed && analysis && (
        <ResumeQualityAlert
          currentScore={analysis.score}
          potentialScore={analysis.potentialScore}
          issues={analysis.issues}
          onDismiss={handleDismiss}
          onIssueClick={(issueId) => {
            // Route to the relevant edit section based on issue ID
            handleEditSection(issueId);
          }}
        />
      )}

      {/* 🔧 Rest of your profile form goes here */}
      <div className="bg-slate-900 rounded-lg p-6">
        {/* Your existing profile editing UI */}
      </div>
    </div>
  );
}

// Optional: Handle issue clicks to scroll to relevant sections
function handleEditSection(issueId: string) {
  const sectionMap: Record<string, string> = {
    'github': 'links-section',
    'linkedin': 'links-section',
    'portfolio': 'links-section',
    'summary': 'summary-section',
    'skills': 'skills-section',
    'projects': 'projects-section',
    'experience': 'experience-section',
    'image': 'profile-image-section',
    'education': 'education-section',
    'contact': 'contact-section',
    'title': 'title-section',
  };

  const targetElement = document.getElementById(sectionMap[issueId]);
  if (targetElement) {
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Optional: highlight or focus the section
    targetElement.classList.add('border-2', 'border-yellow-400');
  }
}

/**
 * COMPLETE EXAMPLE: ProfileSettings Page with Resume Quality Alert
 */

export function ProfileSettingsPage() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useQuery(
    ['profile', user?.id],
    () => fetchProfileFromSupabase(user?.id),
  );

  const { analysis, isDismissed, handleDismiss } = useResumeAnalysis({
    resumeData: profile,
    autoAnalyze: !isLoading,
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-white">Profile Settings</h1>

        {/* 🎯 RESUME QUALITY ALERT - Place at top */}
        {!isDismissed && analysis && (
          <ResumeQualityAlert
            currentScore={analysis.score}
            potentialScore={analysis.potentialScore}
            issues={analysis.issues}
            onDismiss={handleDismiss}
            onIssueClick={handleEditSection}
          />
        )}

        {/* Basic Info Section */}
        <div id="title-section" className="bg-slate-900 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-white">Basic Information</h2>
          <input
            type="text"
            placeholder="Your Name"
            defaultValue={profile?.name}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white"
          />
          <input
            type="text"
            placeholder="Professional Title (e.g., AI Engineer)"
            defaultValue={profile?.title}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white"
          />
        </div>

        {/* Links Section */}
        <div id="links-section" className="bg-slate-900 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-white">Professional Links</h2>
          <input
            type="url"
            placeholder="GitHub Profile URL"
            defaultValue={profile?.github}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white"
          />
          <input
            type="url"
            placeholder="LinkedIn Profile URL"
            defaultValue={profile?.linkedin}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white"
          />
          <input
            type="url"
            placeholder="Portfolio Website URL"
            defaultValue={profile?.portfolio}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white"
          />
        </div>

        {/* Summary Section */}
        <div id="summary-section" className="bg-slate-900 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-white">Professional Summary</h2>
          <textarea
            placeholder="Write a 3-5 line professional summary..."
            defaultValue={profile?.professionalSummary}
            rows={4}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white"
          />
        </div>

        {/* Skills Section */}
        <div id="skills-section" className="bg-slate-900 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-white">Skills (Categorized)</h2>
          {/* Skills editing UI */}
        </div>

        {/* Projects Section */}
        <div id="projects-section" className="bg-slate-900 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-white">Projects</h2>
          {/* Projects editing UI */}
        </div>

        {/* Experience Section */}
        <div id="experience-section" className="bg-slate-900 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-white">Work Experience</h2>
          {/* Experience editing UI */}
        </div>

        {/* Save Button */}
        <div className="flex gap-3">
          <button className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold">
            Save Changes
          </button>
          <button className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

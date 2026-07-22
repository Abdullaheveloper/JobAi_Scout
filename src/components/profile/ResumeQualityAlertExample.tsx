/**
 * Example: Resume Quality Alert Integration
 * Shows how to use the ResumeQualityAlert component in the Profile Settings page
 */

import React from 'react';
import { ResumeQualityAlert } from '@/components/profile/ResumeQualityAlert';
import { useResumeAnalysis } from '@/hooks/useResumeAnalysis';
import { ResumeData } from '@/lib/resume-quality-analyzer';

// Example usage in your ProfileSettings or Dashboard component
export const ResumeQualityAlertExample: React.FC = () => {
  // This would come from your Supabase profile data
  const resumeData: ResumeData = {
    name: 'Abdullah Waheed',
    title: 'Software Engineer', // ✅ Good title
    email: 'abdullah@example.com', // ✅ Good
    phone: '+1234567890',
    city: 'San Francisco',
    country: 'USA',
    // ❌ Missing:
    // linkedin: '',
    // github: '',
    // portfolio: '',
    // profileImage: '',
    
    // ❌ Weak or Missing:
    professionalSummary: '', // Missing
    
    skills: [
      {
        category: 'Programming Languages',
        items: ['Python', 'TypeScript', 'JavaScript'],
      },
      {
        category: 'Frameworks',
        items: ['FastAPI', 'React', 'Next.js'],
      },
      // Only 2 categories - could be more categorized
    ],
    
    projects: [
      {
        name: 'Project 1',
        description: 'Made a project', // ❌ Weak - no metrics
        technologies: ['React', 'Node.js'],
      },
    ],
    
    experience: [], // ❌ Missing
    
    education: [
      {
        degree: 'Bachelor in Computer Science',
        university: 'University Name',
        graduation: '2023',
      },
    ],
  };

  const { analysis, isDismissed, handleDismiss } = useResumeAnalysis({
    resumeData,
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
          console.log('Clicked issue:', issueId);
          // Navigate to the relevant section
          // e.g., scroll to skills section, open edit modal, etc.
        }}
      />

      {/* Rest of your profile settings UI */}
      <div className="mt-8 p-6 bg-slate-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Your Profile</h2>
        {/* Profile editing form here */}
      </div>
    </div>
  );
};

export default ResumeQualityAlertExample;

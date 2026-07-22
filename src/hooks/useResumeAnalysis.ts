import { useState, useEffect } from 'react';
import { analyzeResumeQuality, ResumeData, ResumeAnalysisResult } from '@/lib/resume-quality-analyzer';

interface UseResumeAnalysisProps {
  resumeData?: ResumeData;
  autoAnalyze?: boolean;
}

export const useResumeAnalysis = ({
  resumeData,
  autoAnalyze = true,
}: UseResumeAnalysisProps) => {
  const [analysis, setAnalysis] = useState<ResumeAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!autoAnalyze || !resumeData) return;

    setIsLoading(true);
    // Simulate analysis delay for better UX
    const timer = setTimeout(() => {
      const result = analyzeResumeQuality(resumeData);
      setAnalysis(result);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [resumeData, autoAnalyze]);

  const handleDismiss = () => {
    setIsDismissed(true);
    // Optionally save to localStorage
    localStorage.setItem('resumeAlert_dismissed', JSON.stringify({
      timestamp: Date.now(),
      score: analysis?.score,
    }));
  };

  const handleReanalyze = () => {
    if (resumeData) {
      const result = analyzeResumeQuality(resumeData);
      setAnalysis(result);
      setIsDismissed(false);
      localStorage.removeItem('resumeAlert_dismissed');
    }
  };

  return {
    analysis,
    isLoading,
    isDismissed,
    handleDismiss,
    handleReanalyze,
  };
};

export default useResumeAnalysis;

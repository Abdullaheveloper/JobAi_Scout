import React, { useState } from 'react';
import { X, AlertCircle, TrendingUp } from 'lucide-react';

interface ResumeIssue {
  id: string;
  label: string;
  status: 'missing' | 'weak';
}

interface ResumeQualityAlertProps {
  currentScore: number;
  potentialScore: number;
  issues: ResumeIssue[];
  onDismiss?: () => void;
  onIssueClick?: (issueId: string) => void;
}

export const ResumeQualityAlert: React.FC<ResumeQualityAlertProps> = ({
  currentScore,
  potentialScore,
  issues,
  onDismiss,
  onIssueClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const scoreDifference = potentialScore - currentScore;

  if (!isExpanded) return null;

  return (
    <div className="w-full bg-gradient-to-r from-red-950 via-red-900 to-orange-900 border border-red-700 rounded-lg p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-300" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">
              Resume Quality Issues Detected
            </h3>
            <p className="text-sm text-red-200">
              {issues.length} items need attention
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-1 hover:bg-red-800 rounded transition"
          aria-label="Dismiss notification"
        >
          <X className="w-5 h-5 text-red-300" />
        </button>
      </div>

      {/* Score Improvement */}
      <div className="mb-5 p-3 bg-red-800/50 rounded-lg border border-red-700/50">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium text-red-100">Potential Improvement</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">{currentScore}</span>
          <span className="text-sm text-red-300">/100</span>
          <span className="text-sm text-red-400 mx-1">→</span>
          <span className="text-2xl font-bold text-green-400">{potentialScore}</span>
          <span className="text-sm text-green-300">/100</span>
          <span className="ml-2 px-2 py-1 bg-green-900/50 rounded text-xs font-semibold text-green-300">
            +{scoreDifference} points
          </span>
        </div>
      </div>

      {/* Issues List */}
      <div className="space-y-2 mb-4">
        {issues.map((issue) => (
          <div
            key={issue.id}
            onClick={() => onIssueClick?.(issue.id)}
            className="flex items-center gap-3 p-3 bg-red-800/30 hover:bg-red-800/50 rounded-lg border border-red-700/30 cursor-pointer transition group"
          >
            <span className="text-lg text-red-400 font-bold">❌</span>
            <span className="flex-1 text-sm text-red-100 group-hover:text-white transition">
              {issue.label}
            </span>
            <span className="text-xs font-medium text-red-400 bg-red-900/50 px-2 py-1 rounded">
              {issue.status === 'missing' ? 'Missing' : 'Weak'}
            </span>
          </div>
        ))}
      </div>

      {/* Action Button */}
      <div className="flex gap-2">
        <button
          onClick={() => setIsExpanded(false)}
          className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg font-medium transition"
        >
          Dismiss
        </button>
        <button
          onClick={() => {
            // Scroll to profile settings or trigger update flow
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition"
        >
          Update Profile
        </button>
      </div>
    </div>
  );
};

export default ResumeQualityAlert;

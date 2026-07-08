import type { AuthSession, UserProfile } from "../../lib/types";

interface ProfileSummaryProps {
  session: AuthSession;
  profile: UserProfile | null;
}

export function ProfileSummary({ session, profile }: ProfileSummaryProps) {
  if (!profile) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-3 mb-3">
        <div className="text-sm text-gray-500">No profile loaded</div>
      </div>
    );
  }

  const skillsCount = profile.skills?.length || 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 mb-3 space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Signed in</span>
        <span className="font-medium truncate ml-2">{session.userId}</span>
      </div>
      {profile.name && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Name</span>
          <span className="font-medium">{profile.name}</span>
        </div>
      )}
      {profile.currentRole && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Role</span>
          <span className="font-medium">{profile.currentRole}</span>
        </div>
      )}
      {skillsCount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Skills</span>
          <span className="font-medium">{skillsCount} listed</span>
        </div>
      )}
    </div>
  );
}

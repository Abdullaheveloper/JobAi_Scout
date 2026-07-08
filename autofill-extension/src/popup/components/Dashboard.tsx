import type { AuthSession, UserProfile } from "../../lib/types";

interface AuthState {
  session: AuthSession | null;
  profile: UserProfile | null;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

export function Dashboard({ auth }: { auth: AuthState }) {
  const { session, profile, refreshProfile, logout } = auth;
  if (!session) return null;

  return (
    <>
      {/* Profile Card */}
      <div className="card">
        <div className="row">
          <span>Signed in</span>
          <span>{session.userId}</span>
        </div>
        {profile?.name && (
          <div className="row">
            <span>Name</span>
            <span>{profile.name}</span>
          </div>
        )}
        {profile?.skills && profile.skills.length > 0 && (
          <div className="row">
            <span>Skills</span>
            <span title={profile.skills.join(", ")}>
              {profile.skills.length} listed
            </span>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="stats">
        <div className="stat-card">
          <div className="stat-num">0</div>
          <div className="stat-label">Jobs Scanned</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">0</div>
          <div className="stat-label">Jobs Matched</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">0</div>
          <div className="stat-label">Jobs Synced</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">0</div>
          <div className="stat-label">Saved Jobs</div>
        </div>
      </div>

      {/* Extension Status */}
      <div className="card">
        <h3>Extension Status</h3>
        <div className="row">
          <span>Status</span>
          <span>Connected</span>
        </div>
        <div className="row">
          <span>Last Scan</span>
          <span>Never</span>
        </div>
        <div className="row">
          <span>Avg Match</span>
          <span>-</span>
        </div>
      </div>

      {/* Buttons */}
      <button
        className="gradient-btn"
        onClick={() => {
          chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            if (tab?.id) {
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["src/content/index.js"],
              });
            }
          });
        }}
      >
        Scrape Job
      </button>
      <button className="secondary" onClick={refreshProfile} style={{ marginTop: 8 }}>
        Refresh Profile
      </button>
      <button className="danger" onClick={logout} style={{ marginTop: 8 }}>
        Sign out
      </button>
    </>
  );
}

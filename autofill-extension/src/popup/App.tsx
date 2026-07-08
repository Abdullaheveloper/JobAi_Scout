import { useState } from "react";
import { useAuth } from "./store/authStore";
import { LoginForm } from "./components/LoginForm";

export function App() {
  const auth = useAuth();
  const [result, setResult] = useState<{
    filled: number;
    skipped: number;
  } | null>(null);
  const [filling, setFilling] = useState(false);

  const handleFill = async () => {
    setFilling(true);
    setResult(null);
    try {
      const response = await chrome.runtime.sendMessage({
        type: "FILL_CURRENT_TAB",
      });
      if (response?.ok) {
        setResult({
          filled: response.filledCount || 0,
          skipped: response.skippedCount || 0,
        });
      }
    } catch (e) {
      console.error("Fill failed:", e);
    } finally {
      setFilling(false);
    }
  };

  const handleRefreshProfile = async () => {
    await auth.refreshProfile();
  };

  // Loading
  if (auth.loading) {
    return (
      <div>
        <Header />
        <div className="loading-area">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!auth.session) {
    return (
      <div>
        <Header />
        <LoginForm onLogin={auth.login} error={auth.error} loading={auth.loading} />
      </div>
    );
  }

  // Logged in
  return (
    <div>
      <Header />

      <div className="content">
        {/* Profile Card */}
        <div className="card">
          <h3>Your Profile</h3>
          <div className="row">
            <span>Signed in</span>
            <span>{auth.session.userId}</span>
          </div>
          {auth.profile?.name && (
            <div className="row">
              <span>Name</span>
              <span>{auth.profile.name}</span>
            </div>
          )}
          {auth.profile?.email && (
            <div className="row">
              <span>Email</span>
              <span>{auth.profile.email}</span>
            </div>
          )}
          {auth.profile?.phone && (
            <div className="row">
              <span>Phone</span>
              <span>{auth.profile.phone}</span>
            </div>
          )}
          {auth.profile?.skills && auth.profile.skills.length > 0 && (
            <div className="row">
              <span>Skills</span>
              <span title={auth.profile.skills.join(", ")}>
                {auth.profile.skills.length} listed
              </span>
            </div>
          )}
        </div>

        {/* Autofill Button */}
        <button
          className="autofill-btn"
          onClick={handleFill}
          disabled={filling}
        >
          {filling ? (
            <>
              <span className="spinner-btn" />
              Filling...
            </>
          ) : (
            "Autofill This Page"
          )}
        </button>

        {/* Result */}
        {result && (
          <div className="result-card">
            <div className="result-row">
              <span className="result-filled">{result.filled} filled</span>
              {result.skipped > 0 && (
                <>
                  <span className="result-dot">·</span>
                  <span className="result-skipped">{result.skipped} skipped</span>
                </>
              )}
            </div>
            <p className="result-hint">
              {result.skipped > 0
                ? "Skipped fields have no data in your profile"
                : "All matching fields filled successfully"}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="actions">
          <button className="secondary" onClick={handleRefreshProfile}>
            Refresh Profile
          </button>
          <button className="danger" onClick={auth.logout}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <h1 className="header">
      <span className="dot" />
      JobAI Scout
    </h1>
  );
}

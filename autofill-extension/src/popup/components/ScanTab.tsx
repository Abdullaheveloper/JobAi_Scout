import { useState } from "react";
import type { AuthSession, UserProfile } from "../../lib/types";

interface AuthState {
  session: AuthSession | null;
  profile: UserProfile | null;
}

export function ScanTab({ auth }: { auth: AuthState }) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ scanned: number; matched: number; synced: number } | null>(null);

  const handleScan = async () => {
    setScanning(true);
    setResult(null);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      // Inject content script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/content/index.js"],
      });

      await new Promise((r) => setTimeout(r, 300));

      // Scan fields
      const response = await chrome.tabs.sendMessage(tab.id, { type: "SCAN_FIELDS" });
      if (response?.ok) {
        setResult({
          scanned: response.total || 0,
          matched: response.fields?.length || 0,
          synced: 0,
        });
      }
    } catch (e) {
      console.error("Scan failed:", e);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="scan-area">
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
        Visit a job portal, then click to scan
      </p>

      <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, margin: "12px 0", cursor: "pointer", fontWeight: 500 }}>
        <input type="checkbox" defaultChecked style={{ width: "auto", margin: 0 }} />
        Use My Job Scout AI Profile
      </label>

      {/* Profile Summary */}
      {auth.profile && (
        <div className="card" style={{ textAlign: "left", marginBottom: 12 }}>
          <h3 style={{ fontSize: 12, color: "#3b82f6" }}>Profile Summary</h3>
          <div className="row">
            <span>Desired Role</span>
            <span>{auth.profile.currentRole || "-"}</span>
          </div>
          <div className="row">
            <span>Skills</span>
            <span style={{ whiteSpace: "normal", textAlign: "right" }}>
              {auth.profile.skills?.join(", ") || "-"}
            </span>
          </div>
          <div className="row">
            <span>Preferred Location</span>
            <span>{auth.profile.city || "-"}</span>
          </div>
          <div className="row">
            <span>Experience</span>
            <span>{auth.profile.experienceYears || "-"} years</span>
          </div>
        </div>
      )}

      {/* Scan Button */}
      <button className="scan-btn" onClick={handleScan} disabled={scanning}>
        <span className={`icon ${scanning ? "scanning" : ""}`}>&#128270;</span>
        <span>{scanning ? "Scanning..." : "Scrape Jobs"}</span>
      </button>

      <p style={{ fontSize: 12, color: "#6b7280", marginTop: 12 }}>
        No portal detected
      </p>

      {/* Result */}
      {result && (
        <div className="scan-result">
          <h3>Scan Result</h3>
          <div className="scan-stats">
            <div className="scan-stat">
              <div className="num">{result.scanned}</div>
              <div className="lbl">Scanned</div>
            </div>
            <div className="scan-stat">
              <div className="num">{result.matched}</div>
              <div className="lbl">Matched</div>
            </div>
            <div className="scan-stat">
              <div className="num">{result.synced}</div>
              <div className="lbl">Uploaded</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

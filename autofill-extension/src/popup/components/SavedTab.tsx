export function SavedTab({ auth }: { auth: any }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Saved Jobs</h3>
        <span className="badge badge-green">0 saved</span>
      </div>
      <div className="scroll-list">
        <div className="empty">
          <div className="icon">&#128278;</div>
          <p>
            No saved jobs yet.
            <br />
            Save jobs from the Jobs tab.
          </p>
        </div>
      </div>
    </>
  );
}

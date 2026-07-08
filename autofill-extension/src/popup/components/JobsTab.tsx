export function JobsTab({ auth }: { auth: any }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Recommended Jobs</h3>
        <span className="badge badge-blue">0 jobs</span>
      </div>
      <div className="scroll-list">
        <div className="empty">
          <div className="icon">&#128188;</div>
          <p>
            No recommended jobs yet.
            <br />
            Scan a job portal to get started!
          </p>
        </div>
      </div>
    </>
  );
}

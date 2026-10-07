import { ScrollText, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
export function AuditView({ runId }: { runId: string }) {
  const [audit, setAudit] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api(`runs/${runId}/audit`)
      .then(setAudit)
      .catch((e) => setError(e.message));
  }, [runId]);
  return (
    <>
      {error && <div className="error-banner">{error}</div>}
      <div className={"audit-banner " + (audit?.valid ? "verified" : "")}>
        <ShieldCheck size={30} />
        <div>
          <h2>
            {audit
              ? audit.valid
                ? "Audit chain verified"
                : "Integrity check failed"
              : "Verifying audit chain…"}
          </h2>
          <p>
            {audit?.records.length ?? 0} decisions · linked hashes and versions
            checked
          </p>
          <small className="muted">
            Tamper evidence assumes a trusted stored head; the chain is not
            externally anchored.
          </small>
        </div>
        <span className="count-pill">{audit?.valid ? "PASS" : "CHECK"}</span>
      </div>
      <div className="panel">
        <div className="panel-heading">
          <h2>Decision history</h2>
          <span
            className="muted small-text"
            title="Saved decisions are not edited in place"
          >
            New decisions are added to history
          </span>
        </div>
        {audit?.records.length ? (
          <div className="audit-list">
            {audit.records.map((r: any) => (
              <div className="audit-entry" key={r.id}>
                <div className="audit-sequence">{r.sequence}</div>
                <div>
                  <div className="audit-entry-top">
                    <strong className="mono">
                      {r.incident_id.toUpperCase()}
                    </strong>
                    <span className={"status " + r.disposition}>
                      {r.disposition.replaceAll("_", " ")}
                    </span>
                    <span className="muted small-text">
                      {new Date(r.timestamp).toLocaleString("en-GB", {
                        timeZone: "UTC",
                      })}{" "}
                      UTC
                    </span>
                  </div>
                  <p>{r.reason}</p>
                  <div className="hash-line">
                    <span title="A cryptographic fingerprint used to reveal edits">
                      Integrity fingerprint
                    </span>
                    <code>{r.hash}</code>
                  </div>
                  <small className="muted">
                    Actor: {r.actor} · Incident version {r.version}
                  </small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">
            <ScrollText size={30} />
            <strong>No decisions recorded yet</strong>
            <span>
              Open an incident and record an investigation, escalation, or
              false-positive decision.
            </span>
          </div>
        )}
      </div>
    </>
  );
}

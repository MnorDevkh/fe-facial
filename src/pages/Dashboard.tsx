import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getHealth } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import type { HealthResponse } from "../types";
import { ApiError } from "../types";

export default function Dashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getHealth();
        if (active) setHealth(data);
      } catch (err) {
        if (active) {
          setError(err instanceof ApiError ? err.message : "Could not reach API.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <header className="page-header">
        <h2>Dashboard</h2>
        <p>System status and quick workflow guide for the facial attendance pipeline.</p>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3 className="card-title">System status</h3>
        {loading ? (
          <p className="empty-state">Loading…</p>
        ) : health ? (
          <>
            <div className="grid-2">
              <div className="stat-card">
                <div className="stat-label">API</div>
                <div className={`stat-value ${health.status === "ok" ? "ok" : "bad"}`}>
                  {health.status.toUpperCase()}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Face model</div>
                <div className={`stat-value ${health.model_ready ? "ok" : "warn"}`}>
                  {health.model_ready ? "Trained" : "Not trained"}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Registered people</div>
                <div className="stat-value">{health.registered_people}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Database</div>
                <div
                  className={`stat-value ${
                    health.database_ready === false
                      ? "bad"
                      : health.database_ready
                        ? "ok"
                        : "warn"
                  }`}
                  style={{ fontSize: "1.1rem" }}
                >
                  {health.database_ready === null
                    ? "Not configured"
                    : health.database_ready
                      ? "Connected"
                      : "Unavailable"}
                </div>
              </div>
            </div>
            <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <StatusBadge ready={health.database_ready === true} label="Database" />
              <StatusBadge ready={health.model_ready} label="Encodings" />
            </div>
          </>
        ) : null}
      </div>

      <div className="card">
        <h3 className="card-title">Workflow</h3>
        <div className="workflow-steps">
          <div className="workflow-step">
            <div className="step-num">1</div>
            <h4>Register people</h4>
            <p>Add names and optional student IDs to the database.</p>
            <Link to="/people" className="btn btn-secondary" style={{ marginTop: "0.75rem" }}>
              Go to People
            </Link>
          </div>
          <div className="workflow-step">
            <div className="step-num">2</div>
            <h4>Upload & train</h4>
            <p>Upload face images per person, then rebuild encodings.</p>
            <Link to="/dataset" className="btn btn-secondary" style={{ marginTop: "0.75rem" }}>
              Go to Dataset
            </Link>
          </div>
          <div className="workflow-step">
            <div className="step-num">3</div>
            <h4>Recognize</h4>
            <p>Upload an image or video, or use your webcam to identify faces.</p>
            <Link to="/recognize" className="btn btn-secondary" style={{ marginTop: "0.75rem" }}>
              Go to Recognize
            </Link>
          </div>
          <div className="workflow-step">
            <div className="step-num">4</div>
            <h4>Check in</h4>
            <p>Verify recognition results and submit to record daily attendance.</p>
            <Link to="/attendance" className="btn btn-secondary" style={{ marginTop: "0.75rem" }}>
              Go to Attendance
            </Link>
          </div>
          <div className="workflow-step">
            <div className="step-num">5</div>
            <h4>View records</h4>
            <p>Browse attendance history with full student profile details.</p>
            <Link to="/view-attendance?view=day" className="btn btn-secondary" style={{ marginTop: "0.75rem" }}>
              View Records
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

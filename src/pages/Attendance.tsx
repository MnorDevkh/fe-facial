import { FormEvent, useEffect, useMemo, useState } from "react";
import { faceDisplayName, faceListSecondaryLabel } from "../utils/faceDisplay";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import {
  checkInAttendance,
  listClasses,
  listPeople,
  listShifts,
  recognizeImage,
  recognizeVideo,
} from "../api/client";
import FaceOverlay from "../components/FaceOverlay";
import { AttendanceStatusBadge } from "../components/StatusBadge";
import WebcamCapture from "../components/WebcamCapture";
import { aggregateVideoFaces, keysForFaces, selectionKey } from "../utils/recognition";
import {
  FALLBACK_SHIFT_LABELS,
  formatClassItem,
  parseClassIdsParam,
  personClassLabel,
  personInSelectedClasses,
  serializeClassIds,
  shiftLabel,
} from "../utils/attendance";
import type {
  AttendanceCheckInItemResult,
  AttendanceCheckInResponse,
  ClassDetail,
  FaceResult,
  Person,
  RecognizeImageResponse,
  RecognizeVideoResponse,
} from "../types";
import { ApiError } from "../types";

interface LocationState {
  faces?: FaceResult[];
}

interface ManualEntry {
  id: number;
  studentId: string;
  confidence: string;
}

type Mode = "image" | "video" | "webcam";

let entryId = 0;

export default function Attendance() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = location.state as LocationState | null;

  if (searchParams.get("tab") === "records") {
    const params = new URLSearchParams(searchParams);
    params.delete("tab");
    const query = params.toString();
    return <Navigate to={query ? `/view-attendance?${query}` : "/view-attendance"} replace />;
  }

  return (
    <>
      <header className="page-header">
        <h2>Check-in</h2>
        <p>
          Upload an image or video, or use your webcam to recognize faces. Verify the results,
          then save attendance. To browse records, go to{" "}
          <Link to="/view-attendance">View Attendance</Link>.
        </p>
      </header>

      <CheckInTab faces={state?.faces ?? []} />
    </>
  );
}

function CheckInTab({ faces }: { faces: FaceResult[] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionShift = searchParams.get("shift") ?? "morning";
  const classesParam = searchParams.get("classes") ?? "";
  const sessionClassIds = useMemo(() => parseClassIdsParam(classesParam || null), [classesParam]);

  const [people, setPeople] = useState<Person[]>([]);
  const [availableClasses, setAvailableClasses] = useState<ClassDetail[]>([]);
  const [shiftLabels, setShiftLabels] = useState<Record<string, string>>(FALLBACK_SHIFT_LABELS);
  const [entries, setEntries] = useState<ManualEntry[]>([
    { id: ++entryId, studentId: "", confidence: "" },
  ]);
  const [verifiedFaces, setVerifiedFaces] = useState<FaceResult[]>(faces);
  const [selectedFromRecognition, setSelectedFromRecognition] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AttendanceCheckInResponse | null>(null);

  const [mode, setMode] = useState<Mode>("image");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageResult, setImageResult] = useState<RecognizeImageResponse | null>(null);
  const [videoResult, setVideoResult] = useState<RecognizeVideoResponse | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [recognizeError, setRecognizeError] = useState<string | null>(null);

  useEffect(() => {
    listPeople()
      .then((data) => setPeople(data.people))
      .catch(() => setPeople([]));
    listClasses()
      .then((data) => setAvailableClasses(data.classes))
      .catch(() => setAvailableClasses([]));
    listShifts()
      .then((data) => setShiftLabels(data.labels))
      .catch(() => setShiftLabels(FALLBACK_SHIFT_LABELS));
  }, []);

  function updateSession(mutate: (params: URLSearchParams) => void) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        mutate(params);
        return params;
      },
      { replace: true },
    );
  }

  function setSessionShift(next: string) {
    updateSession((params) => {
      params.set("shift", next);
    });
  }

  function toggleSessionClass(classId: number) {
    updateSession((params) => {
      const current = parseClassIdsParam(params.get("classes"));
      const next = current.includes(classId)
        ? current.filter((id) => id !== classId)
        : [...current, classId];
      if (next.length) params.set("classes", serializeClassIds(next));
      else params.delete("classes");
    });
  }

  useEffect(() => {
    if (faces.length > 0) {
      setVerifiedFaces(faces);
      setSelectedFromRecognition(keysForFaces(faces));
    }
  }, [faces]);

  useEffect(() => {
    if (!imageResult) return;
    setVerifiedFaces(imageResult.results);
    setSelectedFromRecognition(keysForFaces(imageResult.results));
  }, [imageResult]);

  useEffect(() => {
    if (!videoResult) return;
    const aggregated = aggregateVideoFaces(videoResult.frame_results);
    setVerifiedFaces(aggregated);
    setSelectedFromRecognition(keysForFaces(aggregated));
  }, [videoResult]);

  const peopleByStudentId = new Map(
    people.flatMap((p) => {
      const keys: [string, Person][] = [];
      if (p.student_id) keys.push([p.student_id.toLowerCase(), p]);
      keys.push([String(p.id), p]);
      return keys;
    }),
  );

  const imageFaces: FaceResult[] = imageResult?.results ?? [];
  const videoAggregatedFaces = videoResult
    ? aggregateVideoFaces(videoResult.frame_results)
    : [];
  const hasInlineRecognition = imageResult !== null || videoResult !== null;

  function resetRecognitionResults() {
    setImageResult(null);
    setVideoResult(null);
    setRecognizeError(null);
  }

  function handleFileChange(selected: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    resetRecognitionResults();
    if (selected && selected.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(selected));
    } else {
      setPreviewUrl(null);
    }
  }

  function handleModeChange(nextMode: Mode) {
    setMode(nextMode);
    handleFileChange(null);
    resetRecognitionResults();
  }

  async function runImageRecognition(imageFile: File) {
    setRecognizing(true);
    resetRecognitionResults();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(imageFile));
    try {
      const recognitionResult = await recognizeImage(imageFile);
      setImageResult(recognitionResult);
    } catch (err) {
      setRecognizeError(err instanceof ApiError ? err.message : "Recognition failed.");
    } finally {
      setRecognizing(false);
    }
  }

  async function handleRecognize() {
    if (!file || mode === "webcam") return;
    setRecognizing(true);
    resetRecognitionResults();
    try {
      if (mode === "image") {
        const recognitionResult = await recognizeImage(file);
        setImageResult(recognitionResult);
      } else {
        const recognitionResult = await recognizeVideo(file);
        setVideoResult(recognitionResult);
      }
    } catch (err) {
      setRecognizeError(err instanceof ApiError ? err.message : "Recognition failed.");
    } finally {
      setRecognizing(false);
    }
  }

  async function handleWebcamCapture(captured: File) {
    setFile(captured);
    await runImageRecognition(captured);
  }

  function addManualEntry() {
    setEntries((prev) => [...prev, { id: ++entryId, studentId: "", confidence: "" }]);
  }

  function updateEntry(id: number, field: "studentId" | "confidence", value: string) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  }

  function removeEntry(id: number) {
    setEntries((prev) => (prev.length > 1 ? prev.filter((e) => e.id !== id) : prev));
  }

  function toggleRecognitionFace(key: string) {
    setSelectedFromRecognition((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    const batch: { student_id: string; confidence: number }[] = [];

    for (const key of selectedFromRecognition) {
      const [studentId, conf] = key.split("|");
      batch.push({ student_id: studentId, confidence: parseFloat(conf) });
    }

    for (const entry of entries) {
      const studentId = entry.studentId.trim();
      const confidence = parseFloat(entry.confidence);
      if (studentId && !Number.isNaN(confidence)) {
        batch.push({ student_id: studentId, confidence });
      }
    }

    if (batch.length === 0) {
      setError("Add at least one student to check in.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await checkInAttendance(batch, {
        shift: sessionShift,
        classIds: sessionClassIds,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Check-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {recognizeError && <div className="alert alert-error">{recognizeError}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card session-bar">
        <h3 className="card-title">Session</h3>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="session-shift">Shift</label>
            <select
              id="session-shift"
              value={sessionShift}
              onChange={(e) => setSessionShift(e.target.value)}
            >
              {Object.entries(shiftLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Classes in session</label>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "0 0 0.5rem" }}>
            Leave all unchecked to allow any registered student. Select one or more to restrict
            check-in to those classes.
          </p>
          {availableClasses.length === 0 ? (
            <p className="empty-state" style={{ margin: 0 }}>
              No classes defined. <Link to="/classes">Manage classes</Link>
            </p>
          ) : (
            <div className="class-multi-select">
              {availableClasses.map((item) => (
                <label key={item.id} className="class-chip-option">
                  <input
                    type="checkbox"
                    checked={sessionClassIds.includes(item.id)}
                    onChange={() => toggleSessionClass(item.id)}
                  />
                  <span>{formatClassItem(item)}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Recognize faces</h3>
        <div className="form-row" style={{ marginBottom: "1rem" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="checkin-mode">Media type</label>
            <select
              id="checkin-mode"
              value={mode}
              onChange={(e) => handleModeChange(e.target.value as Mode)}
              disabled={recognizing}
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="webcam">Webcam</option>
            </select>
          </div>
        </div>

        {mode === "webcam" ? (
          <WebcamCapture onCapture={handleWebcamCapture} disabled={recognizing} />
        ) : (
          <>
            <label className="dropzone">
              <input
                type="file"
                accept={mode === "image" ? "image/*" : "video/*"}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                disabled={recognizing}
              />
              <div className="dropzone-icon">{mode === "image" ? "🖼️" : "🎬"}</div>
              <p>
                <strong>Upload {mode}</strong> to recognize faces
              </p>
              <p>{file ? file.name : "JPG, PNG, BMP or MP4, AVI, MOV, MKV"}</p>
            </label>

            <div className="actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRecognize}
                disabled={!file || recognizing}
              >
                {recognizing && <span className="spinner" />}
                Run recognition
              </button>
            </div>
          </>
        )}

        {recognizing && (
          <p className="empty-state" style={{ marginTop: "1rem", marginBottom: 0 }}>
            Recognizing… please wait
          </p>
        )}
      </div>

      {hasInlineRecognition && mode !== "video" && previewUrl && imageFaces.length > 0 && (
        <div className="card">
          <h3 className="card-title">Annotated preview</h3>
          <FaceOverlay imageUrl={previewUrl} faces={imageFaces} />
        </div>
      )}

      {videoResult && (
        <div className="card">
          <h3 className="card-title">Video recognition</h3>
          <div className="grid-2" style={{ marginBottom: "1rem" }}>
            <div className="stat-card">
              <div className="stat-label">Frames processed</div>
              <div className="stat-value">{videoResult.frames_processed}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Faces detected</div>
              <div className="stat-value ok">{videoResult.faces_detected}</div>
            </div>
          </div>
          {videoResult.unique_student_ids.length > 0 && (
            <p style={{ marginBottom: "1rem" }}>
              <strong>Unique student IDs:</strong> {videoResult.unique_student_ids.join(", ")}
            </p>
          )}
          {videoAggregatedFaces.length > 0 && (
            <>
              <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>Best match per student</h4>
              <FaceResultList faces={videoAggregatedFaces} />
            </>
          )}
          {videoResult.frame_results.map((frame) => (
            <div key={frame.frame} style={{ marginBottom: "1.25rem", marginTop: "1.25rem" }}>
              <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                Frame {frame.frame} — {frame.faces_detected} face(s)
              </h4>
              <FaceResultList faces={frame.results} compact />
            </div>
          ))}
        </div>
      )}

      {hasInlineRecognition && imageResult && (
        <div className="card">
          <h3 className="card-title">
            Recognition — {imageResult.faces_detected} face(s) detected
          </h3>
          <FaceResultList faces={imageResult.results} />
        </div>
      )}

      {(verifiedFaces.length > 0 || hasInlineRecognition) && (
        <div className="card">
          <h3 className="card-title">Verify results</h3>
          {verifiedFaces.length === 0 ? (
            <p className="empty-state">No faces detected. Try another image or video.</p>
          ) : (
            <div className="face-list">
              {verifiedFaces.map((face) => {
                const key = selectionKey(face) ?? `${face.name}|${face.confidence}`;
                const person = face.student_id
                  ? peopleByStudentId.get(face.student_id.toLowerCase())
                  : undefined;
                const canCheckIn = face.student_id !== null;
                return (
                  <div className="face-item" key={key}>
                    <label>
                      <input
                        type="checkbox"
                        checked={canCheckIn && selectedFromRecognition.has(key)}
                        onChange={() => toggleRecognitionFace(key)}
                        disabled={recognizing || !canCheckIn}
                      />
                      <span>
                        <strong>{faceDisplayName(face)}</strong>
                        {faceListSecondaryLabel(face) && (
                          <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                            {faceListSecondaryLabel(face)}
                          </span>
                        )}
                        <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                          {face.confidence.toFixed(1)}% confidence
                        </span>
                        {person && (
                          <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                            · {personClassLabel(person)}
                          </span>
                        )}
                        {person && sessionClassIds.length > 0 && !personInSelectedClasses(person, sessionClassIds) && (
                          <span className="status-absent" style={{ marginLeft: "0.5rem" }}>
                            not in selected classes
                          </span>
                        )}
                        {!canCheckIn && (
                          <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                            · cannot check in
                          </span>
                        )}
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3 className="card-title">Save to attendance</h3>
        <form onSubmit={handleSubmit}>
          <p style={{ color: "var(--text-muted)", marginBottom: "1rem", fontSize: "0.9rem" }}>
            Optionally add manual student ID entries below, then save selected students for the{" "}
            <strong>{shiftLabel(sessionShift, shiftLabels)}</strong> shift
            {sessionClassIds.length > 0 ? " (selected classes only)" : ""}.
          </p>
          {entries.map((entry) => (
            <div className="form-row" key={entry.id} style={{ alignItems: "end" }}>
              <div className="form-group">
                <label>Student ID</label>
                <input
                  value={entry.studentId}
                  onChange={(e) => updateEntry(entry.id, "studentId", e.target.value)}
                  placeholder="STU001"
                  disabled={recognizing}
                />
              </div>
              <div className="form-group">
                <label>Confidence (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={entry.confidence}
                  onChange={(e) => updateEntry(entry.id, "confidence", e.target.value)}
                  placeholder="92.5"
                  disabled={recognizing}
                />
              </div>
              <div className="form-group" style={{ flex: "0 0 auto" }}>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => removeEntry(entry.id)}
                  aria-label="Remove entry"
                  disabled={recognizing}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          <div className="actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={addManualEntry}
              disabled={recognizing}
            >
              Add row
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || recognizing}
            >
              {submitting && <span className="spinner" />}
              Check in selected
            </button>
          </div>
        </form>
      </div>

      {result && (
        <div className="card">
          <h3 className="card-title">
            Check-in results — {result.date} · {shiftLabel(result.shift, shiftLabels)}
          </h3>
          <div className="grid-2" style={{ marginBottom: "1rem" }}>
            <div className="stat-card">
              <div className="stat-label">Total</div>
              <div className="stat-value">{result.total}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Marked</div>
              <div className="stat-value ok">{result.marked}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Skipped</div>
              <div className="stat-value warn">{result.skipped}</div>
            </div>
          </div>
          <ResultTable results={result.results} />
          <p style={{ marginTop: "1rem", marginBottom: 0 }}>
            <Link
              to={`/view-attendance?view=day&date=${result.date}&shift=${result.shift}`}
              className="btn btn-secondary"
            >
              View today&apos;s attendance
            </Link>
          </p>
        </div>
      )}
    </>
  );
}

function FaceResultList({ faces, compact }: { faces: FaceResult[]; compact?: boolean }) {
  if (faces.length === 0) {
    return <p className="empty-state">No faces in this result.</p>;
  }
  return (
    <div className="face-list">
      {faces.map((face, index) => (
        <div className="face-item" key={`${face.student_id ?? face.name}-${index}`}>
          <div>
            <strong>{faceDisplayName(face)}</strong>
            {faceListSecondaryLabel(face) && (
              <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem", fontSize: "0.85rem" }}>
                {faceListSecondaryLabel(face)}
              </span>
            )}
            {!compact && face.distance !== null && (
              <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem", fontSize: "0.85rem" }}>
                distance {face.distance.toFixed(3)}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div className="confidence-bar">
              <div
                className="confidence-fill"
                style={{ width: `${Math.min(100, face.confidence)}%` }}
              />
            </div>
            <span className="mono" style={{ fontSize: "0.85rem" }}>
              {face.confidence.toFixed(1)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultTable({ results }: { results: AttendanceCheckInItemResult[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Student ID</th>
            <th>Confidence</th>
            <th>Status</th>
            <th>Time</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {results.map((row) => (
            <tr key={`${row.name}-${row.status}`}>
              <td>{row.name}</td>
              <td className="mono">{row.student_id ?? "—"}</td>
              <td>{row.confidence.toFixed(1)}%</td>
              <td>
                <AttendanceStatusBadge status={row.status} />
              </td>
              <td className="mono">{row.time ?? "—"}</td>
              <td>{row.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

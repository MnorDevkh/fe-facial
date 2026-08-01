import { FormEvent, useCallback, useEffect, useState } from "react";
import { listPeople, trainModel, uploadDataset } from "../api/client";
import type { Person, TrainResponse } from "../types";
import { ApiError } from "../types";

export default function Dataset() {
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [uploadMode, setUploadMode] = useState<"zip" | "images">("images");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [training, setTraining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [trainResult, setTrainResult] = useState<TrainResponse | null>(null);

  const eligiblePeople = people.filter((person) => person.student_id);

  const loadPeople = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPeople();
      setPeople(data.people);
      const withStudentId = data.people.filter((person) => person.student_id);
      if (withStudentId.length) {
        setSelectedStudentId((current) => current || withStudentId[0].student_id!);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load people.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  function handleFileChange(fileList: FileList | null) {
    if (!fileList) return;
    setFiles(Array.from(fileList));
  }

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (!selectedStudentId || files.length === 0) return;

    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await uploadDataset({
        studentId: selectedStudentId,
        zipFile: uploadMode === "zip" ? files[0] : undefined,
        images: uploadMode === "images" ? files : undefined,
      });
      setSuccess(
        `Saved ${result.images_saved} image(s) for ${result.person} in ${result.dataset_dir}.`,
      );
      setFiles([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleTrain() {
    setTraining(true);
    setError(null);
    setTrainResult(null);
    try {
      const result = await trainModel();
      setTrainResult(result);
      setSuccess(
        `Training complete: ${result.people_encoded} people, ${result.total_encodings} encodings.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Training failed.");
    } finally {
      setTraining(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <h2>Dataset & Train</h2>
        <p>Upload face images by student ID, then rebuild the recognition model.</p>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <h3 className="card-title">Upload face images</h3>
        {loading ? (
          <p className="empty-state">Loading people…</p>
        ) : eligiblePeople.length === 0 ? (
          <div className="alert alert-info">
            Register at least one person with a student ID before uploading images.
          </div>
        ) : (
          <form onSubmit={handleUpload}>
            <div className="form-group">
              <label htmlFor="person">Person (by student ID)</label>
              <select
                id="person"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                required
              >
                {eligiblePeople.map((person) => (
                  <option key={person.id} value={person.student_id!}>
                    {person.name} ({person.student_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="upload_mode">Upload type</label>
              <select
                id="upload_mode"
                value={uploadMode}
                onChange={(e) => {
                  setUploadMode(e.target.value as "zip" | "images");
                  setFiles([]);
                }}
              >
                <option value="images">Individual images</option>
                <option value="zip">ZIP archive</option>
              </select>
            </div>

            <label className="dropzone">
              <input
                type="file"
                accept={uploadMode === "zip" ? ".zip" : "image/*"}
                multiple={uploadMode === "images"}
                onChange={(e) => handleFileChange(e.target.files)}
              />
              <div className="dropzone-icon">📁</div>
              <p>
                <strong>Click to browse</strong> or drag files here
              </p>
              <p>
                {uploadMode === "zip"
                  ? "One ZIP file with face images"
                  : "One or more JPG, PNG, or BMP images"}
              </p>
              {files.length > 0 && (
                <p style={{ color: "var(--accent)" }}>
                  {files.length} file(s) selected: {files.map((f) => f.name).join(", ")}
                </p>
              )}
            </label>

            <div className="actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={uploading || files.length === 0}
              >
                {uploading && <span className="spinner" />}
                Upload images
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">Train model</h3>
        <p style={{ color: "var(--text-muted)", margin: "0 0 1rem", fontSize: "0.9rem" }}>
          Rebuild <span className="mono">known_faces.pkl</span> from all images in the dataset
          folder. Encodings are keyed by student ID. Run this after every upload.
        </p>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={handleTrain} disabled={training}>
            {training && <span className="spinner" />}
            Train encodings
          </button>
        </div>
        {trainResult && (
          <div className="grid-2" style={{ marginTop: "1.25rem" }}>
            <div className="stat-card">
              <div className="stat-label">People encoded</div>
              <div className="stat-value ok">{trainResult.people_encoded}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total encodings</div>
              <div className="stat-value">{trainResult.total_encodings}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Skipped images</div>
              <div className="stat-value warn">{trainResult.skipped_images}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Student IDs</div>
              <div style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>
                {trainResult.people.join(", ") || "—"}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

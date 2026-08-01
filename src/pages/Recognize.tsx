import { useState } from "react";
import { Link } from "react-router-dom";
import { recognizeImage, recognizeVideo } from "../api/client";
import FaceOverlay from "../components/FaceOverlay";
import WebcamCapture from "../components/WebcamCapture";
import { aggregateVideoFaces, selectableFaces } from "../utils/recognition";
import { faceDisplayName, faceListSecondaryLabel } from "../utils/faceDisplay";
import type { FaceResult, RecognizeImageResponse, RecognizeVideoResponse } from "../types";
import { ApiError } from "../types";

type Mode = "image" | "video" | "webcam";

export default function Recognize() {
  const [mode, setMode] = useState<Mode>("image");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageResult, setImageResult] = useState<RecognizeImageResponse | null>(null);
  const [videoResult, setVideoResult] = useState<RecognizeVideoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetResults() {
    setImageResult(null);
    setVideoResult(null);
    setError(null);
  }

  function handleFileChange(selected: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    resetResults();
    if (selected && selected.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(selected));
    } else {
      setPreviewUrl(null);
    }
  }

  function handleModeChange(nextMode: Mode) {
    setMode(nextMode);
    handleFileChange(null);
    resetResults();
  }

  async function runImageRecognition(imageFile: File) {
    setLoading(true);
    resetResults();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(imageFile));
    try {
      const result = await recognizeImage(imageFile);
      setImageResult(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Recognition failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecognize() {
    if (!file || mode === "webcam") return;
    setLoading(true);
    resetResults();
    try {
      if (mode === "image") {
        const result = await recognizeImage(file);
        setImageResult(result);
      } else {
        const result = await recognizeVideo(file);
        setVideoResult(result);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Recognition failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleWebcamCapture(captured: File) {
    setFile(captured);
    await runImageRecognition(captured);
  }

  const imageFaces: FaceResult[] = imageResult?.results ?? [];
  const videoAggregatedFaces = videoResult
    ? aggregateVideoFaces(videoResult.frame_results)
    : [];

  return (
    <>
      <header className="page-header">
        <h2>Recognize</h2>
        <p>
          Upload an image or video, or use your webcam to identify faces. Verify results on
          Check-in before attendance is recorded.
        </p>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="form-row" style={{ marginBottom: "1rem" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="mode">Media type</label>
            <select
              id="mode"
              value={mode}
              onChange={(e) => handleModeChange(e.target.value as Mode)}
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="webcam">Webcam</option>
            </select>
          </div>
        </div>

        {mode === "webcam" ? (
          <WebcamCapture onCapture={handleWebcamCapture} disabled={loading} />
        ) : (
          <>
            <label className="dropzone">
              <input
                type="file"
                accept={mode === "image" ? "image/*" : "video/*"}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
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
                disabled={!file || loading}
              >
                {loading && <span className="spinner" />}
                Run recognition
              </button>
            </div>
          </>
        )}
      </div>

      {mode !== "video" && previewUrl && imageFaces.length > 0 && (
        <div className="card">
          <h3 className="card-title">Annotated preview</h3>
          <FaceOverlay imageUrl={previewUrl} faces={imageFaces} />
        </div>
      )}

      {imageResult && (
        <div className="card">
          <h3 className="card-title">
            Results — {imageResult.faces_detected} face(s) detected
          </h3>
          <FaceResultList faces={imageResult.results} />
          {selectableFaces(imageResult.results).length > 0 && (
            <CheckInLink faces={imageResult.results} />
          )}
        </div>
      )}

      {videoResult && (
        <div className="card">
          <h3 className="card-title">Video results</h3>
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
              <CheckInLink faces={videoAggregatedFaces} />
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
    </>
  );
}

function CheckInLink({ faces }: { faces: FaceResult[] }) {
  return (
    <div className="alert alert-info" style={{ marginTop: "1rem", marginBottom: 0 }}>
      Ready to check in?{" "}
      <Link to="/attendance" state={{ faces }}>
        Go to Check-in
      </Link>{" "}
      with these results.
    </div>
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

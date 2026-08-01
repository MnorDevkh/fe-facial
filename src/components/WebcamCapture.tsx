import { useCallback, useEffect, useRef, useState } from "react";
import { recognizeImage } from "../api/client";
import { faceOverlayLabel } from "../utils/faceDisplay";
import { colorForFace } from "./FaceOverlay";
import type { FaceResult } from "../types";

interface WebcamCaptureProps {
  onCapture: (file: File) => void;
  disabled?: boolean;
}

type Facing = "user" | "environment";

/** Width of the downscaled frames sent to the API for live detection. */
const LIVE_FRAME_WIDTH = 480;
/** Pause between live detection requests, after the previous one finishes. */
const LIVE_INTERVAL_MS = 700;

export default function WebcamCapture({ onCapture, disabled }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<Facing>("user");
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [liveFaces, setLiveFaces] = useState<FaceResult[]>([]);
  const liveFrameSize = useRef<{ width: number; height: number } | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActive(false);
    setLiveFaces([]);
  }, []);

  const startStream = useCallback(
    async (facingMode: Facing) => {
      setError(null);
      stopStream();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setActive(true);
      } catch {
        setError("Camera access denied or unavailable. Check browser permissions.");
        setActive(false);
      }
    },
    [stopStream],
  );

  useEffect(() => {
    startStream(facing);
    return () => stopStream();
  }, [facing, startStream, stopStream]);

  function captureFrame(maxWidth?: number): Promise<Blob | null> {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return Promise.resolve(null);

    const scale = maxWidth ? Math.min(1, maxWidth / video.videoWidth) : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (maxWidth) {
      liveFrameSize.current = { width: canvas.width, height: canvas.height };
    }
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", maxWidth ? 0.8 : 0.92);
    });
  }

  // Live detection loop: send a downscaled frame, draw boxes, repeat.
  useEffect(() => {
    if (!active || !liveEnabled || disabled) {
      setLiveFaces([]);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      if (cancelled) return;
      try {
        const blob = await captureFrame(LIVE_FRAME_WIDTH);
        if (blob && !cancelled) {
          const file = new File([blob], "live.jpg", { type: "image/jpeg" });
          const result = await recognizeImage(file);
          if (!cancelled) setLiveFaces(result.results);
        }
      } catch {
        // Live detection is best-effort; keep the stream running on errors.
      }
      if (!cancelled) {
        timer = setTimeout(tick, LIVE_INTERVAL_MS);
      }
    }

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, liveEnabled, disabled]);

  // Draw the live face boxes on the overlay canvas.
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const frame = liveFrameSize.current;
    const width = frame?.width ?? canvas.width;
    const height = frame?.height ?? canvas.height;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    for (const face of liveFaces) {
      const { top, right, bottom, left } = face.bbox;
      const color = colorForFace(face);

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, Math.round(width / 240));
      ctx.strokeRect(left, top, right - left, bottom - top);

      const label = faceOverlayLabel(face);
      ctx.font = `600 ${Math.max(12, Math.round(width / 34))}px DM Sans, sans-serif`;
      const textWidth = ctx.measureText(label).width;
      const labelHeight = Math.max(18, Math.round(width / 30));
      const labelY = Math.max(top, labelHeight);

      ctx.fillStyle = color;
      ctx.fillRect(left, labelY - labelHeight, textWidth + 12, labelHeight);
      ctx.fillStyle = "#0c1117";
      ctx.fillText(label, left + 6, labelY - 5);
    }
  }, [liveFaces]);

  async function handleCapture() {
    if (!active) return;
    const blob = await captureFrame();
    if (!blob) return;
    onCapture(new File([blob], "webcam.jpg", { type: "image/jpeg" }));
  }

  return (
    <div className="webcam-capture">
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-row">
        <div className="form-group" style={{ margin: 0 }}>
          <label htmlFor="webcam-facing">Camera</label>
          <select
            id="webcam-facing"
            value={facing}
            onChange={(e) => setFacing(e.target.value as Facing)}
            disabled={disabled}
          >
            <option value="user">Front camera</option>
            <option value="environment">Back camera</option>
          </select>
        </div>
        <div className="form-group" style={{ margin: 0, alignSelf: "end" }}>
          <label className="webcam-live-toggle">
            <input
              type="checkbox"
              checked={liveEnabled}
              onChange={(e) => setLiveEnabled(e.target.checked)}
              disabled={disabled}
            />
            <span>Live face detection</span>
          </label>
        </div>
      </div>
      <div className="webcam-preview">
        <video ref={videoRef} autoPlay playsInline muted className="webcam-video" />
        <canvas ref={overlayRef} className="webcam-overlay" />
        {!active && !error && <p className="webcam-placeholder">Starting camera…</p>}
      </div>
      <div className="actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => startStream(facing)}
          disabled={disabled}
        >
          Restart camera
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleCapture}
          disabled={!active || disabled}
        >
          Capture &amp; recognize
        </button>
      </div>
    </div>
  );
}

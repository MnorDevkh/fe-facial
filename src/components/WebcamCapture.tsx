import { useCallback, useEffect, useRef, useState } from "react";

interface WebcamCaptureProps {
  onCapture: (file: File) => void;
  disabled?: boolean;
}

export default function WebcamCapture({ onCapture, disabled }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  const startStream = useCallback(async () => {
    setError(null);
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
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
  }, [stopStream]);

  useEffect(() => {
    startStream();
    return () => stopStream();
  }, [startStream, stopStream]);

  function handleCapture() {
    const video = videoRef.current;
    if (!video || !active) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "webcam.jpg", { type: "image/jpeg" });
        onCapture(file);
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <div className="webcam-capture">
      {error && <div className="alert alert-error">{error}</div>}
      <div className="webcam-preview">
        <video ref={videoRef} autoPlay playsInline muted className="webcam-video" />
        {!active && !error && <p className="webcam-placeholder">Starting camera…</p>}
      </div>
      <div className="actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={startStream}
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

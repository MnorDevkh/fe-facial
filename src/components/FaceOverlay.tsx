import { useEffect, useRef } from "react";
import type { FaceResult } from "../types";
import { faceOverlayLabel } from "../utils/faceDisplay";

interface FaceOverlayProps {
  imageUrl: string;
  faces: FaceResult[];
}

function colorForFace(face: FaceResult): string {
  const key = face.student_id ?? face.name;
  if (key.toLowerCase() === "unknown") return "#ef4444";
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

function labelForFace(face: FaceResult): string {
  return faceOverlayLabel(face);
}

export default function FaceOverlay({ imageUrl, faces }: FaceOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const image = new Image();
    image.onload = () => {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(image, 0, 0);

      for (const face of faces) {
        const { top, right, bottom, left } = face.bbox;
        const color = colorForFace(face);
        const width = right - left;
        const height = bottom - top;

        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, Math.round(image.naturalWidth / 400));
        ctx.strokeRect(left, top, width, height);

        const label = labelForFace(face);
        ctx.font = `600 ${Math.max(12, Math.round(image.naturalWidth / 45))}px DM Sans, sans-serif`;
        const textWidth = ctx.measureText(label).width;
        const labelHeight = Math.max(18, Math.round(image.naturalWidth / 40));
        const labelY = Math.max(top, labelHeight);

        ctx.fillStyle = color;
        ctx.fillRect(left, labelY - labelHeight, textWidth + 12, labelHeight);
        ctx.fillStyle = "#0c1117";
        ctx.fillText(label, left + 6, labelY - 5);
      }
    };
    image.src = imageUrl;
  }, [imageUrl, faces]);

  return (
    <div className="preview-container">
      <canvas ref={canvasRef} />
    </div>
  );
}

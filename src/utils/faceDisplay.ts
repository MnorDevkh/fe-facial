import type { FaceResult } from "../types";

export function faceDisplayName(face: FaceResult): string {
  if (face.name && face.name !== "Unknown") {
    return face.name;
  }
  return "Unknown";
}

export function faceOverlayLabel(face: FaceResult): string {
  return `${faceDisplayName(face)} (${face.confidence.toFixed(1)}%)`;
}

export function faceListPrimaryLabel(face: FaceResult): string {
  return faceDisplayName(face);
}

export function faceListSecondaryLabel(face: FaceResult): string | null {
  if (face.student_id && face.name !== "Unknown") {
    return face.student_id;
  }
  return null;
}

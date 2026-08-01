import type { FaceResult, VideoFrameResult } from "../types";

function faceKey(face: FaceResult): string | null {
  if (!face.student_id) return null;
  return face.student_id;
}

export function aggregateVideoFaces(frameResults: VideoFrameResult[]): FaceResult[] {
  const bestByStudentId = new Map<string, FaceResult>();

  for (const frame of frameResults) {
    for (const face of frame.results) {
      const key = faceKey(face);
      if (!key) continue;
      const existing = bestByStudentId.get(key);
      if (!existing || face.confidence > existing.confidence) {
        bestByStudentId.set(key, face);
      }
    }
  }

  return Array.from(bestByStudentId.values()).sort((a, b) => b.confidence - a.confidence);
}

export function selectionKey(face: FaceResult): string | null {
  if (!face.student_id) return null;
  return `${face.student_id}|${face.confidence}`;
}

export function selectableFaces(faces: FaceResult[]): FaceResult[] {
  return faces.filter((face) => face.student_id !== null);
}

export function keysForFaces(faces: FaceResult[]): Set<string> {
  return new Set(
    selectableFaces(faces)
      .map(selectionKey)
      .filter((key): key is string => key !== null),
  );
}

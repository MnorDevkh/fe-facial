import type {
  AttendanceCheckInEntry,
  AttendanceCheckInResponse,
  AttendanceListResponse,
  ClassDetail,
  ClassItem,
  ClassListResponse,
  DatasetUploadResponse,
  HealthResponse,
  Person,
  PersonDetail,
  PersonListResponse,
  RecognizeImageResponse,
  RecognizeVideoResponse,
  ShiftListResponse,
  TrainResponse,
} from "../types";
import { ApiError } from "../types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function parseError(response: Response): Promise<string> {
  const text = (await response.text()).trim();
  if (!text) {
    return response.status === 500
      ? "Internal server error. Check the API logs for details."
      : `Request failed (${response.status})`;
  }

  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail
        .map((item) => {
          if (typeof item === "object" && item !== null && "msg" in item) {
            return String((item as { msg?: string }).msg ?? "");
          }
          return String(item);
        })
        .filter(Boolean)
        .join(", ");
    }
    if (typeof data.detail === "object" && data.detail !== null) {
      return JSON.stringify(data.detail);
    }
    if (typeof data.message === "string") return data.message;
    return text;
  } catch {
    return text;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response));
  }
  return response.json() as Promise<T>;
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export function listPeople(): Promise<PersonListResponse> {
  return request<PersonListResponse>("/people");
}

export function createPerson(body: {
  name: string;
  student_id: string;
  email?: string;
  phone?: string;
  class_name?: string;
  section?: string;
  class_ids?: number[];
}): Promise<Person> {
  return request<Person>("/people", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function getPerson(id: number): Promise<PersonDetail> {
  return request<PersonDetail>(`/people/${id}`);
}

export function updatePerson(
  id: number,
  body: {
    name?: string;
    email?: string;
    student_id?: string;
    phone?: string;
    class_name?: string;
    section?: string;
    class_ids?: number[];
  },
): Promise<Person> {
  return request<Person>(`/people/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function deletePerson(id: number): Promise<{ status: string; id: number }> {
  return request<{ status: string; id: number }>(`/people/${id}`, {
    method: "DELETE",
  });
}

export function uploadDataset(params: {
  studentId?: string;
  name?: string;
  zipFile?: File;
  images?: File[];
}): Promise<DatasetUploadResponse> {
  const form = new FormData();
  if (params.studentId) form.append("student_id", params.studentId);
  if (params.name) form.append("name", params.name);
  if (params.zipFile) form.append("file", params.zipFile);
  if (params.images) {
    for (const image of params.images) {
      form.append("images", image);
    }
  }
  return request<DatasetUploadResponse>("/dataset/upload", {
    method: "POST",
    body: form,
  });
}

export function trainModel(): Promise<TrainResponse> {
  return request<TrainResponse>("/train", { method: "POST" });
}

export async function recognizeImage(file: File): Promise<RecognizeImageResponse> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE}/recognize/image`, {
    method: "POST",
    body: form,
  });
  const data = (await response.json()) as RecognizeImageResponse;
  if (!response.ok) {
    throw new ApiError(response.status, data.detail ?? (await parseError(response)));
  }
  return data;
}

export async function recognizeVideo(file: File): Promise<RecognizeVideoResponse> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE}/recognize/video`, {
    method: "POST",
    body: form,
  });
  const data = (await response.json()) as RecognizeVideoResponse;
  if (!response.ok) {
    throw new ApiError(response.status, data.detail ?? (await parseError(response)));
  }
  return data;
}

export function listClasses(): Promise<ClassListResponse> {
  return request<ClassListResponse>("/classes");
}

export function listShifts(): Promise<ShiftListResponse> {
  return request<ShiftListResponse>("/classes/shifts");
}

export function createClass(body: { name: string; section?: string }): Promise<ClassDetail> {
  return request<ClassDetail>("/classes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function updateClass(
  id: number,
  body: { name?: string; section?: string },
): Promise<ClassDetail> {
  return request<ClassDetail>(`/classes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function deleteClass(id: number): Promise<{ status: string; id: number }> {
  return request<{ status: string; id: number }>(`/classes/${id}`, {
    method: "DELETE",
  });
}

export function checkInAttendance(
  entries: AttendanceCheckInEntry[],
  options?: { shift?: string; classIds?: number[] },
): Promise<AttendanceCheckInResponse> {
  return request<AttendanceCheckInResponse>("/attendance/check-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entries,
      shift: options?.shift ?? "morning",
      class_ids: options?.classIds ?? [],
    }),
  });
}

export function listAttendance(params?: {
  date?: string;
  fromDate?: string;
  toDate?: string;
  studentId?: string;
  className?: string;
  classIds?: number[];
  shift?: string;
  limit?: number;
}): Promise<AttendanceListResponse> {
  const search = new URLSearchParams();
  if (params?.date) search.set("date", params.date);
  if (params?.fromDate) search.set("from_date", params.fromDate);
  if (params?.toDate) search.set("to_date", params.toDate);
  if (params?.studentId) search.set("student_id", params.studentId);
  if (params?.className) search.set("class_name", params.className);
  if (params?.classIds?.length) search.set("class_ids", params.classIds.join(","));
  if (params?.shift) search.set("shift", params.shift);
  if (params?.limit != null) search.set("limit", String(params.limit));
  const query = search.toString();
  return request<AttendanceListResponse>(`/attendance${query ? `?${query}` : ""}`);
}

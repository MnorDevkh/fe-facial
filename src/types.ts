export interface HealthResponse {
  status: string;
  model_ready: boolean;
  registered_people: number;
  encodings_path: string;
  database_ready: boolean | null;
}

export interface ClassItem {
  id: number;
  name: string;
  section: string | null;
  created_at?: string | null;
}

export interface ClassDetail extends ClassItem {
  student_count: number;
}

export interface ClassListResponse {
  classes: ClassDetail[];
  count: number;
}

export interface ShiftListResponse {
  shifts: string[];
  labels: Record<string, string>;
}

export interface Person {
  id: number;
  name: string;
  email: string | null;
  student_id: string | null;
  phone: string | null;
  class_name: string | null;
  section: string | null;
  classes: ClassItem[];
  created_at: string | null;
}

export interface PersonDetail extends Person {
  image_count: number;
  dataset_dir: string | null;
}

export interface PersonListResponse {
  people: Person[];
  count: number;
}

export interface DatasetUploadResponse {
  status: string;
  student_id: number;
  person: string;
  images_saved: number;
  saved_paths: string[];
  dataset_dir: string;
}

export interface TrainResponse {
  status: string;
  people_encoded: number;
  total_encodings: number;
  skipped_images: number;
  people: string[];
}

export interface FaceBBox {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FaceResult {
  id: number | null;
  student_id: string | null;
  name: string;
  confidence: number;
  distance: number | null;
  bbox: FaceBBox;
}

export interface RecognizeImageResponse {
  media_type: string;
  faces_detected: number;
  results: FaceResult[];
  detail?: string;
}

export interface VideoFrameResult {
  frame: number;
  faces_detected: number;
  results: FaceResult[];
}

export interface RecognizeVideoResponse {
  media_type: string;
  frames_processed: number;
  faces_detected: number;
  unique_student_ids: string[];
  frame_results: VideoFrameResult[];
  detail?: string;
}

export interface AttendanceCheckInEntry {
  student_id: string;
  confidence: number;
}

export interface AttendanceCheckInItemResult {
  name: string;
  confidence: number;
  status: string;
  student_id: string | null;
  date: string | null;
  time: string | null;
  message: string;
}

export interface AttendanceCheckInResponse {
  date: string;
  shift: string;
  total: number;
  marked: number;
  skipped: number;
  results: AttendanceCheckInItemResult[];
}

export interface StudentProfile {
  id: number;
  name: string;
  email: string | null;
  student_id: string | null;
  phone: string | null;
  class_name: string | null;
  section: string | null;
  classes: ClassItem[];
}

export interface AttendanceRecord {
  id: number;
  name: string;
  date: string;
  time: string;
  shift: string;
  confidence: number | null;
  class: ClassItem | null;
  student: StudentProfile | null;
}

export interface AttendanceListResponse {
  date: string | null;
  from_date?: string | null;
  to_date?: string | null;
  count: number;
  records: AttendanceRecord[];
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

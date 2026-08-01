import type { AttendanceRecord, Person } from "../types";

export type ListPreset = "today" | "week" | "month";
export type RosterFilter = "all" | "present" | "absent";
export type ViewMode = "day" | "list";

export const FALLBACK_SHIFT_LABELS: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function presetRange(preset: ListPreset): { fromDate: string; toDate: string } {
  const toDate = todayIso();
  if (preset === "today") {
    return { fromDate: toDate, toDate };
  }
  if (preset === "week") {
    return { fromDate: addDays(toDate, -6), toDate };
  }
  const now = new Date();
  const fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  return { fromDate, toDate };
}

export function parseClassIdsParam(value: string | null): number[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((part) => parseInt(part.trim(), 10))
    .filter((id) => !Number.isNaN(id));
}

export function serializeClassIds(ids: number[]): string {
  return ids.join(",");
}

export function formatClassItem(item: { name: string; section: string | null }): string {
  return item.section ? `${item.name} · ${item.section}` : item.name;
}

export function personInSelectedClasses(person: Person, classIds: number[]): boolean {
  if (!classIds.length) return true;
  const selected = new Set(classIds);
  return (person.classes ?? []).some((item) => selected.has(item.id));
}

export function shiftLabel(shift: string, labels: Record<string, string>): string {
  return labels[shift] ?? shift.replace(/_/g, " ");
}

export function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function classLabel(student: AttendanceRecord["student"]): string {
  if (student?.classes?.length) {
    return student.classes.map(formatClassItem).join(", ");
  }
  if (student?.class_name && student?.section) {
    return `${student.class_name} · ${student.section}`;
  }
  return student?.class_name ?? student?.section ?? "—";
}

export function classLabelFromRecord(row: AttendanceRecord): string {
  if (row.class) return formatClassItem(row.class);
  return classLabel(row.student);
}

export function personClassLabel(person: Person): string {
  if (person.classes?.length) {
    return person.classes.map(formatClassItem).join(", ");
  }
  if (person.class_name && person.section) {
    return `${person.class_name} · ${person.section}`;
  }
  return person.class_name ?? person.section ?? "—";
}

export function formatDateShort(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function buildPresentKeys(records: AttendanceRecord[], shiftFilter?: string): Set<string> {
  const keys = new Set<string>();
  for (const row of records) {
    if (shiftFilter && row.shift !== shiftFilter) continue;
    const studentId = row.student?.student_id;
    if (studentId) {
      keys.add(normalizeKey(studentId));
    }
    keys.add(normalizeKey(row.student?.name ?? row.name));
  }
  return keys;
}

export function isPersonPresent(person: Person, presentKeys: Set<string>): boolean {
  if (person.student_id && presentKeys.has(normalizeKey(person.student_id))) {
    return true;
  }
  return presentKeys.has(normalizeKey(person.name));
}

export function personMatchesSearch(person: Person, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  return (
    person.name.toLowerCase().includes(trimmed) ||
    (person.student_id?.toLowerCase().includes(trimmed) ?? false)
  );
}

export function recordMatchesSearch(row: AttendanceRecord, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const name = row.student?.name ?? row.name;
  const studentId = row.student?.student_id ?? "";
  return name.toLowerCase().includes(trimmed) || studentId.toLowerCase().includes(trimmed);
}

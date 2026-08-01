interface StatusBadgeProps {
  ready: boolean;
  label: string;
}

export function StatusBadge({ ready, label }: StatusBadgeProps) {
  return (
    <span className={`badge ${ready ? "badge-success" : "badge-warning"}`}>
      {ready ? "Ready" : "Not ready"} — {label}
    </span>
  );
}

export function AttendanceStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    marked: "badge-success",
    already_marked: "badge-warning",
    cooldown: "badge-warning",
    rejected_low_confidence: "badge-danger",
    rejected_unknown: "badge-danger",
    rejected_not_registered: "badge-danger",
    rejected_wrong_class: "badge-danger",
  };
  const cls = map[status] ?? "badge-muted";
  const label = status.replace(/_/g, " ");
  return <span className={`badge ${cls}`}>{label}</span>;
}

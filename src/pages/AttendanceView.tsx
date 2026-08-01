import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listAttendance, listClasses, listPeople, listShifts } from "../api/client";
import type { AttendanceRecord, ClassDetail, Person } from "../types";
import { ApiError } from "../types";
import {
  FALLBACK_SHIFT_LABELS,
  addDays,
  buildPresentKeys,
  classLabelFromRecord,
  formatClassItem,
  formatDateShort,
  isPersonPresent,
  personClassLabel,
  personInSelectedClasses,
  personMatchesSearch,
  presetRange,
  parseClassIdsParam,
  recordMatchesSearch,
  serializeClassIds,
  shiftLabel,
  todayIso,
  type ListPreset,
  type RosterFilter,
  type ViewMode,
} from "../utils/attendance";

export default function AttendanceView() {
  const [searchParams, setSearchParams] = useSearchParams();

  const viewMode: ViewMode = searchParams.get("view") === "list" ? "list" : "day";
  const filterDate = searchParams.get("date") ?? todayIso();
  const listPreset: ListPreset =
    searchParams.get("preset") === "today" || searchParams.get("preset") === "month"
      ? (searchParams.get("preset") as ListPreset)
      : "week";
  const classesParam = searchParams.get("classes") ?? searchParams.get("class") ?? "";
  const filterClassIds = useMemo(() => parseClassIdsParam(classesParam || null), [classesParam]);
  const filterShift = searchParams.get("shift") ?? "";

  const [searchQuery, setSearchQuery] = useState("");
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>("all");
  const [people, setPeople] = useState<Person[]>([]);
  const [availableClasses, setAvailableClasses] = useState<ClassDetail[]>([]);
  const [shiftLabels, setShiftLabels] = useState<Record<string, string>>(FALLBACK_SHIFT_LABELS);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [recordCount, setRecordCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metaLoaded, setMetaLoaded] = useState(false);

  const roster = useMemo(() => {
    if (!filterClassIds.length) return people;
    return people.filter((person) => personInSelectedClasses(person, filterClassIds));
  }, [people, filterClassIds]);

  const presentKeys = useMemo(
    () => buildPresentKeys(records, filterShift || undefined),
    [records, filterShift],
  );

  const rosterRows = useMemo(() => {
    return roster
      .map((person) => ({
        person,
        present: isPersonPresent(person, presentKeys),
      }))
      .filter(({ person, present }) => {
        if (!personMatchesSearch(person, searchQuery)) return false;
        if (rosterFilter === "present") return present;
        if (rosterFilter === "absent") return !present;
        return true;
      })
      .sort((a, b) => a.person.name.localeCompare(b.person.name));
  }, [roster, presentKeys, searchQuery, rosterFilter]);

  const filteredLogRecords = useMemo(() => {
    return records.filter((row) => recordMatchesSearch(row, searchQuery));
  }, [records, searchQuery]);

  const presentCount = useMemo(() => {
    return roster.filter((person) => isPersonPresent(person, presentKeys)).length;
  }, [roster, presentKeys]);

  const absentCount = roster.length - presentCount;
  const listRange = presetRange(listPreset);

  function updateParams(mutate: (params: URLSearchParams) => void) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        mutate(params);
        return params;
      },
      { replace: true },
    );
  }

  function setViewMode(next: ViewMode) {
    updateParams((params) => {
      params.set("view", next);
      if (next === "day" && !params.get("date")) {
        params.set("date", todayIso());
      }
      if (next === "list" && !params.get("preset")) {
        params.set("preset", "week");
      }
    });
  }

  function setFilterDate(next: string) {
    updateParams((params) => {
      params.set("date", next);
    });
  }

  function setListPreset(next: ListPreset) {
    updateParams((params) => {
      params.set("preset", next);
    });
  }

  function setFilterClassIds(ids: number[]) {
    updateParams((params) => {
      if (ids.length) params.set("classes", serializeClassIds(ids));
      else {
        params.delete("classes");
        params.delete("class");
      }
    });
  }

  function toggleFilterClass(classId: number) {
    const next = filterClassIds.includes(classId)
      ? filterClassIds.filter((id) => id !== classId)
      : [...filterClassIds, classId];
    setFilterClassIds(next);
  }

  function setFilterShift(next: string) {
    updateParams((params) => {
      if (next) params.set("shift", next);
      else params.delete("shift");
    });
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [peopleData, classesData, shiftsData] = await Promise.all([
          listPeople(),
          listClasses(),
          listShifts(),
        ]);
        if (!active) return;
        setPeople(peopleData.people);
        setAvailableClasses(classesData.classes);
        setShiftLabels(shiftsData.labels);
      } catch {
        if (!active) return;
        setPeople([]);
        setAvailableClasses([]);
        setShiftLabels(FALLBACK_SHIFT_LABELS);
      } finally {
        if (active) setMetaLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const classIds = parseClassIdsParam(classesParam || null);
        const range = presetRange(listPreset);
        const data =
          viewMode === "day"
            ? await listAttendance({
                date: filterDate,
                classIds: classIds.length ? classIds : undefined,
                shift: filterShift || undefined,
                limit: 500,
              })
            : await listAttendance({
                fromDate: range.fromDate,
                toDate: range.toDate,
                classIds: classIds.length ? classIds : undefined,
                shift: filterShift || undefined,
                limit: 500,
              });
        if (!active) return;
        setRecords(data.records);
        setRecordCount(data.count);
      } catch (err) {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : "Failed to load attendance records.");
        setRecords([]);
        setRecordCount(0);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [viewMode, filterDate, listPreset, classesParam, filterShift]);

  async function refreshRecords() {
    setLoading(true);
    setError(null);
    try {
      const classIds = parseClassIdsParam(classesParam || null);
      const data =
        viewMode === "day"
          ? await listAttendance({
              date: filterDate,
              classIds: classIds.length ? classIds : undefined,
              shift: filterShift || undefined,
              limit: 500,
            })
          : await listAttendance({
              fromDate: listRange.fromDate,
              toDate: listRange.toDate,
              classIds: classIds.length ? classIds : undefined,
              shift: filterShift || undefined,
              limit: 500,
            });
      setRecords(data.records);
      setRecordCount(data.count);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load attendance records.");
      setRecords([]);
      setRecordCount(0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <h2>View Attendance</h2>
        <p>
          Check who is present or absent by day, or browse records across a date range. Filter by
          shift and class. To record new check-ins, go to{" "}
          <Link to="/attendance">Check-in</Link>.
        </p>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="view-toggle" style={{ marginBottom: "1rem" }}>
          <button
            type="button"
            className={`view-toggle-btn ${viewMode === "day" ? "active" : ""}`}
            onClick={() => setViewMode("day")}
          >
            Day
          </button>
          <button
            type="button"
            className={`view-toggle-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
          >
            List
          </button>
        </div>

        <div className="form-row" style={{ marginBottom: "1rem" }}>
          {viewMode === "day" ? (
            <div className="form-group">
              <label htmlFor="filter-date">Date</label>
              <div className="date-nav">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setFilterDate(addDays(filterDate, -1))}
                  aria-label="Previous day"
                >
                  ←
                </button>
                <input
                  id="filter-date"
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setFilterDate(todayIso())}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setFilterDate(addDays(filterDate, 1))}
                  aria-label="Next day"
                >
                  →
                </button>
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label>Date range</label>
              <div className="preset-chips">
                {(["today", "week", "month"] as ListPreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`preset-chip ${listPreset === preset ? "active" : ""}`}
                    onClick={() => setListPreset(preset)}
                  >
                    {preset === "today" ? "Today" : preset === "week" ? "This week" : "This month"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="filter-shift">Shift</label>
            <select
              id="filter-shift"
              value={filterShift}
              onChange={(e) => setFilterShift(e.target.value)}
            >
              <option value="">All shifts</option>
              {Object.entries(shiftLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Classes</label>
            {!metaLoaded ? (
              <p className="empty-state" style={{ margin: 0 }}>Loading classes…</p>
            ) : availableClasses.length === 0 ? (
              <p className="empty-state" style={{ margin: 0 }}>
                No classes. <Link to="/classes">Add classes</Link>
              </p>
            ) : (
              <div className="class-multi-select">
                {availableClasses.map((item) => (
                  <label key={item.id} className="class-chip-option">
                    <input
                      type="checkbox"
                      checked={filterClassIds.includes(item.id)}
                      onChange={() => toggleFilterClass(item.id)}
                    />
                    <span>{formatClassItem(item)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="filter-search">Search</label>
            <input
              id="filter-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Name or student ID"
            />
          </div>

          <div className="form-group" style={{ flex: "0 0 auto", alignSelf: "end" }}>
            <button type="button" className="btn btn-secondary" onClick={refreshRecords} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        {viewMode === "day" ? (
          <DayAttendanceView
            filterDate={filterDate}
            filterShift={filterShift}
            shiftLabels={shiftLabels}
            loading={loading}
            roster={roster}
            rosterRows={rosterRows}
            rosterFilter={rosterFilter}
            setRosterFilter={setRosterFilter}
            presentCount={presentCount}
            absentCount={absentCount}
            recordCount={recordCount}
            filteredLogRecords={filteredLogRecords}
          />
        ) : (
          <ListAttendanceView
            loading={loading}
            records={filteredLogRecords}
            recordCount={recordCount}
            fromDate={listRange.fromDate}
            toDate={listRange.toDate}
            shiftLabels={shiftLabels}
          />
        )}
      </div>
    </>
  );
}

function DayAttendanceView({
  filterDate,
  filterShift,
  shiftLabels,
  loading,
  roster,
  rosterRows,
  rosterFilter,
  setRosterFilter,
  presentCount,
  absentCount,
  recordCount,
  filteredLogRecords,
}: {
  filterDate: string;
  filterShift: string;
  shiftLabels: Record<string, string>;
  loading: boolean;
  roster: Person[];
  rosterRows: { person: Person; present: boolean }[];
  rosterFilter: RosterFilter;
  setRosterFilter: (value: RosterFilter) => void;
  presentCount: number;
  absentCount: number;
  recordCount: number;
  filteredLogRecords: AttendanceRecord[];
}) {
  if (loading) {
    return <p className="empty-state">Loading…</p>;
  }

  return (
    <>
      <div className="grid-2" style={{ marginBottom: "1.25rem" }}>
        <div className="stat-card">
          <div className="stat-label">Present</div>
          <div className="stat-value ok">{presentCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Absent</div>
          <div className="stat-value warn">{absentCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total registered</div>
          <div className="stat-value">{roster.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Check-ins logged</div>
          <div className="stat-value">{recordCount}</div>
        </div>
      </div>

      {roster.length === 0 ? (
        <p className="empty-state">
          No registered students
          {filterDate ? ` for ${formatDateShort(filterDate)}` : ""}.{" "}
          <Link to="/people">Add people</Link> first.
        </p>
      ) : (
        <>
          <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>
            Roster — {formatDateShort(filterDate)}
            {filterShift ? ` · ${shiftLabel(filterShift, shiftLabels)}` : ""}
          </h4>
          <div className="view-toggle" style={{ marginBottom: "0.75rem" }}>
            {(["all", "present", "absent"] as RosterFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                className={`view-toggle-btn ${rosterFilter === filter ? "active" : ""}`}
                onClick={() => setRosterFilter(filter)}
              >
                {filter === "all" ? "All" : filter === "present" ? "Present only" : "Absent only"}
              </button>
            ))}
          </div>
          {rosterRows.length === 0 ? (
            <p className="empty-state">No students match the current filters.</p>
          ) : (
            <div className="table-wrap" style={{ marginBottom: "1.5rem" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Student ID</th>
                    <th>Class</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rosterRows.map(({ person, present }) => (
                    <tr key={person.id}>
                      <td>{person.name}</td>
                      <td className="mono">{person.student_id ?? "—"}</td>
                      <td>{personClassLabel(person)}</td>
                      <td>
                        <span className={present ? "status-present" : "status-absent"}>
                          {present ? "Present" : "Absent"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {recordCount === 0 && (
            <p className="empty-state" style={{ marginBottom: "1rem" }}>
              No check-ins yet for this date.
            </p>
          )}
        </>
      )}

      <h4 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>Check-in log</h4>
      {filteredLogRecords.length === 0 ? (
        <p className="empty-state">No log entries match the current filters.</p>
      ) : (
        <AttendanceLogTable records={filteredLogRecords} showDate={false} shiftLabels={shiftLabels} />
      )}
    </>
  );
}

function ListAttendanceView({
  loading,
  records,
  recordCount,
  fromDate,
  toDate,
  shiftLabels,
}: {
  loading: boolean;
  records: AttendanceRecord[];
  recordCount: number;
  fromDate: string;
  toDate: string;
  shiftLabels: Record<string, string>;
}) {
  if (loading) {
    return <p className="empty-state">Loading…</p>;
  }

  const rangeLabel =
    fromDate === toDate
      ? formatDateShort(fromDate)
      : `${formatDateShort(fromDate)} – ${formatDateShort(toDate)}`;

  return (
    <>
      <p style={{ margin: "0 0 1rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
        {recordCount} record{recordCount === 1 ? "" : "s"} · {rangeLabel}
        {recordCount >= 500 && " · Showing first 500 records"}
      </p>
      {records.length === 0 ? (
        <p className="empty-state">No attendance records for this date range.</p>
      ) : (
        <AttendanceLogTable records={records} showDate shiftLabels={shiftLabels} />
      )}
    </>
  );
}

function AttendanceLogTable({
  records,
  showDate,
  shiftLabels,
}: {
  records: AttendanceRecord[];
  showDate: boolean;
  shiftLabels: Record<string, string>;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {showDate && <th>Date</th>}
            <th>Shift</th>
            <th>Time</th>
            <th>Name</th>
            <th>Student ID</th>
            <th>Class</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {records.map((row) => {
            const student = row.student;
            return (
              <tr key={row.id}>
                {showDate && <td className="mono">{row.date}</td>}
                <td>{shiftLabel(row.shift ?? "morning", shiftLabels)}</td>
                <td className="mono">{row.time ?? "—"}</td>
                <td>
                  <div className="cell-primary">{student?.name ?? row.name}</div>
                  {(student?.email || student?.phone) && (
                    <div className="cell-secondary">
                      {[student?.email, student?.phone].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </td>
                <td className="mono">{student?.student_id ?? "—"}</td>
                <td>{classLabelFromRecord(row)}</td>
                <td>{row.confidence != null ? `${row.confidence.toFixed(1)}%` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

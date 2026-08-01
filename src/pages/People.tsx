import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createPerson,
  deletePerson,
  getPerson,
  listClasses,
  listPeople,
  updatePerson,
} from "../api/client";
import type { ClassDetail, Person, PersonDetail } from "../types";
import { ApiError } from "../types";

type PersonFormState = {
  name: string;
  email: string;
  studentId: string;
  phone: string;
  classIds: number[];
};

const emptyForm = (): PersonFormState => ({
  name: "",
  email: "",
  studentId: "",
  phone: "",
  classIds: [],
});

function personToForm(person: Person): PersonFormState {
  return {
    name: person.name,
    email: person.email ?? "",
    studentId: person.student_id ?? "",
    phone: person.phone ?? "",
    classIds: (person.classes ?? []).map((item) => item.id),
  };
}

function formatClassLabel(item: { name: string; section: string | null }): string {
  return item.section ? `${item.name} · ${item.section}` : item.name;
}

function ClassMultiSelect({
  classes,
  selectedIds,
  onChange,
  idPrefix,
}: {
  classes: ClassDetail[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  idPrefix: string;
}) {
  function toggle(classId: number) {
    if (selectedIds.includes(classId)) {
      onChange(selectedIds.filter((id) => id !== classId));
    } else {
      onChange([...selectedIds, classId]);
    }
  }

  if (classes.length === 0) {
    return (
      <p className="empty-state" style={{ margin: 0 }}>
        No classes yet. <Link to="/classes">Create classes</Link> first.
      </p>
    );
  }

  return (
    <div className="class-multi-select">
      {classes.map((item) => (
        <label key={item.id} className="class-chip-option">
          <input
            id={`${idPrefix}-class-${item.id}`}
            type="checkbox"
            checked={selectedIds.includes(item.id)}
            onChange={() => toggle(item.id)}
          />
          <span>{formatClassLabel(item)}</span>
        </label>
      ))}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}

function personMetaLine(person: Person): string {
  const parts: string[] = [];
  const classLabels = (person.classes ?? []).map(formatClassLabel);
  if (classLabels.length > 0) {
    parts.push(classLabels.join(", "));
  } else if (person.class_name) {
    parts.push(person.section ? `${person.class_name} · ${person.section}` : person.class_name);
  }
  if (person.email) parts.push(person.email);
  if (person.phone) parts.push(person.phone);
  return parts.join(" · ");
}

export default function People() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<PersonFormState>(emptyForm);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewPerson, setViewPerson] = useState<PersonDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [editForm, setEditForm] = useState<PersonFormState>(emptyForm);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [availableClasses, setAvailableClasses] = useState<ClassDetail[]>([]);

  const loadPeople = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPeople();
      setPeople(data.people);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load people.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPeople();
    listClasses()
      .then((data) => setAvailableClasses(data.classes))
      .catch(() => setAvailableClasses([]));
  }, [loadPeople]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const person = await createPerson({
        name: createForm.name.trim(),
        student_id: createForm.studentId.trim(),
        email: createForm.email.trim() || undefined,
        phone: createForm.phone.trim() || undefined,
        class_ids: createForm.classIds,
      });
      setSuccess(`Registered ${person.name}${person.student_id ? ` (${person.student_id})` : ""}.`);
      setCreateForm(emptyForm());
      await loadPeople();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function closeView() {
    setViewOpen(false);
    setViewPerson(null);
    setViewLoading(false);
  }

  async function openView(person: Person) {
    setViewOpen(true);
    setViewPerson(null);
    setViewLoading(true);
    setError(null);
    try {
      const detail = await getPerson(person.id);
      setViewPerson(detail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load person details.");
      setViewOpen(false);
    } finally {
      setViewLoading(false);
    }
  }

  function openEdit(person: Person) {
    setEditPerson(person);
    setEditForm(personToForm(person));
    setEditError(null);
    setError(null);
    setSuccess(null);
  }

  function openDelete(person: Person) {
    setDeleteTarget(person);
    setDeleteError(null);
    setError(null);
    setSuccess(null);
  }

  async function handleEdit(event: FormEvent) {
    event.preventDefault();
    if (!editPerson) return;

    setEditSubmitting(true);
    setEditError(null);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updatePerson(editPerson.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim() || undefined,
        student_id: editForm.studentId.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
        class_ids: editForm.classIds,
      });
      setSuccess(`Updated ${updated.name}.`);
      setEditPerson(null);
      await loadPeople();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Update failed.";
      setEditError(message);
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    setDeleteSubmitting(true);
    setDeleteError(null);
    setError(null);
    setSuccess(null);
    try {
      await deletePerson(deleteTarget.id);
      setSuccess(`Deleted ${deleteTarget.name}.`);
      setDeleteTarget(null);
      if (viewOpen && viewPerson?.id === deleteTarget.id) {
        closeView();
      }
      await loadPeople();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Delete failed.";
      setDeleteError(message);
    } finally {
      setDeleteSubmitting(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <h2>People</h2>
        <p>Register students in the database before uploading their face images.</p>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <h3 className="card-title">Register new person</h3>
        <form onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="create-name">Full name *</label>
              <input
                id="create-name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Alice Johnson"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="create-student_id">Student ID *</label>
              <input
                id="create-student_id"
                value={createForm.studentId}
                onChange={(e) => setCreateForm({ ...createForm, studentId: e.target.value })}
                placeholder="STU001"
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="create-email">Email</label>
            <input
              id="create-email"
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="alice@school.com"
            />
          </div>
          <div className="form-group">
            <label htmlFor="create-phone">Phone</label>
            <input
              id="create-phone"
              value={createForm.phone}
              onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
              placeholder="555-0100"
            />
          </div>
          <div className="form-group">
            <label>Classes</label>
            <ClassMultiSelect
              idPrefix="create"
              classes={availableClasses}
              selectedIds={createForm.classIds}
              onChange={(classIds) => setCreateForm({ ...createForm, classIds })}
            />
          </div>
          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting && <span className="spinner" />}
              Register person
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 className="card-title" style={{ margin: 0 }}>
            Registered people ({people.length})
          </h3>
          <button type="button" className="btn btn-secondary" onClick={loadPeople} disabled={loading}>
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="empty-state">Loading…</p>
        ) : people.length === 0 ? (
          <p className="empty-state">No people registered yet.</p>
        ) : (
          <div className="people-list">
            {people.map((person) => {
              const meta = personMetaLine(person);
              return (
                <div className="person-row" key={person.id}>
                  <button
                    type="button"
                    className="person-info"
                    onClick={() => openView(person)}
                    aria-label={`View ${person.name}`}
                  >
                    <div className="person-primary">
                      <strong>{person.name}</strong>
                      {person.student_id && (
                        <span className="person-id mono">{person.student_id}</span>
                      )}
                    </div>
                    {meta ? (
                      <div className="person-meta">{meta}</div>
                    ) : (
                      <div className="person-meta">No contact details</div>
                    )}
                  </button>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openView(person)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openEdit(person)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => openDelete(person)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {viewOpen && (
        <div className="modal-overlay" onClick={closeView}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>Person details</h3>
              <button
                type="button"
                className="modal-close"
                onClick={closeView}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {viewLoading ? (
              <p className="empty-state">Loading…</p>
            ) : viewPerson ? (
              <>
                <div className="detail-grid">
                  <DetailRow label="ID" value={String(viewPerson.id)} />
                  <DetailRow label="Name" value={viewPerson.name} />
                  <DetailRow label="Student ID" value={viewPerson.student_id ?? "—"} />
                  <DetailRow
                    label="Classes"
                    value={
                      (viewPerson.classes ?? []).length > 0
                        ? (viewPerson.classes ?? []).map(formatClassLabel).join(", ")
                        : viewPerson.class_name ?? "—"
                    }
                  />
                  <DetailRow label="Email" value={viewPerson.email ?? "—"} />
                  <DetailRow label="Phone" value={viewPerson.phone ?? "—"} />
                  <DetailRow
                    label="Created"
                    value={
                      viewPerson.created_at
                        ? new Date(viewPerson.created_at).toLocaleString()
                        : "—"
                    }
                  />
                  <DetailRow label="Face images" value={String(viewPerson.image_count)} />
                  <DetailRow label="Dataset folder" value={viewPerson.dataset_dir ?? "—"} />
                </div>
                <div className="actions" style={{ marginTop: "1.25rem" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      const person = viewPerson;
                      closeView();
                      openEdit(person);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      const person = viewPerson;
                      closeView();
                      openDelete(person);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {editPerson && (
        <div className="modal-overlay" onClick={() => !editSubmitting && setEditPerson(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>Edit person</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setEditPerson(null)}
                aria-label="Close"
                disabled={editSubmitting}
              >
                ×
              </button>
            </div>
            {editError && <div className="alert alert-error">{editError}</div>}
            <form onSubmit={handleEdit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-name">Full name *</label>
                  <input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-student_id">Student ID</label>
                  <input
                    id="edit-student_id"
                    value={editForm.studentId}
                    onChange={(e) => setEditForm({ ...editForm, studentId: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="edit-email">Email</label>
                <input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-phone">Phone</label>
                <input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Classes</label>
                <ClassMultiSelect
                  idPrefix="edit"
                  classes={availableClasses}
                  selectedIds={editForm.classIds}
                  onChange={(classIds) => setEditForm({ ...editForm, classIds })}
                />
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "0 0 0.5rem" }}>
                Renaming moves the dataset folder. Re-train the model afterward if this person was
                already trained.
              </p>
              <div className="actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditPerson(null)}
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  {editSubmitting && <span className="spinner" />}
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !deleteSubmitting && setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>Delete person</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDeleteTarget(null)}
                aria-label="Close"
                disabled={deleteSubmitting}
              >
                ×
              </button>
            </div>
            {deleteError && <div className="alert alert-error">{deleteError}</div>}
            <p style={{ margin: "0 0 1rem" }}>
              Delete <strong>{deleteTarget.name}</strong>? This removes their database record and
              dataset folder. Attendance history is kept but unlinked. Re-train the model afterward.
            </p>
            <div className="actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleteSubmitting}
              >
                {deleteSubmitting && <span className="spinner" />}
                Delete person
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

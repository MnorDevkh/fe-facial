import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createClass, deleteClass, listClasses, updateClass } from "../api/client";
import type { ClassDetail } from "../types";
import { ApiError } from "../types";

function formatClassLabel(item: ClassDetail): string {
  return item.section ? `${item.name} · ${item.section}` : item.name;
}

export default function Classes() {
  const [classes, setClasses] = useState<ClassDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [createName, setCreateName] = useState("");
  const [createSection, setCreateSection] = useState("");

  const [editTarget, setEditTarget] = useState<ClassDetail | null>(null);
  const [editName, setEditName] = useState("");
  const [editSection, setEditSection] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<ClassDetail | null>(null);

  const loadClasses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listClasses();
      setClasses(data.classes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load classes.");
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await createClass({
        name: createName.trim(),
        section: createSection.trim() || undefined,
      });
      setCreateName("");
      setCreateSection("");
      setSuccess("Class created.");
      await loadClasses();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create class.");
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(item: ClassDetail) {
    setEditTarget(item);
    setEditName(item.name);
    setEditSection(item.section ?? "");
    setError(null);
    setSuccess(null);
  }

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault();
    if (!editTarget) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await updateClass(editTarget.id, {
        name: editName.trim(),
        section: editSection.trim() || undefined,
      });
      setEditTarget(null);
      setSuccess("Class updated.");
      await loadClasses();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update class.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteClass(deleteTarget.id);
      setDeleteTarget(null);
      setSuccess("Class deleted.");
      await loadClasses();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete class.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <h2>Classes</h2>
        <p>
          Create classes and assign students to one or more classes from the{" "}
          <Link to="/people">People</Link> page. Use classes when checking in or viewing attendance.
        </p>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-info">{success}</div>}

      <div className="card">
        <h3 className="card-title">Add class</h3>
        <form onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="create-class-name">Name</label>
              <input
                id="create-class-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="10A"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="create-class-section">Section</label>
              <input
                id="create-class-section"
                value={createSection}
                onChange={(e) => setCreateSection(e.target.value)}
                placeholder="A"
              />
            </div>
            <div className="form-group" style={{ flex: "0 0 auto", alignSelf: "end" }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting && <span className="spinner" />}
                Add class
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="card">
        <h3 className="card-title">All classes</h3>
        {loading ? (
          <p className="empty-state">Loading…</p>
        ) : classes.length === 0 ? (
          <p className="empty-state">No classes yet. Add one above.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Section</th>
                  <th>Students</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.section ?? "—"}</td>
                    <td>{item.student_count}</td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button type="button" className="btn btn-secondary" onClick={() => openEdit(item)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => setDeleteTarget(item)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editTarget && (
        <div className="modal-overlay" onClick={() => setEditTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title">Edit class — {formatClassLabel(editTarget)}</h3>
            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label htmlFor="edit-class-name">Name</label>
                <input
                  id="edit-class-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-class-section">Section</label>
                <input
                  id="edit-class-section"
                  value={editSection}
                  onChange={(e) => setEditSection(e.target.value)}
                />
              </div>
              <div className="actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditTarget(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title">Delete class</h3>
            <p>Delete {formatClassLabel(deleteTarget)}? Student links will be removed.</p>
            <div className="actions">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmDelete} disabled={submitting}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

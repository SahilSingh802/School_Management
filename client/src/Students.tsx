
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2, X, Users, RefreshCw } from "lucide-react";
import api from "./services/api";

interface Student {
  _id: string;
  admissionNo: string;
  name: string;
  dateOfBirth?: string;
  classId: {
    _id: string;
    name: string;
    section: string;
  };
  guardianIds?: ({ _id: string; name: string; email: string } | string)[];
}

interface Guardian {
  _id: string;
  name: string;
  email: string;
}

interface SchoolClass {
  _id: string;
  name: string;
  section: string;
  academicYear: string;
}

const emptyForm = {
  admissionNo: "",
  name: "",
  dateOfBirth: "",
  classId: "",
  guardianIds: [] as string[],
};

export default function Students({ canManage = true }: { canManage?: boolean }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const requests = [
        api.get("/academic/students"),
        api.get("/academic/classes"),
        ...(canManage ? [api.get("/academic/guardians")] : []),
      ];
      const [studentResponse, classResponse, guardianResponse] = await Promise.all(requests);

      setStudents(studentResponse.data.data);
      setClasses(classResponse.data.data);
      if (guardianResponse) setGuardians(guardianResponse.data.data);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load students.");
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filteredStudents = useMemo(() => {
    const query = search.toLowerCase();

    return students.filter((student) =>
      student.name.toLowerCase().includes(query) ||
      student.admissionNo.toLowerCase().includes(query) ||
      student.classId?.name?.toLowerCase().includes(query)
    );
  }, [students, search]);

  const openAddModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  };

  const openEditModal = (student: Student) => {
    setEditingId(student._id);
    setForm({
      admissionNo: student.admissionNo,
      name: student.name,
      dateOfBirth: student.dateOfBirth
        ? student.dateOfBirth.substring(0, 10)
        : "",
      classId: student.classId?._id || "",
      guardianIds: student.guardianIds?.map((guardian) =>
        typeof guardian === "string" ? guardian : guardian._id
      ) || [],
    });
    setError("");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (editingId) {
        await api.put(`/academic/students/${editingId}`, form);
      } else {
        await api.post("/academic/students", form);
      }

      setShowModal(false);
      setForm(emptyForm);
      setEditingId(null);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || "Unable to save student.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "Archive this student? Attendance, examination, result, and fee history will be preserved."
    );

    if (!confirmed) return;

    try {
      await api.delete(`/academic/students/${id}`);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || "Unable to delete student.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Student Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage student records, admissions and class assignments.
          </p>
        </div>

        {canManage && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">Linked guardians</legend>
            <div className="max-h-32 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
              {guardians.length === 0 ? (
                <p className="text-xs text-slate-400">No active guardian accounts. Create one through the admin registration API first.</p>
              ) : guardians.map((guardian) => (
                <label key={guardian._id} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.guardianIds.includes(guardian._id)}
                    onChange={(event) => setForm({
                      ...form,
                      guardianIds: event.target.checked
                        ? [...form.guardianIds, guardian._id]
                        : form.guardianIds.filter((id) => id !== guardian._id),
                    })}
                  />
                  {guardian.name} <span className="text-xs text-slate-400">{guardian.email}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {canManage && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-indigo-700"
          >
            <Plus size={18} /> Add Student
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <Users className="mb-3 text-indigo-600" size={23} />
          <p className="text-sm text-slate-500">Total Students</p>
          <h2 className="mt-1 text-3xl font-extrabold text-slate-900">
            {students.length}
          </h2>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Available Classes</p>
          <h2 className="mt-1 text-3xl font-extrabold text-slate-900">
            {classes.length}
          </h2>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Search Results</p>
          <h2 className="mt-1 text-3xl font-extrabold text-slate-900">
            {filteredStudents.length}
          </h2>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h2 className="font-bold text-slate-900">All Students</h2>
            <p className="mt-1 text-xs text-slate-400">
              Student records from your database
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <Search size={17} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students..."
              className="w-48 text-sm outline-none"
            />
          </div>

          <button
            onClick={() => {
              setLoading(true);
              setError("");
              void fetchData();
            }}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {error && (
          <p className="m-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-600">
            {error}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Admission No.</th>
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4">Date of Birth</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    Loading students...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    No students found.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student._id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 font-bold text-indigo-700">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-slate-800">
                          {student.name}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-500">
                      {student.admissionNo}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-500">
                      {student.classId
                        ? `${student.classId.name} - ${student.classId.section}`
                        : "Not assigned"}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-500">
                      {student.dateOfBirth
                        ? new Date(student.dateOfBirth).toLocaleDateString("en-IN")
                        : "—"}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {canManage && (
                          <>
                            <button
                              onClick={() => openEditModal(student)}
                              title="Edit"
                              className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50"
                            >
                              <Pencil size={17} />
                            </button>

                            <button
                              onClick={() => handleDelete(student._id)}
                              title="Archive student"
                              className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 size={17} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingId ? "Edit Student" : "Add New Student"}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Enter the student's academic information.
                </p>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <p className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-600">
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Student Name
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter full name"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Admission Number
                </label>
                <input
                  required
                  value={form.admissionNo}
                  onChange={(e) =>
                    setForm({ ...form, admissionNo: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g. STU002"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Class and Section
                </label>
                <select
                  required
                  value={form.classId}
                  onChange={(e) => setForm({ ...form, classId: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500"
                >
                  <option value="">Select class</option>
                  {classes.map((schoolClass) => (
                    <option key={schoolClass._id} value={schoolClass._id}>
                      {schoolClass.name} - {schoolClass.section} ({schoolClass.academicYear})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) =>
                    setForm({ ...form, dateOfBirth: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : editingId ? "Update Student" : "Save Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

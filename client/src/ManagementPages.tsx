import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Pencil, Trash2, Check, Download } from "lucide-react";
import api from "./services/api";
import PrintableReportCard from "./PrintableReportCard";

type Role = "ADMIN" | "TEACHER" | "GUARDIAN";
type Page = "Teachers" | "Classes & Subjects" | "Attendance" | "Examinations" | "Results" | "Fee Management";

interface SchoolClass {
  _id: string;
  name: string;
  section: string;
  academicYear: string;
}

interface Subject {
  _id: string;
  name: string;
  code: string;
  classes: (SchoolClass | string)[];
}

interface Student {
  _id: string;
  name: string;
  admissionNo: string;
  classId: SchoolClass | string;
}

interface Teacher {
  _id: string;
  employeeId: string;
  userId: { name: string; email: string };
  assignedClasses: (SchoolClass | string)[];
  subjects: (Subject | string)[];
}

interface Exam {
  _id: string;
  title: string;
  date: string;
  maxMarks: number;
  passMarks: number;
  classId: SchoolClass | string;
  subjectId: Subject | string;
}

interface Result {
  _id: string;
  marksObtained: number;
  percentage: number;
  grade: string;
  examId: Exam;
  studentId: Student;
}

interface Fee {
  _id: string;
  studentId: Student;
  academicYear: string;
  feeType: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  dueDate: string;
}

interface Payment {
  _id: string;
  studentId: Student;
  feeId: Fee;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  transactionId?: string;
}

interface Attendance {
  _id: string;
  studentId: Student;
  classId: SchoolClass;
  date: string;
  session: string;
  status: "PRESENT" | "ABSENT" | "LATE";
}

interface FeeCollectionReport {
  totalInvoiced: number;
  currentlyPaid: number;
  outstanding: number;
  invoiceCount: number;
  collectedInPeriod: number;
  paymentCountInPeriod: number;
  breakdown: {
    academicYear: string;
    feeType: string;
    invoiceCount: number;
    totalInvoiced: number;
    currentlyPaid: number;
    outstanding: number;
  }[];
}

interface OutstandingReport {
  invoiceCount: number;
  outstanding: number;
  invoices: Fee[];
}

interface ManagementPageData {
  teachers?: Teacher[];
  classes?: SchoolClass[];
  subjects?: Subject[];
  students?: Student[];
  exams?: Exam[];
  results?: Result[];
  fees?: Fee[];
  payments?: Payment[];
  collectionReport?: FeeCollectionReport;
  outstandingReport?: OutstandingReport;
  attendance?: Attendance[];
}

const errorMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : "The request could not be completed.";
};

const idOf = (value: { _id: string } | string) =>
  typeof value === "string" ? value : value._id;

const nameOf = (value: { name: string } | string | undefined) =>
  typeof value === "string" ? value : value?.name ?? "—";

const today = new Date().toISOString().slice(0, 10);

export default function ManagementPages({ page, role }: { page: Page; role: Role }) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [collectionReport, setCollectionReport] = useState<FeeCollectionReport | null>(null);
  const [outstandingReport, setOutstandingReport] = useState<OutstandingReport | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState("");
  const [teacherForm, setTeacherForm] = useState({
    name: "", email: "", password: "", employeeId: "", assignedClasses: [] as string[], subjects: [] as string[],
  });
  const [classForm, setClassForm] = useState({ name: "", section: "", academicYear: "2026-27" });
  const [subjectForm, setSubjectForm] = useState({ name: "", code: "", classes: [] as string[] });
  const [classEditingId, setClassEditingId] = useState("");
  const [subjectEditingId, setSubjectEditingId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedDate, setSelectedDate] = useState(today);
  const [session, setSession] = useState("MORNING");
  const [attendanceFromDate, setAttendanceFromDate] = useState("");
  const [attendanceToDate, setAttendanceToDate] = useState("");
  const [attendanceStatus, setAttendanceStatus] = useState("");
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, Attendance["status"]>>({});
  const [examForm, setExamForm] = useState({
    title: "", classId: "", subjectId: "", date: today, maxMarks: "100", passMarks: "40",
  });
  const [resultForm, setResultForm] = useState({ examId: "", studentId: "", marksObtained: "", remarks: "" });
  const [feeForm, setFeeForm] = useState({
    studentId: "", academicYear: "2026-27", feeType: "", totalAmount: "", dueDate: today,
  });
  const [paymentForm, setPaymentForm] = useState({
    feeId: "", amount: "", paymentMethod: "CASH", transactionId: "",
  });
  const [feeFilterDraft, setFeeFilterDraft] = useState({
    studentId: "", academicYear: "", status: "", feeType: "",
    fromDate: "", toDate: "", paymentFromDate: "", paymentToDate: "", paymentMethod: "",
  });
  const [activeFeeFilters, setActiveFeeFilters] = useState(feeFilterDraft);

  const loadPageData = useCallback(async (): Promise<ManagementPageData> => {
      if (page === "Teachers") {
        const [teacherResponse, classResponse, subjectResponse] = await Promise.all([
          api.get("/academic/teachers"), api.get("/academic/classes"), api.get("/academic/subjects"),
        ]);
        return {
          teachers: teacherResponse.data.data,
          classes: classResponse.data.data,
          subjects: subjectResponse.data.data,
        };
      } else if (page === "Classes & Subjects") {
        const [classResponse, subjectResponse] = await Promise.all([
          api.get("/academic/classes"), api.get("/academic/subjects"),
        ]);
        return { classes: classResponse.data.data, subjects: subjectResponse.data.data };
      } else if (page === "Attendance") {
        const [classResponse, studentResponse, attendanceResponse] = await Promise.all([
          api.get("/academic/classes"), api.get("/academic/students"), api.get("/attendance"),
        ]);
        return {
          classes: classResponse.data.data,
          students: studentResponse.data.data,
          attendance: attendanceResponse.data.data,
        };
      } else if (page === "Examinations") {
        const [classResponse, subjectResponse, examResponse] = await Promise.all([
          api.get("/academic/classes"), api.get("/academic/subjects"), api.get("/exams"),
        ]);
        return {
          classes: classResponse.data.data,
          subjects: subjectResponse.data.data,
          exams: examResponse.data.data,
        };
      } else if (page === "Results") {
        const [studentResponse, examResponse, resultResponse] = await Promise.all([
          api.get("/academic/students"), api.get("/exams"), api.get("/results"),
        ]);
        return {
          students: studentResponse.data.data,
          exams: examResponse.data.data,
          results: resultResponse.data.data,
        };
      } else {
        const [feeResponse, paymentResponse, collectionResponse, outstandingResponse] = await Promise.all([
          api.get("/fees", { params: activeFeeFilters }),
          api.get("/fees/payments", { params: {
            studentId: activeFeeFilters.studentId || undefined,
            paymentFromDate: activeFeeFilters.paymentFromDate || undefined,
            paymentToDate: activeFeeFilters.paymentToDate || undefined,
            paymentMethod: activeFeeFilters.paymentMethod || undefined,
          } }),
          api.get("/fees/reports/collection", { params: activeFeeFilters }),
          api.get("/fees/reports/outstanding", { params: activeFeeFilters }),
        ]);
        let students: Student[] | undefined;
        if (role === "ADMIN") {
          const studentResponse = await api.get("/academic/students");
          students = studentResponse.data.data;
        }
        return {
          fees: feeResponse.data.data,
          payments: paymentResponse.data.data,
          collectionReport: collectionResponse.data.data,
          outstandingReport: outstandingResponse.data.data,
          ...(students ? { students } : {}),
        };
      }
  }, [page, role, activeFeeFilters]);

  const applyPageData = useCallback((data: ManagementPageData) => {
    if (data.teachers) setTeachers(data.teachers);
    if (data.classes) setClasses(data.classes);
    if (data.subjects) setSubjects(data.subjects);
    if (data.students) setStudents(data.students);
    if (data.exams) setExams(data.exams);
    if (data.results) setResults(data.results);
    if (data.fees) setFees(data.fees);
    if (data.payments) setPayments(data.payments);
    if (data.collectionReport) setCollectionReport(data.collectionReport);
    if (data.outstandingReport) setOutstandingReport(data.outstandingReport);
    if (data.attendance) setAttendance(data.attendance);
  }, []);

  const refresh = useCallback(async () => {
    try {
      applyPageData(await loadPageData());
      setError("");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [applyPageData, loadPageData]);

  useEffect(() => {
    let cancelled = false;
    void loadPageData()
      .then((data) => {
        if (cancelled) return;
        applyPageData(data);
        setError("");
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applyPageData, loadPageData]);

  useEffect(() => {
    if (page !== "Attendance" || !selectedClassId) return;
    let cancelled = false;
    api.get("/attendance", { params: { classId: selectedClassId, date: selectedDate } })
      .then((response) => {
        if (!cancelled) setAttendance(response.data.data);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(errorMessage(requestError));
      });

    return () => {
      cancelled = true;
    };
  }, [page, selectedClassId, selectedDate]);

  const runSave = async (action: () => Promise<void>, successMessage: string) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
      await refresh();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async (path: string, label: string) => {
    if (!window.confirm(`Delete this ${label}? This action cannot be undone.`)) return;
    await runSave(() => api.delete(path).then(() => undefined), `${label} deleted.`);
  };

  const heading = {
    Teachers: "Teacher Management",
    "Classes & Subjects": "Classes & Subjects",
    Attendance: "Attendance",
    Examinations: "Examinations",
    Results: "Results",
    "Fee Management": "Fee Management",
  }[page];
  const reportStudents = [...new Map(results.map((result) => [result.studentId._id, result.studentId])).values()];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{heading}</h1>
          <p className="mt-1 text-sm text-slate-500">Manage school records using live data from the school database.</p>
        </div>
        <button onClick={() => {
          setLoading(true);
          setError("");
          void refresh();
        }} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div>}

      {page === "Teachers" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(300px,380px)_1fr]">
          <form onSubmit={(event) => {
            event.preventDefault();
            void runSave(async () => {
              const payload = { ...teacherForm, ...(editingId && !teacherForm.password ? { password: undefined } : {}) };
              if (editingId) await api.put(`/academic/teachers/${editingId}`, payload);
              else await api.post("/academic/teachers", payload);
              setEditingId("");
              setTeacherForm({ name: "", email: "", password: "", employeeId: "", assignedClasses: [], subjects: [] });
            }, editingId ? "Teacher updated." : "Teacher account created.");
          }} className="h-fit space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-800">{editingId ? "Edit teacher" : "Create teacher account"}</h2>
            <Field label="Full name"><input required value={teacherForm.name} onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })} /></Field>
            <Field label="Email"><input required type="email" value={teacherForm.email} onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })} /></Field>
            <Field label={editingId ? "New password (optional)" : "Initial password"}><input required={!editingId} minLength={8} type="password" value={teacherForm.password} onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })} /></Field>
            <Field label="Employee ID"><input required value={teacherForm.employeeId} onChange={(e) => setTeacherForm({ ...teacherForm, employeeId: e.target.value })} /></Field>
            <CheckList title="Assigned classes" items={classes.map((item) => ({ id: item._id, label: `${item.name} - ${item.section}` }))} selected={teacherForm.assignedClasses} onChange={(assignedClasses) => setTeacherForm({ ...teacherForm, assignedClasses })} />
            <CheckList title="Subjects" items={subjects.map((item) => ({ id: item._id, label: `${item.name} (${item.code})` }))} selected={teacherForm.subjects} onChange={(subjects) => setTeacherForm({ ...teacherForm, subjects })} />
            <button disabled={saving} className="primary-button"><Plus size={16} />{saving ? "Saving..." : editingId ? "Save changes" : "Create teacher"}</button>
          </form>
          <DataTable loading={loading} headers={["Teacher", "Employee ID", "Classes", "Subjects", "Actions"]} empty={teachers.length === 0}>
            {teachers.map((teacher) => (
              <tr key={teacher._id}>
                <Cell><strong>{teacher.userId?.name}</strong><br /><span className="text-slate-400">{teacher.userId?.email}</span></Cell>
                <Cell>{teacher.employeeId}</Cell>
                <Cell>{teacher.assignedClasses.map(nameOf).join(", ") || "—"}</Cell>
                <Cell>{teacher.subjects.map(nameOf).join(", ") || "—"}</Cell>
                <Cell><RowActions onEdit={() => {
                  setEditingId(teacher._id);
                  setTeacherForm({
                    name: teacher.userId.name, email: teacher.userId.email, password: "", employeeId: teacher.employeeId,
                    assignedClasses: teacher.assignedClasses.map(idOf), subjects: teacher.subjects.map(idOf),
                  });
                }} onDelete={() => void removeRecord(`/academic/teachers/${teacher._id}`, "teacher")} deleteLabel="Deactivate" /></Cell>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      {page === "Classes & Subjects" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="space-y-4">
            <form onSubmit={(event) => {
              event.preventDefault();
              void runSave(async () => {
                if (classEditingId) await api.put(`/academic/classes/${classEditingId}`, classForm);
                else await api.post("/academic/classes", classForm);
                setClassEditingId("");
                setClassForm({ name: "", section: "", academicYear: "2026-27" });
              }, classEditingId ? "Class updated." : "Class created.");
            }} className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-800">{classEditingId ? "Edit class" : "Add class"}</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Class name"><input required value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} /></Field>
                <Field label="Section"><input required value={classForm.section} onChange={(e) => setClassForm({ ...classForm, section: e.target.value.toUpperCase() })} /></Field>
                <Field label="Academic year"><input required value={classForm.academicYear} onChange={(e) => setClassForm({ ...classForm, academicYear: e.target.value })} /></Field>
              </div>
              <button disabled={saving} className="primary-button"><Plus size={16} />{classEditingId ? "Save class" : "Add class"}</button>
            </form>
            <DataTable loading={loading} headers={["Class", "Section", "Academic year", "Actions"]} empty={!classes.length}>
              {classes.map((schoolClass) => <tr key={schoolClass._id}>
                <Cell>{schoolClass.name}</Cell><Cell>{schoolClass.section}</Cell><Cell>{schoolClass.academicYear}</Cell>
                <Cell><RowActions onEdit={() => { setClassEditingId(schoolClass._id); setClassForm({ name: schoolClass.name, section: schoolClass.section, academicYear: schoolClass.academicYear }); }} onDelete={() => void removeRecord(`/academic/classes/${schoolClass._id}`, "class")} /></Cell>
              </tr>)}
            </DataTable>
          </section>
          <section className="space-y-4">
            <form onSubmit={(event) => {
              event.preventDefault();
              void runSave(async () => {
                if (subjectEditingId) await api.put(`/academic/subjects/${subjectEditingId}`, subjectForm);
                else await api.post("/academic/subjects", subjectForm);
                setSubjectEditingId("");
                setSubjectForm({ name: "", code: "", classes: [] });
              }, subjectEditingId ? "Subject updated." : "Subject created.");
            }} className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-800">{subjectEditingId ? "Edit subject" : "Add subject"}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Subject name"><input required value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} /></Field>
                <Field label="Subject code"><input required value={subjectForm.code} onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })} /></Field>
              </div>
              <CheckList title="Assigned classes (optional)" items={classes.map((item) => ({ id: item._id, label: `${item.name} - ${item.section}` }))} selected={subjectForm.classes} onChange={(classes) => setSubjectForm({ ...subjectForm, classes })} />
              <button disabled={saving} className="primary-button"><Plus size={16} />{subjectEditingId ? "Save subject" : "Add subject"}</button>
            </form>
            <DataTable loading={loading} headers={["Subject", "Code", "Classes", "Actions"]} empty={!subjects.length}>
              {subjects.map((subject) => <tr key={subject._id}>
                <Cell>{subject.name}</Cell><Cell>{subject.code}</Cell><Cell>{subject.classes.map(nameOf).join(", ") || "All classes"}</Cell>
                <Cell><RowActions onEdit={() => { setSubjectEditingId(subject._id); setSubjectForm({ name: subject.name, code: subject.code, classes: subject.classes.map(idOf) }); }} onDelete={() => void removeRecord(`/academic/subjects/${subject._id}`, "subject")} /></Cell>
              </tr>)}
            </DataTable>
          </section>
        </div>
      )}

      {page === "Attendance" && (
        <section className="space-y-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            {role !== "GUARDIAN" && <Field label="Class"><select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}><option value="">Select a class</option>{classes.map((item) => <option key={item._id} value={item._id}>{item.name} - {item.section}</option>)}</select></Field>}
            <Field label="Date"><input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} /></Field>
            {role !== "GUARDIAN" && <Field label="Session"><select value={session} onChange={(e) => setSession(e.target.value)}><option>MORNING</option><option>AFTERNOON</option></select></Field>}
          </div>
          <div className="grid items-end gap-3 sm:grid-cols-4">
            <Field label="Report from"><input type="date" value={attendanceFromDate} onChange={(event) => setAttendanceFromDate(event.target.value)} /></Field>
            <Field label="Report to"><input type="date" value={attendanceToDate} onChange={(event) => setAttendanceToDate(event.target.value)} /></Field>
            <Field label="Status filter"><select value={attendanceStatus} onChange={(event) => setAttendanceStatus(event.target.value)}><option value="">All statuses</option><option>PRESENT</option><option>ABSENT</option><option>LATE</option></select></Field>
            <button type="button" className="primary-button" onClick={async () => {
              setError("");
              try {
                const response = await api.get("/attendance/export.csv", {
                  params: {
                    classId: role === "GUARDIAN" ? undefined : selectedClassId || undefined,
                    fromDate: attendanceFromDate || undefined,
                    toDate: attendanceToDate || undefined,
                    status: attendanceStatus || undefined,
                  },
                  responseType: "blob",
                });
                downloadBlob(response.data, "attendance-report.csv", "text/csv");
              } catch (requestError) {
                setError(errorMessage(requestError));
              }
            }}><Download size={16} />Export CSV</button>
          </div>
          {role !== "GUARDIAN" && selectedClassId ? (
            <div className="space-y-4">
              <DataTable loading={loading} headers={["Student", "Admission number", "Status"]} empty={!students.filter((student) => idOf(student.classId) === selectedClassId).length}>
                {students.filter((student) => idOf(student.classId) === selectedClassId).map((student) => {
                  const record = attendance.find((entry) => idOf(entry.studentId) === student._id && entry.session === session);
                  const status = attendanceDraft[student._id] || record?.status || "PRESENT";
                  return <tr key={student._id}><Cell>{student.name}</Cell><Cell>{student.admissionNo}</Cell><Cell>
                    <select value={status} onChange={(e) => setAttendanceDraft({ ...attendanceDraft, [student._id]: e.target.value as Attendance["status"] })}>
                      <option>PRESENT</option><option>ABSENT</option><option>LATE</option>
                    </select>
                  </Cell></tr>;
                })}
              </DataTable>
              <button disabled={saving} onClick={() => void runSave(async () => {
                const roster = students.filter((student) => idOf(student.classId) === selectedClassId);
                const responses = await Promise.allSettled(roster.map((student) => {
                  const record = attendance.find((entry) => idOf(entry.studentId) === student._id && entry.session === session);
                  const status = attendanceDraft[student._id] || record?.status || "PRESENT";
                  return record
                    ? api.put(`/attendance/${record._id}`, { status })
                    : api.post("/attendance", { studentId: student._id, classId: selectedClassId, date: selectedDate, session, status });
                }));
                setAttendanceDraft({});
                const rejected = responses.filter((response) => response.status === "rejected").length;
                if (rejected) throw new Error(`${rejected} attendance record(s) could not be saved. Refresh and review the list.`);
              }, "Attendance saved.")} className="primary-button"><Check size={16} />Save attendance</button>
            </div>
          ) : role === "GUARDIAN" ? (
            <DataTable loading={loading} headers={["Date", "Student", "Class", "Session", "Status"]} empty={!attendance.length}>
              {attendance.filter((entry) => entry.date.slice(0, 10) === selectedDate).map((entry) => <tr key={entry._id}>
                <Cell>{new Date(entry.date).toLocaleDateString()}</Cell><Cell>{entry.studentId?.name}</Cell><Cell>{entry.classId?.name} {entry.classId?.section}</Cell><Cell>{entry.session}</Cell><Cell>{entry.status}</Cell>
              </tr>)}
            </DataTable>
          ) : <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Choose an assigned class to record attendance.</p>}
        </section>
      )}

      {page === "Examinations" && (
        <div className="space-y-6">
          {role !== "GUARDIAN" && <form onSubmit={(event) => {
            event.preventDefault();
            void runSave(async () => {
              if (editingId) await api.put(`/exams/${editingId}`, { ...examForm, maxMarks: Number(examForm.maxMarks), passMarks: Number(examForm.passMarks) });
              else await api.post("/exams", { ...examForm, maxMarks: Number(examForm.maxMarks), passMarks: Number(examForm.passMarks) });
              setEditingId("");
              setExamForm({ title: "", classId: "", subjectId: "", date: today, maxMarks: "100", passMarks: "40" });
            }, editingId ? "Examination updated." : "Examination created.");
          }} className="grid gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Title"><input required value={examForm.title} onChange={(e) => setExamForm({ ...examForm, title: e.target.value })} /></Field>
            <Field label="Class"><select required value={examForm.classId} onChange={(e) => setExamForm({ ...examForm, classId: e.target.value })}><option value="">Select class</option>{classes.map((item) => <option key={item._id} value={item._id}>{item.name} - {item.section}</option>)}</select></Field>
            <Field label="Subject"><select required value={examForm.subjectId} onChange={(e) => setExamForm({ ...examForm, subjectId: e.target.value })}><option value="">Select subject</option>{subjects.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></Field>
            <Field label="Date"><input required type="date" value={examForm.date} onChange={(e) => setExamForm({ ...examForm, date: e.target.value })} /></Field>
            <Field label="Maximum marks"><input required type="number" min="1" value={examForm.maxMarks} onChange={(e) => setExamForm({ ...examForm, maxMarks: e.target.value })} /></Field>
            <Field label="Passing marks"><input required type="number" min="0" value={examForm.passMarks} onChange={(e) => setExamForm({ ...examForm, passMarks: e.target.value })} /></Field>
            <button disabled={saving} className="primary-button sm:col-span-2 xl:col-span-3"><Plus size={16} />{editingId ? "Save examination" : "Create examination"}</button>
          </form>}
          <DataTable loading={loading} headers={["Examination", "Class", "Subject", "Date", "Marks", ...(role === "GUARDIAN" ? [] : ["Actions"])]} empty={!exams.length}>
            {exams.map((exam) => <tr key={exam._id}>
              <Cell>{exam.title}</Cell><Cell>{nameOf(exam.classId)}</Cell><Cell>{nameOf(exam.subjectId)}</Cell><Cell>{new Date(exam.date).toLocaleDateString()}</Cell><Cell>{exam.passMarks} / {exam.maxMarks}</Cell>
              {role !== "GUARDIAN" && <Cell><RowActions onEdit={() => {
                setEditingId(exam._id);
                setExamForm({
                  title: exam.title, classId: idOf(exam.classId), subjectId: idOf(exam.subjectId),
                  date: exam.date.slice(0, 10), maxMarks: String(exam.maxMarks), passMarks: String(exam.passMarks),
                });
              }} onDelete={() => void removeRecord(`/exams/${exam._id}`, "examination")} deleteLabel={role === "ADMIN" ? "Delete" : undefined} /></Cell>}
            </tr>)}
          </DataTable>
        </div>
      )}

      {page === "Results" && (
        <div className="space-y-6">
          {role !== "GUARDIAN" && <form onSubmit={(event) => {
            event.preventDefault();
            void runSave(async () => {
              if (editingId) await api.put(`/results/${editingId}`, { marksObtained: Number(resultForm.marksObtained), remarks: resultForm.remarks });
              else await api.post("/results", { ...resultForm, marksObtained: Number(resultForm.marksObtained) });
              setEditingId("");
              setResultForm({ examId: "", studentId: "", marksObtained: "", remarks: "" });
            }, editingId ? "Result updated." : "Result saved.");
          }} className="grid gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Examination"><select required disabled={!!editingId} value={resultForm.examId} onChange={(e) => setResultForm({ ...resultForm, examId: e.target.value })}><option value="">Select exam</option>{exams.map((exam) => <option key={exam._id} value={exam._id}>{exam.title} — {nameOf(exam.classId)}</option>)}</select></Field>
            <Field label="Student"><select required disabled={!!editingId} value={resultForm.studentId} onChange={(e) => setResultForm({ ...resultForm, studentId: e.target.value })}><option value="">Select student</option>{students.map((student) => <option key={student._id} value={student._id}>{student.name}</option>)}</select></Field>
            <Field label="Marks obtained"><input required type="number" min="0" step="0.01" value={resultForm.marksObtained} onChange={(e) => setResultForm({ ...resultForm, marksObtained: e.target.value })} /></Field>
            <Field label="Remarks"><input value={resultForm.remarks} onChange={(e) => setResultForm({ ...resultForm, remarks: e.target.value })} /></Field>
            <button disabled={saving} className="primary-button sm:col-span-2 xl:col-span-4"><Plus size={16} />{editingId ? "Update result" : "Record result"}</button>
          </form>}
          <DataTable loading={loading} headers={["Student", "Examination", "Marks", "Percentage", "Grade", ...(role === "GUARDIAN" ? [] : ["Actions"])]} empty={!results.length}>
            {results.map((result) => <tr key={result._id}>
              <Cell>{result.studentId?.name}</Cell><Cell>{result.examId?.title}</Cell><Cell>{result.marksObtained} / {result.examId?.maxMarks}</Cell><Cell>{result.percentage}%</Cell><Cell>{result.grade}</Cell>
              {role !== "GUARDIAN" && <Cell><button className="icon-button" title="Edit result" onClick={() => {
                setEditingId(result._id);
                setResultForm({ examId: result.examId._id, studentId: result.studentId._id, marksObtained: String(result.marksObtained), remarks: "" });
              }}><Pencil size={16} /></button></Cell>}
            </tr>)}
          </DataTable>
          {!!reportStudents.length && (
            <section className="space-y-3">
              <h2 className="font-bold text-slate-800">Printable student report cards</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {reportStudents.map((student) => (
                  <div key={student._id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{student.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{student.admissionNo}</p>
                    </div>
                    <PrintableReportCard studentId={student._id} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {page === "Fee Management" && (
        <div className="space-y-6">
          <form onSubmit={(event) => {
            event.preventDefault();
            setLoading(true);
            setActiveFeeFilters({ ...feeFilterDraft });
          }} className="grid gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
            <h2 className="font-bold text-slate-800 sm:col-span-2 xl:col-span-4">Filter fee reports</h2>
            {role === "ADMIN" && <Field label="Student"><select value={feeFilterDraft.studentId} onChange={(event) => setFeeFilterDraft({ ...feeFilterDraft, studentId: event.target.value })}><option value="">All students</option>{students.map((student) => <option key={student._id} value={student._id}>{student.name} ({student.admissionNo})</option>)}</select></Field>}
            <Field label="Academic year"><input value={feeFilterDraft.academicYear} onChange={(event) => setFeeFilterDraft({ ...feeFilterDraft, academicYear: event.target.value })} placeholder="e.g. 2026-27" /></Field>
            <Field label="Fee category"><input value={feeFilterDraft.feeType} onChange={(event) => setFeeFilterDraft({ ...feeFilterDraft, feeType: event.target.value })} placeholder="All categories" /></Field>
            <Field label="Invoice status"><select value={feeFilterDraft.status} onChange={(event) => setFeeFilterDraft({ ...feeFilterDraft, status: event.target.value })}><option value="">All statuses</option><option>PENDING</option><option>PARTIAL</option><option>PAID</option></select></Field>
            <Field label="Invoice due from"><input type="date" value={feeFilterDraft.fromDate} onChange={(event) => setFeeFilterDraft({ ...feeFilterDraft, fromDate: event.target.value })} /></Field>
            <Field label="Invoice due to"><input type="date" value={feeFilterDraft.toDate} onChange={(event) => setFeeFilterDraft({ ...feeFilterDraft, toDate: event.target.value })} /></Field>
            <Field label="Payment from"><input type="date" value={feeFilterDraft.paymentFromDate} onChange={(event) => setFeeFilterDraft({ ...feeFilterDraft, paymentFromDate: event.target.value })} /></Field>
            <Field label="Payment to"><input type="date" value={feeFilterDraft.paymentToDate} onChange={(event) => setFeeFilterDraft({ ...feeFilterDraft, paymentToDate: event.target.value })} /></Field>
            <Field label="Payment method"><select value={feeFilterDraft.paymentMethod} onChange={(event) => setFeeFilterDraft({ ...feeFilterDraft, paymentMethod: event.target.value })}><option value="">All methods</option><option>CASH</option><option>UPI</option><option>CARD</option><option>BANK_TRANSFER</option></select></Field>
            <button disabled={saving} className="primary-button self-end"><Check size={16} />Apply filters</button>
          </form>

          {collectionReport && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label="Total invoiced" value={`₹${collectionReport.totalInvoiced.toLocaleString("en-IN")}`} />
                <SummaryCard label="Collected (selected period)" value={`₹${collectionReport.collectedInPeriod.toLocaleString("en-IN")}`} />
                <SummaryCard label="Currently paid" value={`₹${collectionReport.currentlyPaid.toLocaleString("en-IN")}`} />
                <SummaryCard label="Outstanding balance" value={`₹${collectionReport.outstanding.toLocaleString("en-IN")}`} />
              </div>
              <DataTable loading={loading} headers={["Academic year", "Category", "Invoices", "Invoiced", "Paid", "Outstanding"]} empty={!collectionReport.breakdown.length}>
                {collectionReport.breakdown.map((group) => <tr key={`${group.academicYear}-${group.feeType}`}>
                  <Cell>{group.academicYear}</Cell><Cell>{group.feeType}</Cell><Cell>{group.invoiceCount}</Cell><Cell>₹{group.totalInvoiced.toLocaleString("en-IN")}</Cell><Cell>₹{group.currentlyPaid.toLocaleString("en-IN")}</Cell><Cell>₹{group.outstanding.toLocaleString("en-IN")}</Cell>
                </tr>)}
              </DataTable>
            </>
          )}

          {role === "ADMIN" && <div className="grid gap-6 xl:grid-cols-2">
            <form onSubmit={(event) => {
              event.preventDefault();
              void runSave(async () => {
                await api.post("/fees", { ...feeForm, totalAmount: Number(feeForm.totalAmount) });
                setFeeForm({ studentId: "", academicYear: "2026-27", feeType: "", totalAmount: "", dueDate: today });
              }, "Fee invoice created.");
            }} className="grid gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:grid-cols-2">
              <h2 className="font-bold sm:col-span-2">Create fee invoice</h2>
              <Field label="Student"><select required value={feeForm.studentId} onChange={(e) => setFeeForm({ ...feeForm, studentId: e.target.value })}><option value="">Select student</option>{students.map((student) => <option key={student._id} value={student._id}>{student.name} ({student.admissionNo})</option>)}</select></Field>
              <Field label="Fee category"><input required value={feeForm.feeType} onChange={(e) => setFeeForm({ ...feeForm, feeType: e.target.value })} /></Field>
              <Field label="Academic year"><input required value={feeForm.academicYear} onChange={(e) => setFeeForm({ ...feeForm, academicYear: e.target.value })} /></Field>
              <Field label="Total amount"><input required type="number" min="0.01" step="0.01" value={feeForm.totalAmount} onChange={(e) => setFeeForm({ ...feeForm, totalAmount: e.target.value })} /></Field>
              <Field label="Due date"><input required type="date" value={feeForm.dueDate} onChange={(e) => setFeeForm({ ...feeForm, dueDate: e.target.value })} /></Field>
              <button disabled={saving} className="primary-button sm:col-span-2"><Plus size={16} />Create invoice</button>
            </form>
            <form onSubmit={(event) => {
              event.preventDefault();
              void runSave(async () => {
                await api.post("/fees/payment", { ...paymentForm, amount: Number(paymentForm.amount) });
                setPaymentForm({ feeId: "", amount: "", paymentMethod: "CASH", transactionId: "" });
              }, "Payment recorded.");
            }} className="grid gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:grid-cols-2">
              <h2 className="font-bold sm:col-span-2">Record payment</h2>
              <Field label="Invoice"><select required value={paymentForm.feeId} onChange={(e) => setPaymentForm({ ...paymentForm, feeId: e.target.value })}><option value="">Select outstanding invoice</option>{fees.filter((fee) => fee.totalAmount > fee.paidAmount).map((fee) => <option key={fee._id} value={fee._id}>{fee.studentId?.name} — {fee.feeType} (₹{fee.totalAmount - fee.paidAmount} due)</option>)}</select></Field>
              <Field label="Amount"><input required type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></Field>
              <Field label="Method"><select value={paymentForm.paymentMethod} onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}><option>CASH</option><option>UPI</option><option>CARD</option><option>BANK_TRANSFER</option></select></Field>
              <Field label="Transaction ID (optional)"><input value={paymentForm.transactionId} onChange={(e) => setPaymentForm({ ...paymentForm, transactionId: e.target.value })} /></Field>
              <button disabled={saving} className="primary-button sm:col-span-2"><Check size={16} />Record payment</button>
            </form>
          </div>}
          <DataTable loading={loading} headers={["Student", "Fee category", "Academic year", "Total", "Paid", "Balance", "Status"]} empty={!fees.length}>
            {fees.map((fee) => <tr key={fee._id}>
              <Cell>{fee.studentId?.name}</Cell><Cell>{fee.feeType}</Cell><Cell>{fee.academicYear}</Cell><Cell>₹{fee.totalAmount.toLocaleString("en-IN")}</Cell><Cell>₹{fee.paidAmount.toLocaleString("en-IN")}</Cell><Cell>₹{(fee.totalAmount - fee.paidAmount).toLocaleString("en-IN")}</Cell><Cell>{fee.status}</Cell>
            </tr>)}
          </DataTable>
          {outstandingReport && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-800">Outstanding invoices</h2>
                <p className="text-sm text-slate-500">{outstandingReport.invoiceCount} invoice(s) · ₹{outstandingReport.outstanding.toLocaleString("en-IN")}</p>
              </div>
              <DataTable loading={loading} headers={["Student", "Category", "Academic year", "Due date", "Outstanding", "Status"]} empty={!outstandingReport.invoices.length}>
                {outstandingReport.invoices.map((fee) => <tr key={fee._id}>
                  <Cell>{fee.studentId?.name}</Cell><Cell>{fee.feeType}</Cell><Cell>{fee.academicYear}</Cell><Cell>{new Date(fee.dueDate).toLocaleDateString()}</Cell><Cell>₹{(fee.totalAmount - fee.paidAmount).toLocaleString("en-IN")}</Cell><Cell>{fee.status}</Cell>
                </tr>)}
              </DataTable>
            </section>
          )}
          <section className="space-y-3">
            <h2 className="font-bold text-slate-800">Payment history</h2>
            <DataTable loading={loading} headers={["Date", "Student", "Fee category", "Method", "Transaction ID", "Amount"]} empty={!payments.length}>
              {payments.map((payment) => <tr key={payment._id}>
                <Cell>{new Date(payment.paymentDate).toLocaleDateString()}</Cell>
                <Cell>{payment.studentId?.name}</Cell>
                <Cell>{payment.feeId?.feeType ?? "—"}</Cell>
                <Cell>{payment.paymentMethod}</Cell>
                <Cell>{payment.transactionId || "—"}</Cell>
                <Cell>₹{payment.amount.toLocaleString("en-IN")}</Cell>
              </tr>)}
            </DataTable>
          </section>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-xs font-semibold text-slate-600">
    <span>{label}</span>
    <div className="management-field">{children}</div>
  </label>;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
    <p className="text-xs font-semibold text-slate-500">{label}</p>
    <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
  </div>;
}

function downloadBlob(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function CheckList({ title, items, selected, onChange }: {
  title: string;
  items: { id: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  return <fieldset className="space-y-2">
    <legend className="mb-1 text-xs font-semibold text-slate-600">{title}</legend>
    <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
      {items.length ? items.map((item) => <label key={item.id} className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => onChange(
          event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id)
        )} />
        {item.label}
      </label>) : <span className="text-xs text-slate-400">No records available</span>}
    </div>
  </fieldset>;
}

function DataTable({ headers, loading, empty, children }: {
  headers: string[];
  loading: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  return <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-400"><tr>{headers.map((header) => <th key={header} className="px-5 py-4">{header}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? <tr><td colSpan={headers.length} className="px-5 py-10 text-center text-slate-400">Loading records…</td></tr>
            : empty ? <tr><td colSpan={headers.length} className="px-5 py-10 text-center text-slate-400">No records found.</td></tr>
              : children}
        </tbody>
      </table>
    </div>
  </div>;
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-5 py-4 text-sm text-slate-600">{children}</td>;
}

function RowActions({ onEdit, onDelete, deleteLabel = "Delete" }: {
  onEdit: () => void;
  onDelete: () => void;
  deleteLabel?: string;
}) {
  return <div className="flex gap-1">
    <button className="icon-button" title="Edit" onClick={onEdit}><Pencil size={16} /></button>
    {deleteLabel && <button className="icon-button text-rose-600 hover:bg-rose-50" title={deleteLabel} onClick={onDelete}><Trash2 size={16} /></button>}
  </div>;
}

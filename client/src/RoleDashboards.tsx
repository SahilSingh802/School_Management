import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import api from "./services/api";

interface SchoolClass {
  _id: string;
  name: string;
  section: string;
  academicYear?: string;
}

interface Subject {
  _id: string;
  name: string;
  code: string;
}

interface AttendanceRecord {
  _id: string;
  date: string;
  session: string;
  status: "PRESENT" | "ABSENT" | "LATE";
  studentId: { name: string; admissionNo: string };
  classId: { name: string; section: string };
}

interface ExamRecord {
  _id: string;
  title: string;
  date: string;
  maxMarks: number;
  passMarks: number;
  classId: { name: string; section: string };
  subjectId: { name: string; code: string };
}

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  fromDate?: string;
  throughDate?: string;
}

interface TeacherDashboardData {
  assignedClasses: SchoolClass[];
  subjects: Subject[];
  attendanceSummary: AttendanceSummary;
  recentAttendance: AttendanceRecord[];
  upcomingExaminations: ExamRecord[];
}

interface GuardianStudent {
  _id: string;
  name: string;
  admissionNo: string;
  classId?: SchoolClass;
}

interface GuardianResult {
  _id: string;
  marksObtained: number;
  percentage: number;
  grade: string;
  examId: {
    title: string;
    date: string;
    maxMarks: number;
    subjectId?: Subject;
  };
  studentId: { name: string; admissionNo: string };
}

interface StudentFeeSummary {
  studentId: string;
  invoiceCount: number;
  totalInvoiced: number;
  paidAmount: number;
  outstanding: number;
  outstandingInvoiceCount: number;
}

interface OutstandingInvoice {
  _id: string;
  feeType: string;
  academicYear: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  studentId: { name: string; admissionNo: string };
}

interface GuardianDashboardData {
  linkedStudents: GuardianStudent[];
  attendanceSummary: AttendanceSummary;
  attendanceByStudent: (AttendanceSummary & { studentId: string })[];
  recentAttendance: AttendanceRecord[];
  recentResults: GuardianResult[];
  feeSummaryByStudent: StudentFeeSummary[];
  outstandingInvoices: OutstandingInvoice[];
}

function requestErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : "The dashboard could not be loaded.";
}

function useDashboardData<T>(endpoint: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const loadData = useCallback(async () => {
    const response = await api.get<{ data: T }>(endpoint);
    return response.data.data;
  }, [endpoint]);

  useEffect(() => {
    let cancelled = false;
    void loadData()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError("");
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(requestErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadData, revision]);

  const refresh = () => {
    setLoading(true);
    setError("");
    setRevision((value) => value + 1);
  };

  return { data, loading, error, refresh };
}

export function TeacherDashboard() {
  const { data, loading, error, refresh } =
    useDashboardData<TeacherDashboardData>("/dashboard/teacher");

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Teacher Dashboard"
        description="Your assigned classes, attendance activity, and upcoming examinations."
        loading={loading}
        onRefresh={refresh}
      />
      {error && <ErrorBanner message={error} />}
      {loading && !data ? <LoadingCard /> : data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Assigned classes" value={data.assignedClasses.length} />
            <SummaryCard label="Assigned subjects" value={data.subjects.length} />
            <SummaryCard label="Attendance records (7 days)" value={data.attendanceSummary.total} />
            <SummaryCard label="Upcoming examinations" value={data.upcomingExaminations.length} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-800">Assigned classes</h2>
              {data.assignedClasses.length ? (
                <ul className="divide-y divide-slate-100">
                  {data.assignedClasses.map((schoolClass) => (
                    <li key={schoolClass._id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="font-medium text-slate-700">{schoolClass.name} - {schoolClass.section}</span>
                      <span className="text-xs text-slate-500">{schoolClass.academicYear}</span>
                    </li>
                  ))}
                </ul>
              ) : <EmptyMessage>No classes are assigned to your account.</EmptyMessage>}
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-800">Assigned subjects</h2>
              {data.subjects.length ? (
                <ul className="divide-y divide-slate-100">
                  {data.subjects.map((subject) => (
                    <li key={subject._id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="font-medium text-slate-700">{subject.name}</span>
                      <span className="text-xs text-slate-500">{subject.code}</span>
                    </li>
                  ))}
                </ul>
              ) : <EmptyMessage>No subjects are assigned to your account.</EmptyMessage>}
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div>
                <h2 className="font-bold text-slate-800">Attendance activity</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {data.attendanceSummary.fromDate} to {data.attendanceSummary.throughDate}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <SmallMetric label="Present" value={data.attendanceSummary.present} />
                <SmallMetric label="Absent" value={data.attendanceSummary.absent} />
                <SmallMetric label="Late" value={data.attendanceSummary.late} />
              </div>
              <RecordTable
                headers={["Date", "Student", "Class", "Session", "Status"]}
                empty={!data.recentAttendance.length}
                emptyMessage="No attendance activity was recorded in this period."
              >
                {data.recentAttendance.map((record) => (
                  <tr key={record._id}>
                    <Cell>{formatDate(record.date)}</Cell>
                    <Cell>{record.studentId?.name}</Cell>
                    <Cell>{record.classId?.name} {record.classId?.section}</Cell>
                    <Cell>{record.session}</Cell>
                    <Cell>{record.status}</Cell>
                  </tr>
                ))}
              </RecordTable>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-800">Upcoming examinations</h2>
              <RecordTable
                headers={["Date", "Examination", "Class", "Subject", "Marks"]}
                empty={!data.upcomingExaminations.length}
                emptyMessage="No upcoming examinations are scheduled for your assignments."
              >
                {data.upcomingExaminations.map((exam) => (
                  <tr key={exam._id}>
                    <Cell>{formatDate(exam.date)}</Cell>
                    <Cell>{exam.title}</Cell>
                    <Cell>{exam.classId?.name} {exam.classId?.section}</Cell>
                    <Cell>{exam.subjectId?.name}</Cell>
                    <Cell>{exam.passMarks} / {exam.maxMarks}</Cell>
                  </tr>
                ))}
              </RecordTable>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

export function GuardianDashboard() {
  const { data, loading, error, refresh } =
    useDashboardData<GuardianDashboardData>("/dashboard/guardian");

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Guardian Dashboard"
        description="A private overview of your linked students' attendance, results, and fees."
        loading={loading}
        onRefresh={refresh}
      />
      {error && <ErrorBanner message={error} />}
      {loading && !data ? <LoadingCard /> : data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Linked students" value={data.linkedStudents.length} />
            <SummaryCard label="Attendance records (7 days)" value={data.attendanceSummary.total} />
            <SummaryCard label="Recent examination results" value={data.recentResults.length} />
            <SummaryCard label="Outstanding invoices" value={data.outstandingInvoices.length} />
          </div>

          <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-800">Linked students</h2>
            {data.linkedStudents.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.linkedStudents.map((student) => (
                  <article key={student._id} className="rounded-xl border border-slate-100 p-4">
                    <h3 className="font-semibold text-slate-800">{student.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">Admission no. {student.admissionNo}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {student.classId ? `${student.classId.name} - ${student.classId.section}` : "Class not assigned"}
                    </p>
                  </article>
                ))}
              </div>
            ) : <EmptyMessage>No active students are linked to your account.</EmptyMessage>}
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div>
                <h2 className="font-bold text-slate-800">Attendance summary</h2>
                <p className="mt-1 text-xs text-slate-500">Linked students · last 7 days</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <SmallMetric label="Present" value={data.attendanceSummary.present} />
                <SmallMetric label="Absent" value={data.attendanceSummary.absent} />
                <SmallMetric label="Late" value={data.attendanceSummary.late} />
              </div>
              <RecordTable
                headers={["Student", "Records", "Present", "Absent", "Late"]}
                empty={!data.attendanceByStudent.length}
                emptyMessage="No linked students have attendance records in this period."
              >
                {data.attendanceByStudent.map((summary) => {
                  const student = data.linkedStudents.find((item) => item._id === summary.studentId);
                  return (
                    <tr key={summary.studentId}>
                      <Cell>{student?.name || "Linked student"}</Cell>
                      <Cell>{summary.total}</Cell>
                      <Cell>{summary.present}</Cell>
                      <Cell>{summary.absent}</Cell>
                      <Cell>{summary.late}</Cell>
                    </tr>
                  );
                })}
              </RecordTable>
              <RecordTable
                headers={["Date", "Student", "Class", "Session", "Status"]}
                empty={!data.recentAttendance.length}
                emptyMessage="No recent attendance details."
              >
                {data.recentAttendance.map((record) => (
                  <tr key={record._id}>
                    <Cell>{formatDate(record.date)}</Cell>
                    <Cell>{record.studentId?.name}</Cell>
                    <Cell>{record.classId?.name} {record.classId?.section}</Cell>
                    <Cell>{record.session}</Cell>
                    <Cell>{record.status}</Cell>
                  </tr>
                ))}
              </RecordTable>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-800">Recent examination results</h2>
              <RecordTable
                headers={["Student", "Examination", "Subject", "Marks", "Grade"]}
                empty={!data.recentResults.length}
                emptyMessage="No examination results are available for linked students."
              >
                {data.recentResults.map((result) => (
                  <tr key={result._id}>
                    <Cell>{result.studentId?.name}</Cell>
                    <Cell>{result.examId?.title}</Cell>
                    <Cell>{result.examId?.subjectId?.name || "—"}</Cell>
                    <Cell>{result.marksObtained} / {result.examId?.maxMarks}</Cell>
                    <Cell>{result.grade} ({result.percentage}%)</Cell>
                  </tr>
                ))}
              </RecordTable>
            </section>
          </div>

          <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-800">Fee status by student</h2>
            {data.feeSummaryByStudent.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.feeSummaryByStudent.map((summary) => {
                  const student = data.linkedStudents.find((item) => item._id === summary.studentId);
                  return (
                    <article key={summary.studentId} className="rounded-xl border border-slate-100 p-4">
                      <h3 className="font-semibold text-slate-800">{student?.name || "Linked student"}</h3>
                      <p className="mt-2 text-xs text-slate-500">{summary.invoiceCount} invoice(s)</p>
                      <p className="mt-1 text-sm text-slate-700">Paid {formatCurrency(summary.paidAmount)}</p>
                      <p className="mt-1 text-sm font-semibold text-amber-700">
                        Outstanding {formatCurrency(summary.outstanding)}
                      </p>
                    </article>
                  );
                })}
              </div>
            ) : <EmptyMessage>No linked students are available.</EmptyMessage>}
            <RecordTable
              headers={["Student", "Category", "Academic year", "Due date", "Outstanding"]}
              empty={!data.outstandingInvoices.length}
              emptyMessage="No outstanding invoices for linked students."
            >
              {data.outstandingInvoices.map((invoice) => (
                <tr key={invoice._id}>
                  <Cell>{invoice.studentId?.name}</Cell>
                  <Cell>{invoice.feeType}</Cell>
                  <Cell>{invoice.academicYear}</Cell>
                  <Cell>{formatDate(invoice.dueDate)}</Cell>
                  <Cell>{formatCurrency(invoice.totalAmount - invoice.paidAmount)}</Cell>
                </tr>
              ))}
            </RecordTable>
          </section>
        </>
      )}
    </div>
  );
}

function DashboardHeader({ title, description, loading, onRefresh }: {
  title: string;
  description: string;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <button type="button" onClick={onRefresh} disabled={loading} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
        <RefreshCw size={16} />Refresh
      </button>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-800">{value}</p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{message}</div>;
}

function LoadingCard() {
  return <div role="status" className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-500">Loading dashboard…</div>;
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{children}</p>;
}

function RecordTable({ headers, empty, emptyMessage, children }: {
  headers: string[];
  empty: boolean;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-400">
          <tr>{headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {empty
            ? <tr><td colSpan={headers.length} className="px-4 py-5 text-center text-xs text-slate-500">{emptyMessage}</td></tr>
            : children}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 text-slate-600">{children}</td>;
}

function formatCurrency(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN");
}

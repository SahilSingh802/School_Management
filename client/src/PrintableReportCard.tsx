import { useState } from "react";
import { Printer, X } from "lucide-react";
import api from "./services/api";

interface ReportCardData {
  student: {
    name: string;
    admissionNo: string;
    dateOfBirth?: string;
    class?: { name: string; section: string; academicYear: string };
  };
  examinations: {
    title: string;
    date: string;
    subject?: { name: string; code: string };
    marksObtained: number;
    maxMarks: number;
    percentage: number;
    grade: string;
    remarks: string;
  }[];
  summary: {
    examinationCount: number;
    totalMarks: number;
    totalMaximumMarks: number;
    overallPercentage: number;
    overallGrade: string | null;
  };
  generatedAt: string;
}

export default function PrintableReportCard({ studentId }: { studentId: string }) {
  const [report, setReport] = useState<ReportCardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReport = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/results/students/${studentId}/report-card`);
      setReport(response.data.data);
    } catch (requestError) {
      const message = (requestError as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      setError(message || "Could not load this report card.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" disabled={loading} onClick={() => void loadReport()} className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60">
        <Printer size={15} />{loading ? "Loading…" : "View / Print"}
      </button>
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      {report && (
        <div className="report-card-overlay" role="dialog" aria-modal="true" aria-label={`${report.student.name} report card`}>
          <div className="report-card-dialog">
            <div className="report-card-toolbar">
              <button type="button" onClick={() => setReport(null)} className="icon-button" aria-label="Close report card"><X size={18} /></button>
              <button type="button" onClick={() => window.print()} className="primary-button"><Printer size={16} />Print report card</button>
            </div>
            <article className="report-card-print">
              <header className="report-card-heading">
                <h1>Student Report Card</h1>
                <p>Academic performance record</p>
              </header>
              <section className="report-card-student">
                <div><strong>Student</strong><span>{report.student.name}</span></div>
                <div><strong>Admission No.</strong><span>{report.student.admissionNo}</span></div>
                <div><strong>Class</strong><span>{report.student.class ? `${report.student.class.name} - ${report.student.class.section}` : "—"}</span></div>
                <div><strong>Academic year</strong><span>{report.student.class?.academicYear || "—"}</span></div>
                <div><strong>Date of birth</strong><span>{report.student.dateOfBirth ? new Date(report.student.dateOfBirth).toLocaleDateString() : "—"}</span></div>
              </section>
              {report.examinations.length ? (
                <table className="report-card-table">
                  <thead><tr><th>Examination</th><th>Date</th><th>Subject</th><th>Marks</th><th>Percentage</th><th>Grade</th></tr></thead>
                  <tbody>{report.examinations.map((entry, index) => (
                    <tr key={`${entry.title}-${entry.subject?.code}-${index}`}>
                      <td>{entry.title}</td>
                      <td>{new Date(entry.date).toLocaleDateString()}</td>
                      <td>{entry.subject?.name || "—"}</td>
                      <td>{entry.marksObtained} / {entry.maxMarks}</td>
                      <td>{entry.percentage}%</td>
                      <td>{entry.grade}</td>
                    </tr>
                  ))}</tbody>
                </table>
              ) : <p className="report-card-empty">No examination results are available for this student.</p>}
              <section className="report-card-summary">
                <div><strong>Total marks</strong><span>{report.summary.totalMarks} / {report.summary.totalMaximumMarks}</span></div>
                <div><strong>Overall percentage</strong><span>{report.summary.overallPercentage}%</span></div>
                <div><strong>Overall grade</strong><span>{report.summary.overallGrade || "—"}</span></div>
              </section>
              <footer className="report-card-footer">
                <span>Generated {new Date(report.generatedAt).toLocaleString()}</span>
                <span>Authorized school record</span>
              </footer>
            </article>
          </div>
        </div>
      )}
    </>
  );
}


import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import Class from "../models/Class.js";
import Subject from "../models/Subject.js";
import Attendance from "../models/Attendance.js";
import Exam from "../models/Exam.js";
import Result from "../models/Result.js";
import Fee from "../models/Fee.js";

const getDateRange = (now = new Date()) => {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  return { start, end, today: new Date(end.getTime() - 24 * 60 * 60 * 1000) };
};

const summarizeAttendance = (rows) => {
  const summary = { total: 0, present: 0, absent: 0, late: 0 };
  for (const row of rows) {
    const key = row._id.toLowerCase();
    if (key in summary && key !== "total") {
      summary[key] = row.count;
      summary.total += row.count;
    }
  }
  return summary;
};

export const getTeacherDashboard = async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ userId: req.user.id })
      .select("assignedClasses subjects");
    if (!teacher) {
      return res.status(403).json({ success: false, message: "Teacher profile not found" });
    }

    const classIds = teacher.assignedClasses || [];
    const subjectIds = teacher.subjects || [];
    const { start, end, today } = getDateRange();
    const attendanceFilter = {
      classId: { $in: classIds },
      date: { $gte: start, $lt: end },
    };

    const [assignedClasses, subjects, attendanceRows, recentAttendance, upcomingExaminations] = await Promise.all([
      Class.find({ _id: { $in: classIds } })
        .select("name section academicYear")
        .sort({ name: 1 }),
      Subject.find({
        _id: { $in: subjectIds },
        $or: [{ classes: { $size: 0 } }, { classes: { $in: classIds } }],
      })
        .select("name code")
        .sort({ name: 1 }),
      Attendance.aggregate([
        { $match: attendanceFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Attendance.find(attendanceFilter)
        .populate("studentId", "name admissionNo")
        .populate("classId", "name section")
        .sort({ date: -1, createdAt: -1 })
        .limit(10),
      Exam.find({
        classId: { $in: classIds },
        subjectId: { $in: subjectIds },
        date: { $gte: today },
      })
        .populate("classId", "name section")
        .populate("subjectId", "name code")
        .sort({ date: 1 })
        .limit(8),
    ]);

    return res.json({
      success: true,
      data: {
        assignedClasses,
        subjects,
        attendanceSummary: {
          ...summarizeAttendance(attendanceRows),
          fromDate: start.toISOString().slice(0, 10),
          throughDate: new Date(end.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        },
        recentAttendance,
        upcomingExaminations,
      },
    });
  } catch (error) {
    console.error("Teacher Dashboard Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch teacher dashboard" });
  }
};

export const getGuardianDashboard = async (req, res) => {
  try {
    const linkedStudents = await Student.find({
      guardianIds: req.user.id,
      isActive: { $ne: false },
    })
      .select("name admissionNo classId")
      .populate("classId", "name section academicYear")
      .sort({ name: 1 });
    const studentIds = linkedStudents.map((student) => student._id);
    const { start, end } = getDateRange();

    if (studentIds.length === 0) {
      return res.json({
        success: true,
        data: {
          linkedStudents,
          attendanceSummary: { total: 0, present: 0, absent: 0, late: 0 },
          attendanceByStudent: [],
          recentAttendance: [],
          recentResults: [],
          feeSummaryByStudent: [],
          outstandingInvoices: [],
        },
      });
    }

    const attendanceFilter = {
      studentId: { $in: studentIds },
      date: { $gte: start, $lt: end },
    };
    const [attendanceRows, recentAttendance, recentResults, feeRows, outstandingInvoices] = await Promise.all([
      Attendance.aggregate([
        { $match: attendanceFilter },
        { $group: { _id: { studentId: "$studentId", status: "$status" }, count: { $sum: 1 } } },
      ]),
      Attendance.find(attendanceFilter)
        .populate("studentId", "name admissionNo")
        .populate("classId", "name section")
        .sort({ date: -1, createdAt: -1 })
        .limit(10),
      Result.find({ studentId: { $in: studentIds } })
        .populate({ path: "examId", populate: { path: "subjectId", select: "name code" } })
        .populate("studentId", "name admissionNo")
        .sort({ createdAt: -1 })
        .limit(10),
      Fee.aggregate([
        { $match: { studentId: { $in: studentIds } } },
        {
          $group: {
            _id: "$studentId",
            invoiceCount: { $sum: 1 },
            totalInvoiced: { $sum: "$totalAmount" },
            paidAmount: { $sum: "$paidAmount" },
            outstanding: { $sum: { $subtract: ["$totalAmount", "$paidAmount"] } },
            outstandingInvoiceCount: {
              $sum: { $cond: [{ $lt: ["$paidAmount", "$totalAmount"] }, 1, 0] },
            },
          },
        },
      ]),
      Fee.find({
        studentId: { $in: studentIds },
        $expr: { $lt: ["$paidAmount", "$totalAmount"] },
      })
        .populate("studentId", "name admissionNo")
        .sort({ dueDate: 1 })
        .limit(10),
    ]);

    const attendanceByStudentMap = new Map(linkedStudents.map((student) => [
      String(student._id),
      { studentId: String(student._id), ...summarizeAttendance([]) },
    ]));
    for (const row of attendanceRows) {
      const summary = attendanceByStudentMap.get(String(row._id.studentId));
      const key = row._id.status.toLowerCase();
      if (summary && key in summary && key !== "total") {
        summary[key] = row.count;
        summary.total += row.count;
      }
    }

    const feeSummaryMap = new Map(feeRows.map((row) => [String(row._id), row]));
    const feeSummaryByStudent = linkedStudents.map((student) => {
      const summary = feeSummaryMap.get(String(student._id));
      return {
        studentId: String(student._id),
        invoiceCount: summary?.invoiceCount || 0,
        totalInvoiced: summary?.totalInvoiced || 0,
        paidAmount: summary?.paidAmount || 0,
        outstanding: summary?.outstanding || 0,
        outstandingInvoiceCount: summary?.outstandingInvoiceCount || 0,
      };
    });

    return res.json({
      success: true,
      data: {
        linkedStudents,
        attendanceSummary: summarizeAttendance(attendanceRows.map((row) => ({
          _id: row._id.status,
          count: row.count,
        }))),
        attendanceByStudent: [...attendanceByStudentMap.values()],
        recentAttendance,
        recentResults,
        feeSummaryByStudent,
        outstandingInvoices,
      },
    });
  } catch (error) {
    console.error("Guardian Dashboard Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch guardian dashboard" });
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    // Last 7 days date range (including today)
    const today = new Date();

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 1);
    endDate.setHours(0, 0, 0, 0);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    const [
      totalStudents,
      totalTeachers,
      totalClasses,
      attendanceRecords,
      weeklyRecords,
      feeSummary
    ] = await Promise.all([
      Student.countDocuments({ isActive: { $ne: false } }),
      Teacher.countDocuments(),
      Class.countDocuments(),

      // Today's attendance
      Attendance.find({
        date: {
          $gte: new Date(today.setHours(0, 0, 0, 0)),
          $lt: endDate
        }
      }).select("status"),

      // Last 7 days attendance
      Attendance.aggregate([
        {
          $match: {
            date: {
              $gte: startDate,
              $lt: endDate
            }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$date",
                timezone: "Asia/Kolkata"
              }
            },
            total: { $sum: 1 },
            attended: {
              $sum: {
                $cond: [
                  {
                    $in: ["$status", ["PRESENT", "LATE"]]
                  },
                  1,
                  0
                ]
              }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // Fee summary
      Fee.aggregate([
        {
          $group: {
            _id: null,
            totalFees: { $sum: "$totalAmount" },
            totalCollected: { $sum: "$paidAmount" }
          }
        }
      ])
    ]);

    // Today's attendance rate
    const totalAttendance = attendanceRecords.length;

    const attended = attendanceRecords.filter(
      record =>
        record.status === "PRESENT" ||
        record.status === "LATE"
    ).length;

    const attendanceRate = totalAttendance
      ? Number(((attended / totalAttendance) * 100).toFixed(1))
      : 0;

    // Prepare all 7 days, including days without attendance
    const weeklyAttendance = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      const dateKey = date.toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata"
      });

      const record = weeklyRecords.find(
        item => item._id === dateKey
      );

      const total = record?.total || 0;
      const present = record?.attended || 0;

      weeklyAttendance.push({
        date: dateKey,
        day: date.toLocaleDateString("en-US", {
          weekday: "short",
          timeZone: "Asia/Kolkata"
        }),
        total,
        attended: present,
        attendanceRate: total
          ? Number(((present / total) * 100).toFixed(1))
          : 0
      });
    }

    const fees = feeSummary[0] || {
      totalFees: 0,
      totalCollected: 0
    };

    res.status(200).json({
      success: true,
      data: {
        totalStudents,
        totalTeachers,
        totalClasses,
        attendanceRate,
        weeklyAttendance,
        totalFees: fees.totalFees,
        totalCollected: fees.totalCollected,
        outstanding: fees.totalFees - fees.totalCollected
      }
    });

  } catch (error) {
    console.error("Dashboard Stats Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
    });
  }
};


import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import Class from "../models/Class.js";
import Attendance from "../models/Attendance.js";
import Fee from "../models/Fee.js";

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

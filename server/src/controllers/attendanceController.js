
import Attendance from "../models/Attendance.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import mongoose from "mongoose";

export const markAttendance = async (req, res) => {
  try {
    const { studentId, classId, date, session, status } = req.body;

    if (
      !studentId ||
      !classId ||
      !date ||
      !session ||
      !status ||
      !mongoose.isValidObjectId(studentId) ||
      !mongoose.isValidObjectId(classId) ||
      !["MORNING", "AFTERNOON"].includes(session) ||
      !["PRESENT", "ABSENT", "LATE"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance data",
      });
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date",
      });
    }

    // Normalize date to UTC midnight
    const attendanceDate = new Date(
      Date.UTC(
        parsedDate.getUTCFullYear(),
        parsedDate.getUTCMonth(),
        parsedDate.getUTCDate()
      )
    );

    const student = await Student.findOne({ _id: studentId, isActive: { $ne: false } });

    if (!student || student.classId.toString() !== classId) {
      return res.status(400).json({
        success: false,
        message: "Student does not belong to this class",
      });
    }

    // Teachers can only mark attendance for assigned classes
    if (req.user.role === "TEACHER") {
      const teacher = await Teacher.findOne({
        userId: req.user.id,
        assignedClasses: classId,
      });

      if (!teacher) {
        return res.status(403).json({
          success: false,
          message: "You are not assigned to this class",
        });
      }
    }

    const attendance = await Attendance.create({
      studentId,
      classId,
      markedBy: req.user.id,
      date: attendanceDate,
      session,
      status,
    });

    return res.status(201).json({
      success: true,
      message: "Attendance marked successfully",
      data: attendance,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Attendance already marked for this student and session",
      });
    }

    console.error("Attendance Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to mark attendance",
    });
  }
};

export const getAttendance = async (req, res) => {
  try {
    const filter = {};

    if (req.query.classId) {
      if (!mongoose.isValidObjectId(req.query.classId)) {
        return res.status(400).json({ success: false, message: "Invalid class ID" });
      }
      filter.classId = req.query.classId;
    }

    if (req.query.studentId) {
      if (!mongoose.isValidObjectId(req.query.studentId)) {
        return res.status(400).json({ success: false, message: "Invalid student ID" });
      }
      filter.studentId = req.query.studentId;
    }

    if (req.query.date) {
      const parsedDate = new Date(req.query.date);

      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date",
        });
      }

      const start = new Date(
        Date.UTC(
          parsedDate.getUTCFullYear(),
          parsedDate.getUTCMonth(),
          parsedDate.getUTCDate()
        )
      );

      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);

      filter.date = { $gte: start, $lt: end };
    }

    // Teachers and guardians can only view records tied to their own relationships.
    if (req.user.role === "TEACHER") {
      const teacher = await Teacher.findOne({
        userId: req.user.id,
      });

      if (!teacher) {
        return res.status(403).json({
          success: false,
          message: "Teacher profile not found",
        });
      }

      const assignedIds = teacher.assignedClasses.map(
        (id) => id.toString()
      );

      if (
        req.query.classId &&
        !assignedIds.includes(req.query.classId)
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not assigned to this class",
        });
      }

      filter.classId = req.query.classId
        ? req.query.classId
        : { $in: teacher.assignedClasses };
    } else if (req.user.role === "GUARDIAN") {
      const linkedStudents = await Student.find({ guardianIds: req.user.id }).select("_id");
      const linkedIds = linkedStudents.map((student) => student._id);
      if (req.query.studentId && !linkedIds.some((id) => id.toString() === req.query.studentId)) {
        return res.status(403).json({ success: false, message: "You cannot access this student's attendance" });
      }
      filter.studentId = req.query.studentId
        ? req.query.studentId
        : { $in: linkedIds };
    }

    const records = await Attendance.find(filter)
      .populate("studentId", "name admissionNo")
      .populate("classId", "name section")
      .populate("markedBy", "name email")
      .sort({ date: -1 });

    return res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    console.error("Get Attendance Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance",
    });
  }
};

export const updateAttendance = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["PRESENT", "ABSENT", "LATE"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid attendance status" });
    }

    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({ success: false, message: "Attendance record not found" });
    }

    if (req.user.role === "TEACHER") {
      const assigned = await Teacher.exists({
        userId: req.user.id,
        assignedClasses: attendance.classId,
      });
      if (!assigned) {
        return res.status(403).json({ success: false, message: "You are not assigned to this class" });
      }
    }

    attendance.status = status;
    attendance.markedBy = req.user.id;
    await attendance.save();

    return res.json({ success: true, data: attendance });
  } catch (error) {
    console.error("Update Attendance Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update attendance" });
  }
};

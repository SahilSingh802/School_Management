
import Result from "../models/Result.js";
import Exam from "../models/Exam.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import { calculateGrade } from "../services/grading.js";

// Create Result
export const createResult = async (req, res) => {
  try {
    const { examId, studentId, marksObtained, remarks } = req.body;

    if (!examId || !studentId || marksObtained === undefined) {
      return res.status(400).json({
        success: false,
        message: "Exam, student and marks are required",
      });
    }

    const exam = await Exam.findById(examId);
    const student = await Student.findOne({ _id: studentId, isActive: { $ne: false } });

    if (!exam || !student) {
      return res.status(404).json({
        success: false,
        message: "Exam or student not found",
      });
    }

    if (String(student.classId) !== String(exam.classId)) {
      return res.status(400).json({
        success: false,
        message: "Student does not belong to this exam's class",
      });
    }

    if (
      typeof marksObtained !== "number" ||
      !Number.isFinite(marksObtained) ||
      marksObtained < 0 ||
      marksObtained > exam.maxMarks
    ) {
      return res.status(400).json({
        success: false,
        message: `Marks must be between 0 and ${exam.maxMarks}`,
      });
    }

    // Teacher can only enter marks for assigned classes
    if (req.user.role === "TEACHER") {
      const teacher = await Teacher.findOne({ userId: req.user.id });

      if (
        !teacher ||
        !teacher.assignedClasses.some(
          (id) => String(id) === String(exam.classId)
        ) ||
        !teacher.subjects.some((id) => String(id) === String(exam.subjectId))
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not assigned to this class and subject",
        });
      }
    }

    const percentage = Number(
      ((marksObtained / exam.maxMarks) * 100).toFixed(2)
    );

    const result = await Result.create({
      examId,
      studentId,
      marksObtained,
      percentage,
      grade: calculateGrade(percentage),
      remarks: remarks || "",
    });

    return res.status(201).json({
      success: true,
      message: "Result created successfully",
      data: result,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Result already exists for this student and exam",
      });
    }

    const status = ["ValidationError", "CastError"].includes(error.name) ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: status === 400 ? error.message : "Failed to create result",
    });
  }
};

// Get Results
export const getResults = async (req, res) => {
  try {
    const filter = {};

    if (req.query.examId) {
      filter.examId = req.query.examId;
    }

    if (req.query.studentId) {
      filter.studentId = req.query.studentId;
    }

    if (req.user.role === "GUARDIAN") {
      const linkedStudents = await Student.find({
        guardianIds: req.user.id,
      }).select("_id");

      filter.studentId = {
        $in: linkedStudents.map((student) => student._id),
      };
    }

    if (req.user.role === "TEACHER") {
      const teacher = await Teacher.findOne({ userId: req.user.id });

      if (!teacher) {
        return res.status(403).json({
          success: false,
          message: "Teacher profile not found",
        });
      }

      const assignedExams = await Exam.find({
        classId: { $in: teacher.assignedClasses },
        subjectId: { $in: teacher.subjects },
      }).select("_id");
      filter.examId = { $in: assignedExams.map((exam) => exam._id) };
    }

    const results = await Result.find(filter)
      .populate("examId")
      .populate("studentId", "name admissionNo classId")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error("Get Results Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch results",
    });
  }
};

export const getStudentReportCard = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!/^[a-f\d]{24}$/i.test(studentId)) {
      return res.status(400).json({ success: false, message: "Invalid student ID" });
    }

    const student = await Student.findById(studentId)
      .select("name admissionNo dateOfBirth classId guardianIds isActive")
      .populate("classId", "name section academicYear");

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    if (req.user.role === "GUARDIAN" &&
        !student.guardianIds.some((guardianId) => String(guardianId) === req.user.id)) {
      return res.status(403).json({ success: false, message: "You cannot access this student's report card" });
    }

    let visibleExams;
    if (req.user.role === "TEACHER") {
      const teacher = await Teacher.findOne({ userId: req.user.id }).select("assignedClasses subjects");
      if (!teacher) {
        return res.status(403).json({ success: false, message: "Teacher profile not found" });
      }

      visibleExams = await Exam.find({
        classId: student.classId._id,
        subjectId: { $in: teacher.subjects },
      }).select("_id");
      if (!teacher.assignedClasses.some((classId) => String(classId) === String(student.classId._id))) {
        return res.status(403).json({ success: false, message: "You are not assigned to this student's class" });
      }
    }

    const resultFilter = { studentId: student._id };
    if (visibleExams) resultFilter.examId = { $in: visibleExams.map((exam) => exam._id) };

    const results = await Result.find(resultFilter)
      .populate({
        path: "examId",
        populate: { path: "subjectId", select: "name code" },
      });
    results.sort((left, right) => left.examId.date - right.examId.date);

    const totalMarks = results.reduce((sum, result) => sum + result.marksObtained, 0);
    const totalMaximumMarks = results.reduce((sum, result) => sum + result.examId.maxMarks, 0);
    const overallPercentage = totalMaximumMarks
      ? Number(((totalMarks / totalMaximumMarks) * 100).toFixed(2))
      : 0;

    return res.json({
      success: true,
      data: {
        student: {
          id: student._id,
          name: student.name,
          admissionNo: student.admissionNo,
          dateOfBirth: student.dateOfBirth,
          class: student.classId,
        },
        examinations: results.map((result) => ({
          examId: result.examId._id,
          title: result.examId.title,
          date: result.examId.date,
          subject: result.examId.subjectId,
          marksObtained: result.marksObtained,
          maxMarks: result.examId.maxMarks,
          percentage: result.percentage,
          grade: result.grade,
          remarks: result.remarks,
        })),
        summary: {
          examinationCount: results.length,
          totalMarks,
          totalMaximumMarks,
          overallPercentage,
          overallGrade: totalMaximumMarks ? calculateGrade(overallPercentage) : null,
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Report Card Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to generate report card" });
  }
};

export const updateResult = async (req, res) => {
  try {
    const result = await Result.findById(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: "Result not found" });
    }

    const [exam, student] = await Promise.all([
      Exam.findById(result.examId),
      Student.findById(result.studentId),
    ]);

    if (!exam || !student) {
      return res.status(404).json({ success: false, message: "Exam or student not found" });
    }

    if (req.user.role === "TEACHER") {
      const teacher = await Teacher.findOne({ userId: req.user.id });
      if (!teacher ||
          !teacher.assignedClasses.some((id) => String(id) === String(exam.classId)) ||
          !teacher.subjects.some((id) => String(id) === String(exam.subjectId))) {
        return res.status(403).json({ success: false, message: "You are not assigned to this class and subject" });
      }
    }

    const marksObtained = req.body.marksObtained;
    if (
      typeof marksObtained !== "number" ||
      !Number.isFinite(marksObtained) ||
      marksObtained < 0 ||
      marksObtained > exam.maxMarks
    ) {
      return res.status(400).json({
        success: false,
        message: `Marks must be between 0 and ${exam.maxMarks}`,
      });
    }

    const percentage = Number(((marksObtained / exam.maxMarks) * 100).toFixed(2));
    result.marksObtained = marksObtained;
    result.percentage = percentage;
    result.grade = calculateGrade(percentage);
    if (req.body.remarks !== undefined) result.remarks = req.body.remarks;
    await result.save();

    return res.json({ success: true, data: result });
  } catch (error) {
    const status = ["ValidationError", "CastError"].includes(error.name) ? 400 : 500;
    if (status === 500) console.error("Update Result Error:", error.message);
    return res.status(status).json({
      success: false,
      message: status === 400 ? error.message : "Failed to update result",
    });
  }
};

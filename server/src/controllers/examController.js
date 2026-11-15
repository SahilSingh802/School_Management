import Exam from "../models/Exam.js";
import Result from "../models/Result.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import Class from "../models/Class.js";
import Subject from "../models/Subject.js";
import mongoose from "mongoose";

export const createExam = async (req, res) => {
  try {
    const { title, classId, subjectId, date, maxMarks, passMarks } = req.body;

    if (!title || !classId || !subjectId || !date ||
        maxMarks == null || passMarks == null) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (!mongoose.isValidObjectId(classId) || !mongoose.isValidObjectId(subjectId)) {
      return res.status(400).json({ success: false, message: "Invalid class or subject ID" });
    }

    const [schoolClass, subject] = await Promise.all([
      Class.findById(classId),
      Subject.findById(subjectId),
    ]);
    if (!schoolClass || !subject) {
      return res.status(400).json({ success: false, message: "Class or subject not found" });
    }
    if (subject.classes.length && !subject.classes.some((id) => String(id) === String(classId))) {
      return res.status(400).json({ success: false, message: "Subject is not assigned to this class" });
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid examination date" });
    }

    if (
      typeof maxMarks !== "number" ||
      typeof passMarks !== "number" ||
      !Number.isFinite(maxMarks) ||
      !Number.isFinite(passMarks) ||
      maxMarks <= 0 ||
      passMarks < 0 ||
      passMarks > maxMarks
    ) {
      return res.status(400).json({
        success: false,
        message: "Marks must be valid and passing marks cannot exceed maximum marks",
      });
    }

    if (req.user.role === "TEACHER") {
      const assigned = await Teacher.exists({
        userId: req.user.id,
        assignedClasses: classId,
        subjects: subjectId,
      });
      if (!assigned) {
        return res.status(403).json({ success: false, message: "You are not assigned to this class and subject" });
      }
    }

    const exam = await Exam.create({
      title,
      classId,
      subjectId,
      date: parsedDate,
      maxMarks,
      passMarks,
    });

    return res.status(201).json({
      success: true,
      message: "Exam created successfully",
      data: exam,
    });
  } catch (error) {
    const status = error.code === 11000 ? 409
      : ["ValidationError", "CastError"].includes(error.name) ? 400
        : 500;
    return res.status(status).json({
      success: false,
      message: error.code === 11000 ? "This exam already exists for this class and subject"
        : status === 400 ? error.message : "Failed to create examination",
    });
  }
};

export const getExams = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === "TEACHER") {
      const teacher = await Teacher.findOne({ userId: req.user.id }).select("assignedClasses subjects");
      if (!teacher) {
        return res.status(403).json({ success: false, message: "Teacher profile not found" });
      }
      filter.classId = { $in: teacher.assignedClasses };
      filter.subjectId = { $in: teacher.subjects };
    } else if (req.user.role === "GUARDIAN") {
      const linkedStudents = await Student.find({ guardianIds: req.user.id }).select("classId");
      filter.classId = { $in: linkedStudents.map((student) => student.classId) };
    }

    const exams = await Exam.find(filter)
      .populate("classId")
      .populate("subjectId")
      .sort({ date: 1 });

    return res.status(200).json({
      success: true,
      count: exams.length,
      data: exams,
    });
  } catch (error) {
    console.error("Get Examinations Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch examinations",
    });
  }
};

export const updateExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ success: false, message: "Examination not found" });
    }

    const nextClassId = req.body.classId ?? exam.classId;
    const nextSubjectId = req.body.subjectId ?? exam.subjectId;
    const maxMarks = req.body.maxMarks ?? exam.maxMarks;
    const passMarks = req.body.passMarks ?? exam.passMarks;
    const nextDate = req.body.date === undefined ? exam.date : new Date(req.body.date);

    if (!mongoose.isValidObjectId(nextClassId) ||
        !mongoose.isValidObjectId(nextSubjectId) ||
        typeof maxMarks !== "number" ||
        typeof passMarks !== "number" ||
        !Number.isFinite(maxMarks) ||
        !Number.isFinite(passMarks) ||
        maxMarks <= 0 ||
        passMarks < 0 ||
        passMarks > maxMarks ||
        Number.isNaN(nextDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid examination details" });
    }

    const [schoolClass, subject] = await Promise.all([
      Class.findById(nextClassId),
      Subject.findById(nextSubjectId),
    ]);
    if (!schoolClass || !subject ||
        (subject.classes.length && !subject.classes.some((id) => String(id) === String(nextClassId)))) {
      return res.status(400).json({ success: false, message: "Class or subject assignment is invalid" });
    }

    if (req.user.role === "TEACHER") {
      const assigned = await Teacher.exists({
        userId: req.user.id,
        assignedClasses: nextClassId,
        subjects: nextSubjectId,
      });
      if (!assigned) {
        return res.status(403).json({ success: false, message: "You are not assigned to this class and subject" });
      }
    }

    const highestResult = await Result.findOne({ examId: exam._id })
      .sort({ marksObtained: -1 })
      .select("marksObtained");
    if (highestResult &&
        (String(nextClassId) !== String(exam.classId) ||
         String(nextSubjectId) !== String(exam.subjectId) ||
         maxMarks !== exam.maxMarks)) {
      return res.status(409).json({
        success: false,
        message: "Class, subject, or maximum marks cannot invalidate existing results",
      });
    }

    exam.title = req.body.title ?? exam.title;
    exam.classId = nextClassId;
    exam.subjectId = nextSubjectId;
    exam.maxMarks = maxMarks;
    exam.passMarks = passMarks;
    exam.date = nextDate;
    await exam.save();
    return res.json({ success: true, data: exam });
  } catch (error) {
    const status = error.code === 11000 ? 409
      : ["ValidationError", "CastError"].includes(error.name) ? 400
        : 500;
    return res.status(status).json({
      success: false,
      message: error.code === 11000 ? "This exam already exists"
        : status === 400 ? error.message : "Failed to update examination",
    });
  }
};

export const deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ success: false, message: "Examination not found" });
    }

    if (await Result.exists({ examId: exam._id })) {
      return res.status(409).json({
        success: false,
        message: "Examination has results and cannot be deleted",
      });
    }

    await exam.deleteOne();
    return res.json({ success: true, message: "Examination deleted successfully" });
  } catch (error) {
    console.error("Delete Examination Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to delete examination" });
  }
};
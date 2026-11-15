
import Class from "../models/Class.js";
import Subject from "../models/Subject.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import User from "../models/User.js";
import Attendance from "../models/Attendance.js";
import Exam from "../models/Exam.js";
import Fee from "../models/Fee.js";
import Result from "../models/Result.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// CLASS APIs
export const createClass = async (req, res) => {
  try {
    const newClass = await Class.create(req.body);
    res.status(201).json({ success: true, data: newClass });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({
      success: false,
      message: error.code === 11000
        ? "This class and section already exist"
        : error.message,
    });
  }
};

export const getClasses = async (req, res) => {
  let filter = {};
  if (req.user.role === "TEACHER") {
    const teacher = await Teacher.findOne({ userId: req.user.id }).select("assignedClasses");
    if (!teacher) {
      return res.status(403).json({ success: false, message: "Teacher profile not found" });
    }
    filter._id = { $in: teacher.assignedClasses };
  } else if (req.user.role === "GUARDIAN") {
    const linkedStudents = await Student.find({ guardianIds: req.user.id }).select("classId");
    filter._id = { $in: linkedStudents.map((student) => student.classId) };
  }

  const classes = await Class.find(filter).sort({ name: 1 });
  res.json({ success: true, data: classes });
};

export const updateClass = async (req, res) => {
  try {
    const schoolClass = await Class.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name,
        section: req.body.section,
        academicYear: req.body.academicYear,
      },
      { new: true, runValidators: true }
    );

    if (!schoolClass) {
      return res.status(404).json({ success: false, message: "Class not found" });
    }

    return res.json({ success: true, data: schoolClass });
  } catch (error) {
    return res.status(error.code === 11000 ? 409 : 400).json({
      success: false,
      message: error.code === 11000
        ? "This class, section, and academic year already exist"
        : error.message,
    });
  }
};

export const deleteClass = async (req, res) => {
  try {
    const schoolClass = await Class.findById(req.params.id);
    if (!schoolClass) {
      return res.status(404).json({ success: false, message: "Class not found" });
    }

    const [students, teachers, attendance, exams, subjects] = await Promise.all([
      Student.exists({ classId: schoolClass._id }),
      Teacher.exists({ assignedClasses: schoolClass._id }),
      Attendance.exists({ classId: schoolClass._id }),
      Exam.exists({ classId: schoolClass._id }),
      Subject.exists({ classes: schoolClass._id }),
    ]);

    if (students || teachers || attendance || exams || subjects) {
      return res.status(409).json({
        success: false,
        message: "Class is in use and cannot be deleted",
      });
    }

    await schoolClass.deleteOne();
    return res.json({ success: true, message: "Class deleted successfully" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// SUBJECT APIs
export const createSubject = async (req, res) => {
  try {
    const { name, code, classes = [] } = req.body;
    if (!Array.isArray(classes) || classes.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ success: false, message: "Invalid class IDs" });
    }

    const validClasses = await Class.find({ _id: { $in: classes } }).select("_id");
    if (validClasses.length !== new Set(classes.map(String)).size) {
      return res.status(400).json({ success: false, message: "One or more classes are invalid" });
    }

    const subject = await Subject.create({ name, code, classes });
    res.status(201).json({ success: true, data: subject });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getSubjects = async (req, res) => {
  let filter = {};
  if (req.user.role === "TEACHER") {
    const teacher = await Teacher.findOne({ userId: req.user.id }).select("assignedClasses subjects");
    if (!teacher) {
      return res.status(403).json({ success: false, message: "Teacher profile not found" });
    }
    filter = {
      _id: { $in: teacher.subjects },
      $or: [{ classes: { $size: 0 } }, { classes: { $in: teacher.assignedClasses } }],
    };
  } else if (req.user.role === "GUARDIAN") {
    const linkedStudents = await Student.find({ guardianIds: req.user.id }).select("classId");
    const classIds = linkedStudents.map((student) => student.classId);
    filter = {
      $or: [{ classes: { $size: 0 } }, { classes: { $in: classIds } }],
    };
  }

  const subjects = await Subject.find(filter).populate("classes");
  res.json({ success: true, data: subjects });
};

export const updateSubject = async (req, res) => {
  try {
    const { name, code, classes } = req.body;
    if (classes !== undefined) {
      if (!Array.isArray(classes) || classes.some((id) => !mongoose.isValidObjectId(id))) {
        return res.status(400).json({ success: false, message: "Invalid class IDs" });
      }

      const validClasses = await Class.find({ _id: { $in: classes } }).select("_id");
      if (validClasses.length !== new Set(classes.map(String)).size) {
        return res.status(400).json({ success: false, message: "One or more classes are invalid" });
      }
    }

    const subject = await Subject.findByIdAndUpdate(
      req.params.id,
      { name, code, classes },
      { new: true, runValidators: true }
    ).populate("classes");

    if (!subject) {
      return res.status(404).json({ success: false, message: "Subject not found" });
    }

    return res.json({ success: true, data: subject });
  } catch (error) {
    return res.status(error.code === 11000 ? 409 : 400).json({
      success: false,
      message: error.code === 11000 ? "Subject code already exists" : error.message,
    });
  }
};

export const deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ success: false, message: "Subject not found" });
    }

    const [exams, teachers] = await Promise.all([
      Exam.exists({ subjectId: subject._id }),
      Teacher.exists({ subjects: subject._id }),
    ]);

    if (exams || teachers) {
      return res.status(409).json({
        success: false,
        message: "Subject is in use and cannot be deleted",
      });
    }

    await subject.deleteOne();
    return res.json({ success: true, message: "Subject deleted successfully" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// UPDATE STUDENT
export const updateStudent = async (req, res) => {
  try {
    const { admissionNo, name, dateOfBirth, classId, guardianIds } = req.body;

    if (classId) {
      const existingClass = await Class.findById(classId);

      if (!existingClass) {
        return res.status(400).json({
          success: false,
          message: "Class not found",
        });
      }
    }

    if (guardianIds !== undefined) {
      if (!Array.isArray(guardianIds) || guardianIds.some((id) => !mongoose.isValidObjectId(id))) {
        return res.status(400).json({
          success: false,
          message: "Guardian IDs must be a list of valid IDs",
        });
      }

      const guardians = await User.find({
        _id: { $in: guardianIds },
        role: "GUARDIAN",
        isActive: true,
      });

      if (guardians.length !== guardianIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more guardian IDs are invalid",
        });
      }
    }

    const student = await Student.findByIdAndUpdate(
      { _id: req.params.id, isActive: { $ne: false } },
      { admissionNo, name, dateOfBirth, classId, guardianIds },
      { new: true, runValidators: true }
    ).populate("classId").populate("guardianIds", "name email");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.json({ success: true, data: student });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({
      success: false,
      message: error.message,
    });
  }
};

// DELETE STUDENT
export const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    student.isActive = false;
    await student.save();
    res.json({
      success: true,
      message: "Student archived successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


// STUDENT APIs
export const createStudent = async (req, res) => {
  try {
    const { guardianIds = [], ...studentData } = req.body;

    if (!Array.isArray(guardianIds) || guardianIds.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({
        success: false,
        message: "Guardian IDs must be a list of valid IDs",
      });
    }

    if (!mongoose.isValidObjectId(studentData.classId)) {
      return res.status(400).json({ success: false, message: "A valid class is required" });
    }

    const schoolClass = await Class.exists({ _id: studentData.classId });
    if (!schoolClass) {
      return res.status(400).json({ success: false, message: "Class not found" });
    }

    const guardians = await User.find({
      _id: { $in: guardianIds },
      role: "GUARDIAN",
      isActive: true,
    });

    if (guardians.length !== guardianIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more guardian IDs are invalid",
      });
    }

    const student = await Student.create({
      ...studentData,
      guardianIds,
    });

    res.status(201).json({ success: true, data: student });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getStudents = async (req, res) => {
  const filter = { isActive: { $ne: false } };

  if (req.user.role === "GUARDIAN") {
    filter.guardianIds = req.user.id;
  } else if (req.user.role === "TEACHER") {
    const teacher = await Teacher.findOne({ userId: req.user.id }).select("assignedClasses");
    if (!teacher) {
      return res.status(403).json({ success: false, message: "Teacher profile not found" });
    }
    filter.classId = { $in: teacher.assignedClasses };
  }

  let studentQuery = Student.find(filter).populate("classId");
  if (req.user.role === "ADMIN") {
    studentQuery = studentQuery.populate("guardianIds", "name email");
  }
  const students = await studentQuery.sort({ createdAt: -1 });

  res.json({ success: true, data: students });
};


// TEACHER APIs

// CREATE TEACHER + USER ACCOUNT
export const createTeacher = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const {
      name,
      email,
      password,
      employeeId,
      assignedClasses = [],
      subjects = [],
    } = req.body;

    if (!name || !email || !password || !employeeId) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password and employee ID are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    await session.withTransaction(async () => {
      const existingUser = await User.findOne({
        email: normalizedEmail,
      }).session(session);

      if (existingUser) {
        const error = new Error("Email already registered");
        error.statusCode = 409;
        throw error;
      }

      const existingTeacher = await Teacher.findOne({
        employeeId: employeeId.trim(),
      }).session(session);

      if (existingTeacher) {
        const error = new Error("Employee ID already exists");
        error.statusCode = 409;
        throw error;
      }

      const validClasses = await Class.find({
        _id: { $in: assignedClasses },
      }).session(session);

      if (validClasses.length !== new Set(assignedClasses.map(String)).size) {
        throw new Error("One or more assigned classes are invalid");
      }

      const validSubjects = await Subject.find({
        _id: { $in: subjects },
      }).session(session);

      if (validSubjects.length !== new Set(subjects.map(String)).size) {
        throw new Error("One or more subjects are invalid");
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const [user] = await User.create(
        [{
          name: name.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          role: "TEACHER",
        }],
        { session }
      );

      const [teacher] = await Teacher.create(
        [{
          userId: user._id,
          employeeId: employeeId.trim(),
          assignedClasses,
          subjects,
        }],
        { session }
      );

      res.locals.createdTeacherId = teacher._id;
    });

    const teacher = await Teacher.findById(
      res.locals.createdTeacherId
    )
      .populate("userId", "name email")
      .populate("assignedClasses")
      .populate("subjects");

    return res.status(201).json({
      success: true,
      message: "Teacher created successfully",
      data: teacher,
    });

  } catch (error) {
    return res.status(
      error.statusCode || (error.code === 11000 ? 409 : 400)
    ).json({
      success: false,
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};


// GET ALL TEACHERS
export const getTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find()
      .populate("userId", "name email")
      .populate("assignedClasses")
      .populate("subjects")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: teachers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getGuardians = async (req, res) => {
  const guardians = await User.find({ role: "GUARDIAN", isActive: true })
    .select("name email")
    .sort({ name: 1 });
  res.json({ success: true, data: guardians });
};


// UPDATE TEACHER
export const updateTeacher = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      employeeId,
      assignedClasses,
      subjects,
    } = req.body;

    const teacher = await Teacher.findById(req.params.id).populate("userId");

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    if (assignedClasses !== undefined) {
      const validClasses = await Class.find({
        _id: { $in: assignedClasses },
      });

      if (validClasses.length !== new Set(assignedClasses.map(String)).size) {
        return res.status(400).json({
          success: false,
          message: "Invalid assigned classes",
        });
      }

      teacher.assignedClasses = assignedClasses;
    }

    if (subjects !== undefined) {
      const validSubjects = await Subject.find({
        _id: { $in: subjects },
      });

      if (validSubjects.length !== new Set(subjects.map(String)).size) {
        return res.status(400).json({
          success: false,
          message: "Invalid subjects",
        });
      }

      teacher.subjects = subjects;
    }

    if (employeeId !== undefined) {
      teacher.employeeId = employeeId.trim();
    }

    if (name !== undefined) {
      teacher.userId.name = name.trim();
    }

    if (email !== undefined) {
      teacher.userId.email = email.trim().toLowerCase();
    }

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters",
        });
      }

      teacher.userId.password = await bcrypt.hash(password, 12);
    }

    await teacher.userId.save();
    await teacher.save();

    const updatedTeacher = await Teacher.findById(teacher._id)
      .populate("userId", "name email")
      .populate("assignedClasses")
      .populate("subjects");

    res.json({
      success: true,
      message: "Teacher updated successfully",
      data: updatedTeacher,
    });

  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({
      success: false,
      message: error.message,
    });
  }
};


// DELETE TEACHER
export const deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    // Deactivate account instead of deleting historical user data
    await User.findByIdAndUpdate(teacher.userId, {
      isActive: false,
    });

    res.json({
      success: true,
      message: "Teacher account deactivated successfully",
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

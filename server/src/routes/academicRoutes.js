
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

import {
  createClass,
  getClasses,
  updateClass,
  deleteClass,
  createSubject,
  getSubjects,
  updateSubject,
  deleteSubject,
  createStudent,
  getStudents,
  createTeacher,
  getTeachers,
  getGuardians,
  updateStudent,
  deleteStudent,
  updateTeacher,
  deleteTeacher,
} from "../controllers/academicController.js";

const router = express.Router();

router.use(protect);

router.get("/classes", authorize("ADMIN", "TEACHER", "GUARDIAN"), getClasses);
router.post("/classes", authorize("ADMIN"), createClass);
router.put("/classes/:id", authorize("ADMIN"), updateClass);
router.delete("/classes/:id", authorize("ADMIN"), deleteClass);

router.get("/subjects", authorize("ADMIN", "TEACHER", "GUARDIAN"), getSubjects);
router.post("/subjects", authorize("ADMIN"), createSubject);
router.put("/subjects/:id", authorize("ADMIN"), updateSubject);
router.delete("/subjects/:id", authorize("ADMIN"), deleteSubject);

router.get("/students", authorize("ADMIN", "TEACHER", "GUARDIAN"), getStudents);
router.post("/students", authorize("ADMIN"), createStudent);
router.put("/students/:id", authorize("ADMIN"), updateStudent);
router.delete("/students/:id", authorize("ADMIN"), deleteStudent);

router.get("/teachers", authorize("ADMIN"), getTeachers);
router.post("/teachers", authorize("ADMIN"), createTeacher);
router.put("/teachers/:id", authorize("ADMIN"), updateTeacher);
router.delete("/teachers/:id", authorize("ADMIN"), deleteTeacher);
router.get("/guardians", authorize("ADMIN"), getGuardians);

export default router;

import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";
import {
  createExam,
  getExams,
  updateExam,
  deleteExam,
} from "../controllers/examController.js";

const router = express.Router();

router.use(protect);

router.post("/", authorize("ADMIN", "TEACHER"), createExam);
router.get("/", authorize("ADMIN", "TEACHER", "GUARDIAN"), getExams);
router.put("/:id", authorize("ADMIN", "TEACHER"), updateExam);
router.delete("/:id", authorize("ADMIN"), deleteExam);

export default router;